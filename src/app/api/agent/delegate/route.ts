/**
 * POST /api/agent/delegate
 *
 * Sends a task/message TO a locally-running agent (Hermes or OpenClaw).
 * The gateway URL is stored per-user in environment or via the settings page.
 *
 * Body:
 *   { agent: "hermes" | "openclaw", task: string, context?: string, sessionId?: string }
 *
 * Hermes gateway:  POST http://localhost:7860/sessions/send   (default port)
 * OpenClaw gateway: POST http://localhost:18789/sessions/send  (default port)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";

export const dynamic = "force-dynamic";

const AGENT_DEFAULTS: Record<string, { port: number; path: string }> = {
  hermes: { port: 7860, path: "/sessions/send" },
  openclaw: { port: 18789, path: "/sessions/send" },
};

interface DelegateRequest {
  agent: "hermes" | "openclaw";
  task: string;
  context?: string;
  sessionId?: string;
  /** Override gateway URL — useful when the gateway is remote */
  gatewayUrl?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: DelegateRequest;
  try {
    body = (await req.json()) as DelegateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { agent, task, context, sessionId, gatewayUrl } = body;

  if (!agent || !task?.trim()) {
    return NextResponse.json({ error: "agent and task are required" }, { status: 400 });
  }

  if (!["hermes", "openclaw"].includes(agent)) {
    return NextResponse.json({ error: "agent must be 'hermes' or 'openclaw'" }, { status: 400 });
  }

  // Resolve gateway URL: explicit override → env var → localhost default
  const envKey = agent === "hermes" ? "HERMES_GATEWAY_URL" : "OPENCLAW_GATEWAY_URL";
  const envUrl = process.env[envKey];
  const defaults = AGENT_DEFAULTS[agent];
  const resolvedBase = gatewayUrl ?? envUrl ?? `http://localhost:${defaults.port}`;
  const targetUrl = `${resolvedBase.replace(/\/$/, "")}${defaults.path}`;

  try {
    const payload =
      agent === "hermes"
        ? // Hermes sessions/send format
          {
            message: task,
            context: context ?? undefined,
            session_id: sessionId ?? undefined,
          }
        : // OpenClaw sessions/send format
          {
            content: task,
            context: context ?? undefined,
            sessionId: sessionId ?? undefined,
          };

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // 15 s timeout — agents can be slow to spin up
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Gateway returned ${res.status}`, detail: errorText.slice(0, 500) },
        { status: 502 }
      );
    }

    const data = await res.json().catch(() => ({ ok: true }));
    return NextResponse.json({ agent, status: "delegated", response: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    if (message.includes("fetch")) {
      return NextResponse.json(
        {
          error: "gateway_unreachable",
          detail: `Could not reach ${agent} gateway at ${targetUrl}. Make sure the agent is running locally.`,
          hint:
            agent === "hermes"
              ? "Run: hermes gateway"
              : "Run: openclaw gateway",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
