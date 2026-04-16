import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { createAutopilotWorkflow, getAutopilotWorkflowsByUserId } from "@/lib/db-helpers";
import {
  estimateNextRunAt,
  normalizeCronExpression,
  normalizeTimezone,
  normalizeWorkflowName,
  normalizeWorkflowPrompt,
} from "@/lib/autopilot-utils";

export const dynamic = "force-dynamic";

async function getSessionUserId() {
  const sessionData = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
  return sessionData?.user?.id ?? null;
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workflows = await getAutopilotWorkflowsByUserId(userId);
  return NextResponse.json({ workflows }, { status: 200 });
}

export async function POST(request: Request) {
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

  const workflow = await createAutopilotWorkflow({
    userId,
    name,
    prompt,
    cronExpression,
    timezone,
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
