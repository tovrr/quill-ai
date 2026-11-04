import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { createAutopilotRun, getAutopilotWorkflowById, updateAutopilotWorkflowByUserId } from "@/lib/data/db-helpers";
import { refuseIfPolicyChanged } from "@/lib/autopilot/tool-policy";
import { guardAutopilotSchema } from "@/lib/autopilot/schema-guard";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ workflowId: string }>;
}

async function getSessionUserId() {
  const sessionData = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
  return sessionData?.user?.id ?? null;
}

// A missing Autopilot column answers 503 with the migration to run (see schema-guard.ts).
export async function POST(request: Request, context: Params) {
  return guardAutopilotSchema(() => runNow(request, context));
}

async function runNow(_: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workflowId } = await params;
  const workflow = await getAutopilotWorkflowById(workflowId);
  if (!workflow || workflow.userId !== userId) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  if (workflow.status !== "active") {
    return NextResponse.json({ error: "Workflow is paused" }, { status: 400 });
  }

  // The same gate as the cron runner: an active workflow whose owner approved another tool
  // policy is refused, never recorded as a success. The run is recorded as `refused` and
  // the workflow keeps that status, so the page keeps offering "Approve and resume".
  const refusal = await refuseIfPolicyChanged(workflow);
  const outcome = refusal ?? {
    status: "success" as const,
    mode: workflow.mode,
    summary: "Manual run recorded. Execution hook can now be connected to your agent pipeline.",
  };

  const run = await createAutopilotRun({
    workflowId,
    userId,
    status: outcome.status,
    mode: outcome.mode,
    ...(refusal ? { reasonCode: refusal.reasonCode } : {}),
    summary: outcome.summary,
  });

  await updateAutopilotWorkflowByUserId(workflowId, userId, {
    lastRunAt: new Date(),
    lastRunStatus: outcome.status,
  });

  return NextResponse.json({ run }, { status: 201 });
}
