import { google } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, stepCountIs, convertToModelMessages, type ModelMessage } from "ai";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import {
  createChat,
  saveMessage,
  updateChatTitle,
  getChatById,
  countUserMessagesToday,
} from "@/lib/db-helpers";
import { KILLERS } from "@/lib/killers";
import { recordModelUsage } from "@/lib/model-usage";
import { checkRateLimit } from "@/lib/rate-limit";
import { getBestFreeModel } from "@/lib/openrouter-models";
import { buildWebSearchContext, isWebSearchConfigured, searchWeb } from "@/lib/web-search";
import {
  buildRateLimitHeaders,
  createApiRequestContext,
  logApiCompletion,
  logApiStart,
  withRequestHeaders,
} from "@/lib/observability";

export const maxDuration = 60;

type Mode = "fast" | "thinking" | "advanced";

type ResolvedModel = {
  model: ReturnType<typeof google> | ReturnType<typeof openrouter>;
  provider: "google" | "openrouter";
  modelId: string;
};

const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

function parseCsvEnv(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
  );
}

function getDailyLimit(mode: Mode) {
  const free = Number(process.env.FREE_DAILY_MESSAGES ?? "80");
  const think = Number(process.env.THINK_DAILY_MESSAGES ?? "40");
  const pro = Number(process.env.PRO_DAILY_MESSAGES ?? "120");

  switch (mode) {
    case "fast":
      return free;
    case "thinking":
      return think;
    default:
      return pro;
  }
}

// Tier IDs — can be overridden per-tier via env vars without redeploying.
const FAST_MODEL_ID = process.env.FAST_MODEL_OVERRIDE ?? "gemini-2.5-flash-lite";
const THINKING_MODEL_ID = process.env.THINKING_MODEL_OVERRIDE ?? "gemini-2.5-flash";
const ADVANCED_MODEL_ID = process.env.ADVANCED_MODEL_OVERRIDE ?? "gemini-2.5-pro";

async function getModel(mode: Mode, preferVision: boolean): Promise<ResolvedModel> {
  // Free/fast mode auto-selects best available OpenRouter free model.
  if (mode === "fast" && process.env.OPENROUTER_API_KEY && !preferVision) {
    const freeModel = await getBestFreeModel(process.env.OPENROUTER_API_KEY);
    return {
      model: openrouter(freeModel),
      provider: "openrouter",
      modelId: freeModel,
    };
  }

  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set (required for Think/Pro)");

  switch (mode) {
    case "fast":
      return {
        model: google(FAST_MODEL_ID),
        provider: "google",
        modelId: FAST_MODEL_ID,
      };
    case "thinking":
      return {
        model: google(THINKING_MODEL_ID),
        provider: "google",
        modelId: THINKING_MODEL_ID,
      };
    default:
      return {
        model: google(ADVANCED_MODEL_ID),
        provider: "google",
        modelId: ADVANCED_MODEL_ID,
      };
  }
}

function requestHasImageInput(body: Record<string, unknown>): boolean {
  if (!Array.isArray(body.messages)) return false;

  for (const message of body.messages as any[]) {
    if (Array.isArray(message?.parts)) {
      for (const part of message.parts) {
        if (part?.type === "file" && typeof part?.mediaType === "string" && part.mediaType.startsWith("image/")) {
          return true;
        }
      }
    }

    if (Array.isArray(message?.content)) {
      for (const block of message.content) {
        if (typeof block?.type === "string" && block.type.startsWith("image")) {
          return true;
        }
      }
    }
  }

  return false;
}

const SYSTEM_PROMPT = `You are Quill, a highly capable personal AI agent.

Your personality:
- Direct, confident, and action-oriented
- You think step-by-step and explain your reasoning clearly
- You proactively break complex goals into clear subtasks
- You are thorough but concise

Always be helpful, direct, and get things done.`;

