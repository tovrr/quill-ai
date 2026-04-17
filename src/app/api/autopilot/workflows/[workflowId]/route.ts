import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import {
  deleteAutopilotWorkflowByUserId,
  getAutopilotWorkflowById,
  updateAutopilotWorkflowByUserId,
} from "@/lib/data/db-helpers";
import {
  normalizeCronExpression,
  normalizeTimezone,
  normalizeWorkflowName,
  normalizeWorkflowPrompt,
} from "@/lib/extensions/autopilot";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ workflowId: string }>;
}

async function getSessionUserId() {
  const sessionData = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
  return sessionData?.user?.id ?? null;
}

export async function PATCH(request: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workflowId } = await params;
  const existing = await getAutopilotWorkflowById(workflowId);
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        name?: unknown;
        prompt?: unknown;
        cronExpression?: unknown;
        timezone?: unknown;
        status?: unknown;
      }
    | null;

  const updates: Parameters<typeof updateAutopilotWorkflowByUserId>[2] = {};

  if (body?.name !== undefined) {
    const name = normalizeWorkflowName(body.name);
    if (!name) return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    updates.name = name;
  }

  if (body?.prompt !== undefined) {
    const prompt = normalizeWorkflowPrompt(body.prompt);
    if (!prompt) return NextResponse.json({ error: "Invalid prompt" }, { status: 400 });
    updates.prompt = prompt;
  }

  if (body?.cronExpression !== undefined) {
    const cronExpression = normalizeCronExpression(body.cronExpression);
    if (!cronExpression) return NextResponse.json({ error: "Invalid cron expression" }, { status: 400 });
    updates.cronExpression = cronExpression;
  }

  if (body?.timezone !== undefined) {
    updates.timezone = normalizeTimezone(body.timezone);
  }

  if (body?.status !== undefined) {
    if (body.status !== "active" && body.status !== "paused") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = body.status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates supplied" }, { status: 400 });
  }

  const workflow = await updateAutopilotWorkflowByUserId(workflowId, userId, updates);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  return NextResponse.json({ workflow }, { status: 200 });
}

export async function DELETE(_: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workflowId } = await params;
  const deleted = await deleteAutopilotWorkflowByUserId(workflowId, userId);
  if (!deleted) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
