/**
 * GET  /api/autopilot/cron  (Vercel Cron, daily: see vercel.json)
 * POST /api/autopilot/cron  (manual run)
 *
 * Finds active workflows whose nextRunAt is in the past and runs each one as its
 * owner (see src/lib/autopilot/run-workflow.ts), at most
 * MAX_WORKFLOWS_PER_INVOCATION per invocation, oldest first. Vercel invokes cron
 * jobs with GET, so GET is the handler that matters; POST stays for manual runs.
 *
 * An active workflow runs only under the tool policy its owner approved; otherwise the
 * run is recorded as `refused` (`policy_changed`) and nothing is called. A workflow in
 * observe mode runs as a dry run (see src/lib/autopilot/run-workflow.ts).
 *
 * Per workflow: (1) claim it by moving nextRunAt to its next slot, (2) run it,
 * (3) record the run and the last-run fields, each write on its own. The claim comes
 * first so a database that keeps refusing the write cannot get the workflow picked
 * (and billed) again on every tick: when the claim fails the model is not called. The
 * cost is at-most-once delivery: a run lost after the claim waits for its next slot.
 *
 * When the database is behind the code (an Autopilot column is missing, Postgres 42703),
 * the due-workflows query fails: the route answers 503 and names the migration file
 * instead of a bare 500 (see src/lib/autopilot/schema-guard.ts).
 *
 * Protected by CRON_SECRET — Vercel injects Authorization: Bearer <secret>
 * automatically for cron invocations.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { autopilotWorkflows } from "@/db/schema";
import { and, asc, eq, lte, isNotNull } from "drizzle-orm";
import {
  createAutopilotRun,
  updateAutopilotWorkflowByUserId,
} from "@/lib/data/db-helpers";
import { computeNextRunAt } from "@/lib/extensions/autopilot";
import { MAX_WORKFLOWS_PER_INVOCATION, runWorkflow } from "@/lib/autopilot/run-workflow";
import {
  describeErrorForLog,
  describeUnexpectedErrorForLog,
  isMissingAutopilotColumn,
} from "@/lib/autopilot/errors";
import { AUTOPILOT_MIGRATION_FILE, guardAutopilotSchema } from "@/lib/autopilot/schema-guard";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * One line per failure, keyed by workflow id. For a failed write the error message is
 * left out on purpose (see describeErrorForLog): it can carry the prompt or the model's
 * answer.
 */
function logBookkeepingFailure(
  event: string,
  workflowId: string,
  err: unknown,
  describe: (err: unknown) => object = describeErrorForLog,
) {
  // A write that failed on a missing Autopilot column says which SQL to run.
  const migration = isMissingAutopilotColumn(err) ? { migration: AUTOPILOT_MIGRATION_FILE } : {};
  console.error(JSON.stringify({ event, workflowId, ...migration, ...describe(err) }));
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

async function handleCron(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return guardAutopilotSchema(runDueWorkflows);
}

async function runDueWorkflows() {
  const now = new Date();

  // Active workflows due for execution, oldest first. The slice also bounds the
  // batch when the query layer ignores the limit.
  const dueWorkflows = (
    await db
      .select()
      .from(autopilotWorkflows)
      .where(
        and(
          eq(autopilotWorkflows.status, "active"),
          isNotNull(autopilotWorkflows.nextRunAt),
          lte(autopilotWorkflows.nextRunAt, now)
        )
      )
      .orderBy(asc(autopilotWorkflows.nextRunAt))
      .limit(MAX_WORKFLOWS_PER_INVOCATION)
  ).slice(0, MAX_WORKFLOWS_PER_INVOCATION);

  if (dueWorkflows.length === 0) {
    return NextResponse.json({ ran: 0, skipped: 0, message: "No workflows due." });
  }

  const results: { id: string; status: string }[] = [];

  for (const workflow of dueWorkflows) {
    try {
      const nextRunAt = computeNextRunAt(workflow.cronExpression, workflow.timezone, now);

      // 1. Claim. If nextRunAt cannot move, running the model would only bill it again
      // on the next tick, so the workflow is skipped and the others carry on.
      try {
        await updateAutopilotWorkflowByUserId(workflow.id, workflow.userId, { nextRunAt });
      } catch (err) {
        logBookkeepingFailure("autopilot.cron.claim_failed", workflow.id, err);
        results.push({ id: workflow.id, status: "skipped" });
        continue;
      }

      // 2. Run.
      const { status, summary, mode, reasonCode, toolCalls } = await runWorkflow(workflow);

      // 3. Record. The two writes are independent: one failing must not stop the other.
      const [runWrite, workflowWrite] = await Promise.allSettled([
        createAutopilotRun({
          workflowId: workflow.id,
          userId: workflow.userId,
          status,
          mode,
          reasonCode,
          toolCalls,
          summary,
          ...(status === "failed" ? { errorMessage: summary } : {}),
        }),
        updateAutopilotWorkflowByUserId(workflow.id, workflow.userId, {
          lastRunAt: now,
          lastRunStatus: status,
        }),
      ]);
      if (runWrite.status === "rejected") {
        logBookkeepingFailure("autopilot.cron.run_record_failed", workflow.id, runWrite.reason);
      }
      if (workflowWrite.status === "rejected") {
        logBookkeepingFailure("autopilot.cron.workflow_update_failed", workflow.id, workflowWrite.reason);
      }

      // Anything not fully recorded counts as failed, so the response flags it.
      const recorded = runWrite.status === "fulfilled" && workflowWrite.status === "fulfilled";
      results.push({ id: workflow.id, status: recorded ? status : "failed" });
    } catch (err) {
      // One workflow must never stop the others. Each database write above has its own
      // handler and runWorkflow does not throw, so this is a bug in the code: keep its
      // message so it can be found (see describeUnexpectedErrorForLog).
      logBookkeepingFailure("autopilot.cron.workflow_failed", workflow.id, err, describeUnexpectedErrorForLog);
      results.push({ id: workflow.id, status: "failed" });
    }
  }

  const ran = results.filter((result) => result.status !== "skipped").length;
  return NextResponse.json({ ran, skipped: results.length - ran, results });
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}
