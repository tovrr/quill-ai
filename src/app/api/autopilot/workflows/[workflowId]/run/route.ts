import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { createAutopilotRun, getAutopilotWorkflowById, updateAutopilotWorkflowByUserId } from "@/lib/data/db-helpers";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ workflowId: string }>;
}

async function getSessionUserId() {
  const sessionData = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
  return sessionData?.user?.id ?? null;
}

export async function POST(_: Request, { params }: Params) {
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

  const run = await createAutopilotRun({
    workflowId,
    userId,
    status: "success",
    summary: "Manual run recorded. Execution hook can now be connected to your agent pipeline.",
  });

  await updateAutopilotWorkflowByUserId(workflowId, userId, {
    lastRunAt: new Date(),
    lastRunStatus: "success",
  });

  return NextResponse.json({ run }, { status: 201 });
}
