/**
 * POST /api/autopilot/cron
 *
 * Called by Vercel Cron every minute. Finds all active workflows whose
 * nextRunAt is in the past and executes them against the agent pipeline.
 *
 * Protected by CRON_SECRET — Vercel injects Authorization: Bearer <secret>
 * automatically for cron invocations.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { autopilotWorkflows } from "@/db/schema";
import { and, eq, lte, isNotNull } from "drizzle-orm";
import {
  createAutopilotRun,
  updateAutopilotWorkflowByUserId,
} from "@/lib/data/db-helpers";
import { computeNextRunAt } from "@/lib/extensions/autopilot";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

type WorkflowRow = {
  id: string;
  userId: string;
  prompt: string;
  cronExpression: string;
  timezone: string;
};

async function runWorkflow(workflow: WorkflowRow): Promise<{ status: "success" | "failed"; summary: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  try {
    const body = JSON.stringify({
      messages: [{ role: "user", content: workflow.prompt, parts: [{ type: "text", text: workflow.prompt }] }],
      mode: "fast",
      chatId: undefined,
      persist: false,
    });

    const resp = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-autopilot-workflow-id": workflow.id,
        "x-autopilot-cron": "1",
        ...(process.env.CRON_SECRET
          ? { authorization: `Bearer ${process.env.CRON_SECRET}` }
          : {}),
      },
      body,
      signal: AbortSignal.timeout(240_000),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => `status ${resp.status}`);
      return { status: "failed", summary: `Chat API returned ${resp.status}: ${text.slice(0, 200)}` };
    }

    // Drain the stream so the response completes, capture last text chunk
    const reader = resp.body?.getReader();
    let lastChunk = "";
    if (reader) {
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          lastChunk = decoder.decode(value, { stream: !done });
        }
      }
    }

    const summary = lastChunk.slice(-300).trim() || "Workflow executed successfully.";
    return { status: "success", summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "failed", summary: message.slice(0, 500) };
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find all active workflows due for execution
  const dueWorkflows = await db
    .select()
    .from(autopilotWorkflows)
    .where(
      and(
        eq(autopilotWorkflows.status, "active"),
        isNotNull(autopilotWorkflows.nextRunAt),
        lte(autopilotWorkflows.nextRunAt, now)
      )
    )
    .limit(50);

  if (dueWorkflows.length === 0) {
    return NextResponse.json({ ran: 0, message: "No workflows due." });
  }

  const results: { id: string; status: string }[] = [];

  for (const workflow of dueWorkflows) {
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
  }

  return NextResponse.json({ ran: results.length, results });
}
