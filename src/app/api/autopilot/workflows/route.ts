import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { createAutopilotWorkflow, getAutopilotWorkflowsByUserId } from "@/lib/data/db-helpers";
import {
  estimateNextRunAt,
  normalizeCronExpression,
  normalizeTimezone,
  normalizeWorkflowName,
  normalizeWorkflowPrompt,
} from "@/lib/extensions/autopilot";
import { currentAutopilotPolicyHash } from "@/lib/autopilot/tool-policy";
import { guardAutopilotSchema } from "@/lib/autopilot/schema-guard";

export const dynamic = "force-dynamic";

async function getSessionUserId() {
  const sessionData = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
  return sessionData?.user?.id ?? null;
}

// A missing Autopilot column answers 503 with the migration to run (see schema-guard.ts).
export async function GET() {
  return guardAutopilotSchema(listWorkflows);
}

export async function POST(request: Request) {
  return guardAutopilotSchema(() => createWorkflow(request));
}

async function listWorkflows() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workflows = await getAutopilotWorkflowsByUserId(userId);
  return NextResponse.json({ workflows }, { status: 200 });
}

async function createWorkflow(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        name?: unknown;
        prompt?: unknown;
        cronExpression?: unknown;
        timezone?: unknown;
      }
    | null;

  const name = normalizeWorkflowName(body?.name);
  const prompt = normalizeWorkflowPrompt(body?.prompt);
  const cronExpression = normalizeCronExpression(body?.cronExpression);
  const timezone = normalizeTimezone(body?.timezone);

  if (!name || !prompt || !cronExpression) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        details: {
          name: Boolean(name),
          prompt: Boolean(prompt),
          cronExpression: Boolean(cronExpression),
        },
      },
      { status: 400 }
    );
  }

  // A new workflow starts in observe mode (a dry run) under the tool policy in force now;
  // its owner switches it to active (PATCH mode) once the recorded runs look right.
  const workflow = await createAutopilotWorkflow({
    userId,
    name,
    prompt,
    cronExpression,
    timezone,
    mode: "observe",
    policyHash: await currentAutopilotPolicyHash(),
  });

  return NextResponse.json(
    {
      workflow: {
        ...workflow,
        nextRunAt: workflow.nextRunAt ?? estimateNextRunAt(),
      },
    },
    { status: 201 }
  );
}