function extractTextMessages(body: Record<string, unknown>): Array<{ role: string; content: string }> {
  // Format 1 + 2: AI SDK v6 messages with either content (string) or parts (array)
  if (Array.isArray(body.messages) && body.messages.length > 0) {
    return body.messages
      .map((m: any) => {
        // If it already has string content, use it
        if (typeof m.content === "string" && m.content.trim()) {
          return { role: m.role, content: m.content };
        }
        // If content is array (ContentBlock format), convert it
        if (Array.isArray(m.content)) {
          const text = m.content
            .filter((c: any) => c.type === "text")
            .map((c: any) => (typeof c.text === "string" ? c.text : ""))
            .join("");
          if (text.trim()) return { role: m.role, content: text };
        }
        // If message has parts (UIMessage format)
        if (Array.isArray(m.parts)) {
          const text = m.parts
            .filter((p: any) => p.type === "text")
            .map((p: any) => (typeof p.text === "string" ? p.text : ""))
            .join("");
          if (text.trim()) return { role: m.role, content: text };
        }
        // Last resort: stringify the entire message
        const stringified = JSON.stringify(m);
        if (stringified && stringified.length > 2) {
          return { role: m.role || "user", content: stringified };
        }
        return null;
      })
      .filter((m): m is { role: string; content: string } => m !== null && m.content.trim().length > 0);
  }

  // Format 3: { text: "hello" }
  if (typeof body.text === "string" && body.text.trim()) {
    return [{ role: "user", content: body.text }];
  }

  // Format 4: { message: { role: "user", content: "..." } }
  if (body.message && typeof body.message === "object") {
    const msg = body.message as { role?: string; content?: string };
    if (msg.content && msg.content.trim()) {
      return [{ role: msg.role || "user", content: msg.content }];
    }
  }

  return [];
}

async function extractModelMessages(body: Record<string, unknown>): Promise<ModelMessage[]> {
  if (Array.isArray(body.messages) && body.messages.length > 0) {
    const normalized = body.messages
      .map((m: any) => {
        const role = typeof m?.role === "string" ? m.role : "user";

        // Preferred: UIMessage parts (text/file/tool/source/etc.)
        if (Array.isArray(m?.parts) && m.parts.length > 0) {
          return { role, parts: m.parts };
        }

        // Compatibility: string content payloads
        if (typeof m?.content === "string" && m.content.trim()) {
          return {
            role,
            parts: [{ type: "text", text: m.content }],
          };
        }

        // Compatibility: content blocks that contain text
        if (Array.isArray(m?.content)) {
          const text = m.content
            .filter((c: any) => c?.type === "text" && typeof c?.text === "string")
            .map((c: any) => c.text)
            .join("");

          if (text.trim()) {
            return {
              role,
              parts: [{ type: "text", text }],
            };
          }
        }

        return null;
      })
      .filter((m): m is { role: string; parts: unknown[] } => m !== null);

    if (normalized.length > 0) {
      try {
        return await convertToModelMessages(normalized as any);
      } catch (error) {
        console.warn("[chat] convertToModelMessages fallback:", error instanceof Error ? error.message : error);
      }
    }
  }

  // Legacy fallback to plain text model messages.
  return extractTextMessages(body).map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));
}

function summarizeLastUserInput(body: Record<string, unknown>): string | null {
  if (!Array.isArray(body.messages)) return null;

  const lastUserMessage = [...body.messages].reverse().find((m: any) => m?.role === "user");
  if (!lastUserMessage) return null;

  // UIMessage format with parts supports file attachments.
  if (Array.isArray(lastUserMessage.parts)) {
    const text = lastUserMessage.parts
      .filter((p: any) => p?.type === "text" && typeof p?.text === "string")
      .map((p: any) => p.text)
      .join("\n")
      .trim();

    const files = lastUserMessage.parts
      .filter((p: any) => p?.type === "file")
      .map((p: any, index: number) =>
        typeof p?.filename === "string" && p.filename.trim()
          ? p.filename.trim()
          : `file-${index + 1}`
      );

    if (text && files.length > 0) {
      return `${text}\n\n[Attached: ${files.join(", ")}]`;
    }
    if (text) return text;
    if (files.length > 0) return `[Attached files: ${files.join(", ")}]`;
  }

  if (typeof lastUserMessage.content === "string" && lastUserMessage.content.trim()) {
    return lastUserMessage.content.trim();
  }

  return null;
}

function jsonResponse(payload: Record<string, string>, status: number, headers?: HeadersInit) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

