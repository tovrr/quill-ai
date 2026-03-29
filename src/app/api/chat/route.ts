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

    const { messages: incomingMessages, chatId, id: rawId, mode } = await req.json();

    const id: string = chatId || rawId || crypto.randomUUID();
    const selectedMode: Mode = (mode as Mode) || "advanced";

    // Ensure chat exists
    const existing = await getChatById(id);
    if (!existing) {
      await createChat(userId, "New chat", id);
    }

    // Save user message
    const lastUserMsg = [...(incomingMessages || [])]
      .reverse()
      .find((m: { role: string }) => m.role === "user");

    if (lastUserMsg) {
      const content =
        typeof lastUserMsg.content === "string"
          ? lastUserMsg.content
          : JSON.stringify(lastUserMsg.content);

      await saveMessage({ chatId: id, role: "user", content });

      if (
        (incomingMessages || []).filter((m: { role: string }) => m.role === "user")
          .length === 1
      ) {
        await updateChatTitle(id, content.slice(0, 60));
      }
    }

    const result = streamText({
      model: getModel(selectedMode),
      system: SYSTEM_PROMPT,
      messages: incomingMessages,
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
    console.error("Chat API error:", error instanceof Error ? error.stack : error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
