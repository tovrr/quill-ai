import { google } from "@ai-sdk/google";
import { streamText, stepCountIs } from "ai";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { getKillerById } from "@/lib/killers";
import {
  createChat,
  saveMessage,
  updateChatTitle,
  getChatById,
} from "@/lib/db-helpers";

export const maxDuration = 60;

type Mode = "fast" | "thinking" | "advanced";

function getModel(mode: Mode) {
  switch (mode) {
    case "fast":
      return google("gemini-2.0-flash-lite");
    case "thinking":
      return google("gemini-2.5-pro");
    default:
      return google("gemini-1.5-pro");
  }
}

const SYSTEM_PROMPT = `You are Quill, a highly capable personal AI agent — like a brilliant, tireless assistant that can research, write, analyze, plan, and execute complex multi-step tasks.

Your personality:
- Direct, confident, and action-oriented
- You think step-by-step and explain your reasoning clearly
- You proactively break complex goals into clear subtasks
- You are thorough but concise — you avoid filler

Your capabilities:
- Deep web research and synthesis
- Writing (blogs, emails, reports, code, scripts)
- Data analysis and insights
- Planning and task decomposition
- Answering complex questions with detailed reasoning
- Analyzing uploaded images and files
- Building complete web pages, landing pages, and UIs

When given a task:
1. Briefly confirm what you understood
2. Execute it thoroughly
3. Present results in clean, structured markdown

## HTML / Web Page Generation

When asked to create a website, landing page, web page, UI, app interface, component, or anything visual/HTML:
- Generate a COMPLETE, self-contained HTML file
- Include ALL CSS inside a <style> tag in the <head> — no external stylesheets
- Include ALL JavaScript inside a <script> tag before </body> — no external scripts or CDN links
- Make the design visually polished, modern, and fully responsive
- Default aesthetic: dark premium theme (background #0a0a0f, accent #EF4444 red, white text)
- Use smooth animations, clean typography (system-ui or Inter), generous spacing
- Output ONLY the raw HTML starting with <!DOCTYPE html> — no explanations, no markdown code fences, no surrounding text

Always be helpful, direct, and get things done.`;

export async function POST(req: Request) {
  try {
    const { data: sessionData } = await auth.getSession();
    const userId = sessionData?.user?.id ?? "guest";
    const {
      messages: incomingMessages,
      chatId,
      id: rawChatId,
      mode,
      killerId,
      webSearch,
    } = await req.json();

    // Support both chatId (legacy) and id (AI SDK default) field names
    const chatIdInput: string = chatId || rawChatId || "";

    // Ensure chat exists in DB
    let resolvedChatId: string = chatIdInput;
    if (chatIdInput) {
      const existing = await getChatById(chatIdInput);
      if (!existing) {
        await createChat(userId, "New chat", chatIdInput);
      }
    } else {
      const chat = await createChat(userId, "New chat");
      resolvedChatId = chat.id;
    }

    // Save the latest user message
    const lastUserMsg = [...incomingMessages]
      .reverse()
      .find((m: { role: string }) => m.role === "user");

    if (lastUserMsg) {
      await saveMessage({
        chatId: resolvedChatId,
        role: "user",
        content:
          typeof lastUserMsg.content === "string"
            ? lastUserMsg.content
            : JSON.stringify(lastUserMsg.content),
      });

      // Auto-title from first user message
      if (
        incomingMessages.filter((m: { role: string }) => m.role === "user")
          .length === 1
      ) {
        const title = (
          typeof lastUserMsg.content === "string"
            ? lastUserMsg.content
            : "New chat"
        ).slice(0, 60);
        await updateChatTitle(resolvedChatId, title);
      }
    }

    const selectedMode: Mode = (mode as Mode) || "advanced";

    // Use killer's system prompt if a killer agent is selected
    const killer = killerId ? getKillerById(killerId as string) : undefined;
    const activeSystemPrompt = killer ? killer.systemPrompt : SYSTEM_PROMPT;

    const result = streamText({
      model: getModel(selectedMode),
      system: activeSystemPrompt,
      messages: incomingMessages,
      stopWhen: stepCountIs(5),
      ...(selectedMode === "thinking"
        ? { providerOptions: { google: { thinkingConfig: { thinkingBudget: 8000 } } } }
        : {}),
      tools: {
        // Real Google Search grounding — only active when user enables web search
        ...(webSearch ? { google_search: google.tools.googleSearch({}) } : {}),
        analyzeData: {
          description:
            "Analyze structured data or text and extract key insights",
          inputSchema: z.object({
            data: z.string().describe("The data or text to analyze"),
            focus: z
              .string()
              .optional()
              .describe("What aspect to focus the analysis on"),
          }),
          execute: async ({
            data,
            focus,
          }: {
            data: string;
            focus?: string;
          }) => ({
            status: "analyzed",
            dataLength: data.length,
            focus: focus ?? "general",
            note: "Analysis performed by Quill AI reasoning engine.",
          }),
        },
        createDocument: {
          description:
            "Create a structured document (report, plan, outline, email, blog post, etc.)",
          inputSchema: z.object({
            title: z.string().describe("Document title"),
            type: z
              .enum(["report", "plan", "outline", "email", "blog", "other"])
              .describe("Type of document to create"),
          }),
          execute: async ({
            title,
            type,
          }: {
            title: string;
            type: "report" | "plan" | "outline" | "email" | "blog" | "other";
          }) => ({
            status: "created",
            title,
            type,
            note: `Document '${title}' scaffold ready. Content will follow in the response.`,
          }),
        },
      },
      onFinish: async ({ text }: { text: string }) => {
        if (text) {
          await saveMessage({
            chatId: resolvedChatId,
            role: "assistant",
            content: text,
          });
        }
      },
    });

    const response = result.toTextStreamResponse();
    const headers = new Headers(response.headers);
    headers.set("x-chat-id", resolvedChatId);
    return new Response(response.body, { headers, status: response.status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    console.error("Chat API error:", error instanceof Error ? error.stack : error);
    return new Response(JSON.stringify({ error: message, stack: error instanceof Error ? error.stack : undefined }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