export async function POST(req: Request) {
  const requestContext = createApiRequestContext(req, "/api/chat");
  try {
    // Get session from Better Auth
    let userId = "guest";
    let userEmail = "";
    try {
      const sessionData = await auth.api.getSession({
        headers: await nextHeaders(),
      });
      if (sessionData?.user?.id) {
        userId = sessionData.user.id;
        userEmail = (sessionData.user.email ?? "").toLowerCase();
      }
    } catch {
      // Guest mode
    }
    requestContext.userId = userId;
    logApiStart(requestContext);

    const perMinute = Number(process.env.API_CHAT_REQUESTS_PER_MINUTE ?? "20");
    const rateLimitKey = userId !== "guest" ? `chat:user:${userId}` : `chat:ip:${requestContext.ip}`;
    const rateLimit = checkRateLimit({
      key: rateLimitKey,
      max: perMinute,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      const headers = buildRateLimitHeaders({
        requestId: requestContext.requestId,
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
      logApiCompletion(requestContext, { status: 429, error: "rate_limit" });
      return jsonResponse({ error: "Too many requests. Please retry shortly." }, 429, headers);
    }

    const body = await req.json();
    console.log("[chat] body keys:", JSON.stringify(Object.keys(body)));

    const modelMessages = await extractModelMessages(body);
    console.log("[chat] extracted model messages:", modelMessages.length);

    const textMsgs = extractTextMessages(body);
    const summarizedUserInput = summarizeLastUserInput(body);

    if (modelMessages.length === 0) {
      console.error("[chat] No messages found. Body:", JSON.stringify(body).slice(0, 500));
      logApiCompletion(requestContext, { status: 400, error: "no_messages" });
      return jsonResponse({ error: "No messages provided" }, 400, {
        "x-request-id": requestContext.requestId,
      });
    }

    const id: string = (body.chatId as string) || (body.id as string) || crypto.randomUUID();
    const shouldPersist = userId !== "guest";
    const selectedMode: Mode = (body.mode as Mode) || "advanced";
    const preferVision = requestHasImageInput(body);
    const webSearchRequested = body.webSearch === true;
    const paidUserIds = parseCsvEnv(process.env.PAID_USER_IDS);
    const paidUserEmails = parseCsvEnv(process.env.PAID_USER_EMAILS);
    const hasPaidAccess =
      shouldPersist &&
      (process.env.ALLOW_ALL_AUTH_MODES === "true" || paidUserIds.has(userId) || (userEmail && paidUserEmails.has(userEmail)));

    // Guest users are limited to free mode; auth is required for think/pro tiers.
    if (!shouldPersist && selectedMode !== "fast") {
      logApiCompletion(requestContext, { status: 401, error: "auth_required_mode" });
      return jsonResponse({ error: "Sign in to use Think and Pro modes." }, 401, {
        "x-request-id": requestContext.requestId,
      });
    }

    if (webSearchRequested && !shouldPersist) {
      logApiCompletion(requestContext, { status: 401, error: "auth_required_web_search" });
      return jsonResponse({ error: "Sign in to use web search." }, 401, {
        "x-request-id": requestContext.requestId,
      });
    }

    if (webSearchRequested && !isWebSearchConfigured()) {
      logApiCompletion(requestContext, { status: 503, error: "web_search_not_configured" });
      return jsonResponse({ error: "Web search is not configured yet." }, 503, {
        "x-request-id": requestContext.requestId,
      });
    }

    if (webSearchRequested && shouldPersist) {
      const freeDailySearches = Number(process.env.WEB_SEARCH_DAILY_REQUESTS_FREE ?? "20");
      const paidDailySearches = Number(process.env.WEB_SEARCH_DAILY_REQUESTS_PAID ?? "100");
      const dailySearchLimit = hasPaidAccess ? paidDailySearches : freeDailySearches;

      const searchQuota = checkRateLimit({
        key: `websearch:daily:user:${userId}`,
        max: dailySearchLimit,
        windowMs: 86_400_000,
      });

      if (!searchQuota.allowed) {
        logApiCompletion(requestContext, { status: 429, error: "web_search_daily_quota_reached" });
        return jsonResponse(
          { error: `Daily web search limit reached (${dailySearchLimit}/day).` },
          429,
          { "x-request-id": requestContext.requestId }
        );
      }
    }

    // Paid mode enforcement for authenticated users.
    if (shouldPersist && selectedMode !== "fast" && process.env.ALLOW_ALL_AUTH_MODES !== "true") {
      if (!hasPaidAccess) {
        logApiCompletion(requestContext, { status: 402, error: "paid_mode_required" });
        return jsonResponse(
          { error: "Think and Pro are paid modes. Upgrade your account to use them." },
          402,
          { "x-request-id": requestContext.requestId }
        );
      }
    }

    if (shouldPersist) {
      const usedToday = await countUserMessagesToday(userId);
      const dailyLimit = getDailyLimit(selectedMode);
      if (usedToday >= dailyLimit) {
        logApiCompletion(requestContext, { status: 429, error: "daily_quota_reached" });
        return jsonResponse(
          {
            error: `Daily limit reached for this mode (${dailyLimit} messages/day).`,
          },
          429,
          { "x-request-id": requestContext.requestId }
        );
      }
    }

    // Resolve active killer — use its system prompt if provided
    const killerId = body.killerId as string | undefined;
    const killer = killerId ? KILLERS.find((k) => k.id === killerId) ?? null : null;
    const baseSystemPrompt = killer ? killer.systemPrompt : SYSTEM_PROMPT;
    const systemPromptParts = [baseSystemPrompt];

    if (webSearchRequested) {
      const searchQuery = summarizedUserInput ?? textMsgs.at(-1)?.content ?? "";
      if (searchQuery.trim()) {
        try {
          const maxResults = Number(process.env.WEB_SEARCH_MAX_RESULTS ?? "5");
          const searchResults = await searchWeb(searchQuery, maxResults);
          systemPromptParts.push(buildWebSearchContext(searchQuery, searchResults));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Web search failed";
          systemPromptParts.push(
            [
              "Web search was requested but the retrieval step failed.",
              `Failure: ${message}`,
              "Be explicit that live search results were unavailable and answer from model knowledge only.",
            ].join("\n")
          );
        }
      }
    }

    const systemPrompt = systemPromptParts.join("\n\n");

    if (shouldPersist) {
      // Ensure chat exists
      const existing = await getChatById(id);
      if (existing && existing.userId !== userId) {
        logApiCompletion(requestContext, { status: 403, error: "chat_forbidden" });
        return jsonResponse({ error: "You do not have access to this chat." }, 403, {
          "x-request-id": requestContext.requestId,
        });
      }

      if (!existing) {
        await createChat(userId, "New chat", id);
      }

      // Save user message
      const lastUserMsg = [...textMsgs].reverse().find((m) => m.role === "user");
      const persistedUserContent = lastUserMsg?.content ?? summarizedUserInput;

      if (persistedUserContent) {
        await saveMessage({ chatId: id, role: "user", content: persistedUserContent });

        const userTurnCount = Array.isArray(body.messages)
          ? body.messages.filter((m: any) => m?.role === "user").length
          : textMsgs.filter((m) => m.role === "user").length;

        if (userTurnCount === 1) {
          await updateChatTitle(id, persistedUserContent.slice(0, 60));
        }
      }
    }

    const resolvedModel = await getModel(selectedMode, preferVision);

    const result = streamText({
      model: resolvedModel.model,
      system: systemPrompt,
      messages: modelMessages,
      stopWhen: stepCountIs(5),
      onFinish: async ({ text, totalUsage, providerMetadata }) => {
        if (text && shouldPersist) {
          await saveMessage({ chatId: id, role: "assistant", content: text });
        }

        await recordModelUsage({
          userId: shouldPersist ? userId : undefined,
          chatId: shouldPersist ? id : undefined,
          route: "/api/chat",
          feature: "chat",
          mode: selectedMode,
          provider: resolvedModel.provider,
          model: resolvedModel.modelId,
          usage: totalUsage,
          providerMetadata,
        });
      },
    });

    logApiCompletion(requestContext, { status: 200 });
    return withRequestHeaders(result.toTextStreamResponse(), requestContext.requestId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    console.error("[chat] error:", error instanceof Error ? error.stack : error);
    logApiCompletion(requestContext, { status: 500, error: message });
    return jsonResponse({ error: message }, 500, {
      "x-request-id": requestContext.requestId,
    });
  }
}
