/**
 * POST /api/cli/chat
 *
 * Lightweight streaming chat endpoint for the Quill CLI.
 * Auth: Authorization: Bearer <QUILL_CLI_KEY>
 * Body: { messages: [{role, content}][], mode?: "fast"|"thinking"|"advanced" }
 * Response: text/event-stream — NDJSON SSE events:
 *   data: {"type":"text","delta":"..."}
 *   data: {"type":"done","usage":{...}}
 *   data: {"type":"error","message":"..."}
 */

import { streamText, stepCountIs } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { resolveModelForMode, type ChatMode } from "@/lib/chat/model-selection";

export const runtime = "nodejs";
export const maxDuration = 60;

const QUILL_CLI_KEY = process.env.QUILL_CLI_KEY;

type MessageInput = { role: "user" | "assistant"; content: string };

function sendSSE(controller: ReadableStreamDefaultController, payload: unknown) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
}

export async function POST(req: NextRequest) {
  if (!QUILL_CLI_KEY) {
    return NextResponse.json(
      { error: "CLI key not configured on server (set QUILL_CLI_KEY env var)" },
      { status: 503 },
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${QUILL_CLI_KEY}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let messages: MessageInput[];
  let mode: ChatMode;

  try {
    const body = await req.json();
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      throw new Error("messages must be a non-empty array");
    }
    messages = body.messages.map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? ""),
    }));
    const rawMode = body.mode ?? "fast";
    mode = (["fast", "thinking", "advanced"] as const).includes(rawMode) ? rawMode : "fast";
  } catch (e) {
    return NextResponse.json({ error: `Invalid request: ${String(e)}` }, { status: 400 });
  }

  let resolved: Awaited<ReturnType<typeof resolveModelForMode>>;
  try {
    resolved = await resolveModelForMode(mode, false);
  } catch (e) {
    return NextResponse.json({ error: `Model resolution failed: ${String(e)}` }, { status: 503 });
  }

  const result = streamText({
    model: resolved.model,
    system:
      "You are Quill, a personal AI assistant. Respond concisely and helpfully. " +
      "You are running in a terminal — avoid markdown formatting unless the user asks for it. " +
      "Use plain text. Code blocks are acceptable.",
    messages,
    stopWhen: stepCountIs(1),
  });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const delta of result.textStream) {
          sendSSE(controller, { type: "text", delta });
        }
        const usage = await result.usage;
        sendSSE(controller, { type: "done", usage });
      } catch (e) {
        sendSSE(controller, { type: "error", message: String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
