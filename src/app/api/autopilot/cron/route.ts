/**
 * GET  /api/autopilot/cron  (Vercel Cron, daily: see vercel.json)
 * POST /api/autopilot/cron  (manual run)
 *
 * Finds active workflows whose nextRunAt is in the past and runs each one as its
 * owner (see src/lib/autopilot/run-workflow.ts), at most
 * MAX_WORKFLOWS_PER_INVOCATION per invocation, oldest first. Vercel invokes cron
 * jobs with GET, so GET is the handler that matters; POST stays for manual runs.
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

export const maxDuration = 300;
export const dynamic = "force-dynamic";

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
    return NextResponse.json({ ran: 0, message: "No workflows due." });
  }

  const results: { id: string; status: string }[] = [];

  for (const workflow of dueWorkflows) {
    try {
      const { status, summary } = await runWorkflow(workflow);
      const nextRunAt = computeNextRunAt(workflow.cronExpression, workflow.timezone, now);

      await Promise.all([
        createAutopilotRun({
          workflowId: workflow.id,
          userId: workflow.userId,
          status,
          summary,
          ...(status === "failed" ? { errorMessage: summary } : {}),
        }),
        updateAutopilotWorkflowByUserId(workflow.id, workflow.userId, {
          lastRunAt: now,
          lastRunStatus: status,
          nextRunAt,
        }),
      ]);

      results.push({ id: workflow.id, status });
    } catch (err) {
      // One workflow's bookkeeping failing must not stop the others.
      console.error(
        JSON.stringify({
          event: "autopilot.cron.workflow_failed",
          workflowId: workflow.id,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      results.push({ id: workflow.id, status: "failed" });
    }
  }

  return NextResponse.json({ ran: results.length, results });
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}
