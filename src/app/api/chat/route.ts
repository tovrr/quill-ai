import { google } from "@ai-sdk/google";
import { streamText, stepCountIs } from "ai";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import {
  createChat,
  saveMessage,
  updateChatTitle,
  getChatById,
} from "@/lib/db-helpers";

export const maxDuration = 60;

type Mode = "fast" | "thinking" | "advanced";

function getModel(mode: Mode) {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");

  switch (mode) {
    case "fast":
      return google("gemini-2.0-flash-lite");
    case "thinking":
      return google("gemini-2.5-pro");
    default:
      return google("gemini-1.5-pro");
  }
}

const SYSTEM_PROMPT = `You are Quill, a highly capable personal AI agent.

Your personality:
- Direct, confident, and action-oriented
- You think step-by-step and explain your reasoning clearly
- You proactively break complex goals into clear subtasks
- You are thorough but concise

Always be helpful, direct, and get things done.`;

function extractMessages(body: Record<string, unknown>): Array<{ role: string; content: string }> {
  // Format 1: { messages: [{ role, content }, ...] }
  if (Array.isArray(body.messages) && body.messages.length > 0) {
    return body.messages;
  }

  // Format 2: { messages: [{ role, parts: [{ type: "text", text }] }] } — AI SDK v6 UIMessage format
  if (Array.isArray(body.messages)) {
    return body.messages.map((m: { role: string; content?: string; parts?: Array<{ type: string; text?: string }> }) => {
      if (typeof m.content === "string") return { role: m.role, content: m.content };
      if (Array.isArray(m.parts)) {
        const text = m.parts
          .filter((p) => p.type === "text")
          .map((p) => p.text || "")
          .join("");
        return { role: m.role, content: text };
      }
      return { role: m.role, content: JSON.stringify(m) };
    }).filter((m) => m.content);
  }

  // Format 3: { text: "hello" }
  if (typeof body.text === "string" && body.text.trim()) {
    return [{ role: "user", content: body.text }];
  }

  // Format 4: { message: { role: "user", content: "..." } }
  if (body.message && typeof body.message === "object") {
    const msg = body.message as { role?: string; content?: string };
    if (msg.content) {
      return [{ role: msg.role || "user", content: msg.content }];
    }
  }

  return [];
}

export async function POST(req: Request) {
  try {
    // Get session from Better Auth
    let userId = "guest";
    try {
      const sessionData = await auth.api.getSession({
        headers: await nextHeaders(),
      });
      if (sessionData?.user?.id) {
        userId = sessionData.user.id;
      }
    } catch {
      // Guest mode
    }

    const body = await req.json();
    console.log("[chat] body keys:", JSON.stringify(Object.keys(body)));

    const msgs = extractMessages(body);
    console.log("[chat] extracted messages:", msgs.length);

    if (msgs.length === 0) {
      console.error("[chat] No messages found. Body:", JSON.stringify(body).slice(0, 500));
      return new Response(JSON.stringify({ error: "No messages provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const id: string = (body.chatId as string) || (body.id as string) || crypto.randomUUID();
    const selectedMode: Mode = (body.mode as Mode) || "advanced";

    // Ensure chat exists
    const existing = await getChatById(id);
    if (!existing) {
      await createChat(userId, "New chat", id);
    }

    // Save user message
    const lastUserMsg = [...msgs].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      await saveMessage({ chatId: id, role: "user", content: lastUserMsg.content });
      if (msgs.filter((m) => m.role === "user").length === 1) {
        await updateChatTitle(id, lastUserMsg.content.slice(0, 60));
      }
    }

    const result = streamText({
      model: getModel(selectedMode),
      system: SYSTEM_PROMPT,
      messages: msgs as { role: "user" | "assistant" | "system"; content: string }[],
      stopWhen: stepCountIs(5),
      onFinish: async ({ text }) => {
        if (text) {
          await saveMessage({ chatId: id, role: "assistant", content: text });
        }
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    console.error("[chat] error:", error instanceof Error ? error.stack : error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
