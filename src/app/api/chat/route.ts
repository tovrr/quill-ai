import { google } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import {
  createUIMessageStreamResponse,
  streamText,
  stepCountIs,
  convertToModelMessages,
  type ModelMessage,
  type UIMessage,
} from "ai";
import { tool, jsonSchema } from "ai";
import { executeCode, isSandboxEnabled } from "@/lib/docker-executor";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import {
  buildUserCustomizationPrompt,
  normalizeUserProfile,
} from "@/lib/user-customization";
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
import { resolveUserEntitlements } from "@/lib/entitlements";
import { buildWebSearchContext, isWebSearchConfigured, searchWeb } from "@/lib/web-search";
import {
  buildRateLimitHeaders,
  createApiRequestContext,
  logApiCompletion,
  logApiStart,
  withRequestHeaders,
} from "@/lib/observability";
import { parseBuilderArtifact } from "@/lib/builder-artifacts";
import type { BuilderLocks, BuilderSessionContext, BuilderTarget } from "@/lib/builder-artifacts";
import { DEFAULT_BUILDER_LOCKS } from "@/lib/builder-artifacts";
import { recordBuilderMetric } from "@/lib/api-metrics";
import { NON_RENDERABLE_ASSISTANT_FALLBACK_TEXT } from "@/lib/assistant-message-utils";
import { buildExecutionPolicyGuidance, evaluatePermissionDecision } from "@/lib/killer-autonomy";
import { buildSandboxProviderRuntimeNote, getSandboxProviderStatus } from "@/lib/sandbox-providers";
import { buildTwoPassBuilderStream } from "@/lib/chat/two-pass-builder";
import {
  chatRequestSchema,
  type ChatRequestBody,
  type ChatRequestContentBlock,
  type ChatRequestMessage,
  type ChatRequestPart,
} from "@/lib/chat-request";

function buildRunCodeTool() {
  return tool({
    description:
      "Execute Python code in an isolated Docker sandbox and return stdout, stderr, and exit code. " +
      "Use this to run computations, test logic, or validate code. " +
      "The sandbox has no network access and no filesystem persistence between calls.",
    inputSchema: jsonSchema<{ code: string; language: "python" }>({
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "The source code to execute.",
        },
        language: {
          type: "string",
          enum: ["python"],
          description: "The programming language. Currently only 'python' is supported.",
        },
      },
      required: ["code", "language"],
    }),
    execute: async ({ code, language }: { code: string; language: "python" }) => {
      const result = await executeCode({ code, language, timeoutMs: 15_000 });
      return {
        ok: result.ok,
        stdout: result.stdout || "(no output)",
        stderr: result.stderr || undefined,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        ...(result.error ? { error: result.error } : {}),
      };
    },
  });
}

export const maxDuration = 60;
const DEBUG_CHAT_LOGS = process.env.DEBUG_CHAT_LOGS === "true";

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
const OPENROUTER_FAST_ENABLED = process.env.OPENROUTER_FAST_ENABLED === "true";
const TWO_PASS_BUILDER_ENABLED = process.env.TWO_PASS_BUILDER_ENABLED !== "false";
const BUILDER_QUALITY_RETRY_THRESHOLD = Number(process.env.BUILDER_QUALITY_RETRY_THRESHOLD ?? "72");

function safeRecordBuilderMetric(input: {
  parseSuccess: boolean;
  artifactType?: "page" | "document" | "react-app" | "nextjs-bundle";
  requestedTarget?: BuilderTarget;
}): void {
  try {
    recordBuilderMetric(input);
  } catch (error) {
    console.warn("[chat] builder metric recording failed:", error instanceof Error ? error.message : error);
  }
}

async function getModel(mode: Mode, preferVision: boolean): Promise<ResolvedModel> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  // Reliability-first strategy:
  // - Default fast mode to Gemini unless OpenRouter fast is explicitly enabled.
  // - If Google key is unavailable, still fall back to OpenRouter as last resort.
  if (mode === "fast") {
    if (!preferVision && OPENROUTER_FAST_ENABLED && process.env.OPENROUTER_API_KEY) {
      const freeModel = await getBestFreeModel(process.env.OPENROUTER_API_KEY);
      return {
        model: openrouter(freeModel),
        provider: "openrouter",
        modelId: freeModel,
      };
    }

    if (key) {
      return {
        model: google(FAST_MODEL_ID),
        provider: "google",
        modelId: FAST_MODEL_ID,
      };
    }

    if (!preferVision && process.env.OPENROUTER_API_KEY) {
      const freeModel = await getBestFreeModel(process.env.OPENROUTER_API_KEY);
      return {
        model: openrouter(freeModel),
        provider: "openrouter",
        modelId: freeModel,
      };
    }

    throw new Error("No model provider configured for fast mode. Set GOOGLE_GENERATIVE_AI_API_KEY or OPENROUTER_API_KEY.");
  }

  if (!key) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set (required for Think/Pro)");

  switch (mode) {
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

function requestHasImageInput(body: ChatRequestBody): boolean {
  if (!body.messages) return false;

  for (const message of body.messages) {
    if (Array.isArray(message.parts)) {
      for (const part of message.parts) {
        if (part.type === "file" && typeof part.mediaType === "string" && part.mediaType.startsWith("image/")) {
          return true;
        }
      }
    }

    if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (typeof block.type === "string" && block.type.startsWith("image")) {
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

const RESPONSE_STYLE_PROMPT = [
  "Response style rules:",
  "- Use clean, valid Markdown with proper bullets/headings and no dangling '*' tokens.",
  "- When emphasizing labels, use full bold syntax like **Start Date:** not Start Date:*.",
  "- Use emojis sparingly and intentionally (0-2 per response) when they improve clarity or tone.",
  "- Avoid emoji overuse in technical/code-heavy responses.",
].join("\n");

function isCanvasBuildIntent(input: string | null): boolean {
  if (!input) return false;

  const lower = input.toLowerCase();
  const buildWords = ["build", "create", "make", "design", "generate"];
  const previewTargets = [
    "doc",
    "docs",
    "document",
    "report",
    "outline",
    "brief",
    "proposal",
    "plan",
    "slides",
    "presentation",
    "deck",
    "sheet",
    "sheets",
    "spreadsheet",
    "table",
    "landing page",
    "website",
    "web app",
    "webapp",
    "page",
    "dashboard",
    "component",
    "ui",
    "hero section",
    "next.js",
    "react",
    "tailwind",
  ];

  return buildWords.some((word) => lower.includes(word)) && previewTargets.some((word) => lower.includes(word));
}

function normalizeBuilderTarget(value: unknown): BuilderTarget {
  return value === "page" || value === "react-app" || value === "nextjs-bundle" ? value : "auto";
}

function normalizeBuilderLocks(value: unknown): BuilderLocks {
  const candidate = typeof value === "object" && value !== null ? (value as Partial<BuilderLocks>) : {};
  return {
    layout: Boolean(candidate.layout),
    colors: Boolean(candidate.colors),
    sectionOrder: Boolean(candidate.sectionOrder),
    copy: Boolean(candidate.copy),
  };
}

function normalizeBuilderSession(value: unknown): BuilderSessionContext {
  if (typeof value !== "object" || value === null) return {};
  const candidate = value as Record<string, unknown>;
  const recentRefinements = Array.isArray(candidate.recentRefinements)
    ? candidate.recentRefinements.filter((item): item is string => typeof item === "string").slice(0, 5)
    : undefined;

  return {
    lastArtifactType:
      candidate.lastArtifactType === "page" ||
      candidate.lastArtifactType === "react-app" ||
      candidate.lastArtifactType === "nextjs-bundle" ||
      candidate.lastArtifactType === "document"
        ? candidate.lastArtifactType
        : undefined,
    lastArtifactTitle: typeof candidate.lastArtifactTitle === "string" ? candidate.lastArtifactTitle : undefined,
    recentRefinements,
  };
}

function buildIterationConstraintsPrompt(locks: BuilderLocks, session: BuilderSessionContext): string | null {
  const activeLocks: string[] = [];
  if (locks.layout) activeLocks.push("layout structure");
  if (locks.colors) activeLocks.push("color palette");
  if (locks.sectionOrder) activeLocks.push("section ordering");
  if (locks.copy) activeLocks.push("copy/text wording");

  const lines: string[] = [];
  if (activeLocks.length > 0) {
    lines.push(`Iteration locks are active: ${activeLocks.join(", ")}.`);
    lines.push("Preserve all locked elements unless the user explicitly asks to change them.");
  }

  if (session.lastArtifactType) {
    lines.push(`Current working artifact type: ${session.lastArtifactType}.`);
  }
  if (session.lastArtifactTitle) {
    lines.push(`Current artifact title: ${session.lastArtifactTitle}.`);
  }
  if (session.recentRefinements && session.recentRefinements.length > 0) {
    lines.push(`Recent refinements to preserve: ${session.recentRefinements.join("; ")}.`);
  }

  if (lines.length === 0) return null;
  return ["Builder iteration context:", ...lines].join("\n");
}

function buildCanvasArtifactPrompt(input: string | null, requestedTarget: BuilderTarget): string {
  const lower = (input ?? "").toLowerCase();
  const looksLikeDocumentRequest = [
    "doc",
    "docs",
    "document",
    "report",
    "outline",
    "brief",
    "proposal",
    "plan",
    "slides",
    "presentation",
    "deck",
    "sheet",
    "sheets",
    "spreadsheet",
    "table",
  ].some((token) => lower.includes(token));
  const wantsFrameworkCode =
    lower.includes("next.js") ||
    lower.includes("nextjs") ||
    lower.includes("react") ||
    lower.includes("tsx");

  const targetHint =
    requestedTarget === "auto"
      ? "Choose the best artifact type for the request."
      : `Use artifact type=${requestedTarget}.`;

  const shouldPrioritizePageQuality =
    requestedTarget === "page" ||
    (requestedTarget === "auto" &&
      ["landing page", "website", "hero", "marketing", "tailwind"].some((token) => lower.includes(token)));

  const pageQualityRules = shouldPrioritizePageQuality
    ? [
        "Page quality requirements:",
        "- Return a complete, polished page (not a skeleton).",
        "- Build as a single one-page prototype by default.",
        "- Keep navigation on the same page using hash anchors (e.g., #features, #pricing, #cta).",
        "- Do not use internal route links like /about, /pricing, /contact in prototype buttons/nav.",
        "- If an external link is necessary, use target='_blank' and rel='noopener noreferrer'.",
        "- Mobile-first responsive layout, then desktop enhancement.",
        "- Include a fully responsive header/nav and footer from the first render (no desktop-only assumptions).",
        "- Ensure tap targets are mobile-friendly and nav/actions remain usable at 320px width.",
        "- Include clear visual hierarchy, meaningful typography scale, and strong spacing rhythm.",
        "- Use at least one intentional motion effect (subtle reveal, hover, or transition) without over-animating.",
        "- Include practical sections when relevant: hero, social proof, features, CTA.",
        "- For sectioned pages, add stable section ids and data attributes for targeted edits: id='hero' data-quill-section='hero', id='features' data-quill-section='features', id='pricing' data-quill-section='pricing', id='testimonials' data-quill-section='testimonials', id='cta' data-quill-section='cta'.",
        "- Preserve existing section ids/data-quill-section markers across refinements unless explicitly asked to restructure.",
        "- Ensure accessible contrast, semantic HTML landmarks, and visible focus styles.",
        "- Avoid placeholder copy like lorem ipsum unless explicitly requested.",
      ]
    : [];

  const reactRuntimeRules =
    requestedTarget === "react-app" || (requestedTarget === "auto" && lower.includes("react"))
      ? [
          "React app requirements:",
          "- Provide payload.files with a runnable React app and set payload.entry explicitly.",
          "- The entry file must mount to document.getElementById('root') using react-dom/client.",
          "- Use only React + ReactDOM plus local relative imports within payload.files.",
          "- Avoid Node APIs, server-only code, and external npm dependencies unless absolutely necessary.",
        ]
      : [];

  const nextBundleRules =
    requestedTarget === "nextjs-bundle" ||
    (requestedTarget === "auto" && (lower.includes("next.js") || lower.includes("nextjs")))
      ? [
          "Next.js bundle requirements (export-first):",
          "- Use type=nextjs-bundle and provide payload.files as a complete runnable project snapshot.",
          "- Include package.json with scripts: dev, build, start and dependencies for next, react, react-dom.",
          "- Use App Router only (no pages/api). Include app/layout.tsx and app/page.tsx (or src/app equivalents).",
          "- Include tsconfig.json and next.config.ts (or next.config.js/mjs).",
          "- Keep imports local and deterministic; avoid placeholders and TODO stubs.",
          "- Prefer minimal external packages; only include dependencies actually used by the files.",
        ]
      : [];

  const documentRules = looksLikeDocumentRequest
    ? [
        "Document artifact requirements:",
        "- Prefer type=document for docs, slides, sheets, outlines, plans, and reports.",
        "- Use payload.markdown with well-structured Markdown content.",
        "- Ensure headings, lists, and emphasis render cleanly with standard Markdown.",
        "- Do not output malformed emphasis tokens (e.g., 'Key Milestones:*').",
      ]
    : [];

  return [
    "The user is asking for something that should render in the app canvas.",
    targetHint,
    "Return a typed builder artifact as valid JSON wrapped in <quill-artifact>...</quill-artifact>.",
    "Only allowed artifact.type values are: page, document, react-app, nextjs-bundle. Do not invent custom type names.",
    "Output the artifact block first, then optional explanation after it.",
    "Use this shape:",
    '{ "artifactVersion": 1, "artifact": { "type": "page|document|react-app|nextjs-bundle", "title": "...", "payload": { ... } } }',
    "For landing pages and visual previews, choose type=page and payload.html as a complete self-contained HTML document.",
    "Page HTML must run in iframe srcDoc with no local imports or build step.",
    "Do not rely on external CSS/JS CDNs for core styling (they may be blocked in some environments).",
    "Prefer complete inline <style> CSS so the page looks correct even without external network access.",
    "For react-app or nextjs-bundle, put a files object in payload.files where keys are file paths and values are full file contents.",
    wantsFrameworkCode
      ? "If the user asks for Next.js or React, prefer type=react-app or type=nextjs-bundle with realistic file paths and runnable file contents."
      : "After the HTML artifact, you may include brief implementation notes only if they add clear value.",
    ...documentRules,
    ...pageQualityRules,
    ...reactRuntimeRules,
    ...nextBundleRules,
  ].join("\n");
}

function extractTextMessages(body: ChatRequestBody): Array<{ role: string; content: string }> {
  if (body.messages && body.messages.length > 0) {
    return body.messages
      .map((message) => {
        // If it already has string content, use it
        if (typeof message.content === "string" && message.content.trim()) {
          return { role: message.role ?? "user", content: message.content };
        }
        // If content is array (ContentBlock format), convert it
        if (Array.isArray(message.content)) {
          const text = message.content
            .filter((block) => block.type === "text")
            .map((block) => (typeof block.text === "string" ? block.text : ""))
            .join("");
          if (text.trim()) return { role: message.role ?? "user", content: text };
        }
        // If message has parts (UIMessage format)
        if (Array.isArray(message.parts)) {
          const text = message.parts
            .filter((part) => part.type === "text")
            .map((part) => (typeof part.text === "string" ? part.text : ""))
            .join("");
          if (text.trim()) return { role: message.role ?? "user", content: text };
        }
        // Last resort: stringify the entire message
        const stringified = JSON.stringify(message);
        if (stringified && stringified.length > 2) {
          return { role: message.role || "user", content: stringified };
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

function decodeDataUrlText(url: string): string | null {
  const match = url.match(/^data:([^;,]*)(;base64)?,(.*)$/i);
  if (!match) return null;

  const [, , isBase64, payload] = match;
  try {
    const decoded = isBase64
      ? Buffer.from(payload, "base64").toString("utf8")
      : decodeURIComponent(payload);
    return decoded;
  } catch {
    return null;
  }
}

function isTextLikeMediaType(mediaType: string): boolean {
  const normalized = mediaType.toLowerCase();
  return (
    normalized.startsWith("text/") ||
    normalized === "application/json" ||
    normalized === "application/xml" ||
    normalized === "application/javascript" ||
    normalized === "application/x-javascript" ||
    normalized === "application/csv" ||
    normalized === "text/csv"
  );
}

function sanitizePartsForModel(parts: ChatRequestPart[]): unknown[] {
  const output: unknown[] = [];

  for (const part of parts) {
    if (!part || typeof part !== "object") {
      output.push(part);
      continue;
    }

    const candidate = part as ChatRequestPart & {
      type?: unknown;
      url?: unknown;
      mediaType?: unknown;
      filename?: unknown;
    };

    if (
      candidate.type === "file" &&
      typeof candidate.url === "string" &&
      candidate.url.startsWith("data:")
    ) {
      const mediaType = typeof candidate.mediaType === "string" ? candidate.mediaType : "application/octet-stream";
      const filename = typeof candidate.filename === "string" && candidate.filename.trim().length > 0
        ? candidate.filename.trim()
        : "attachment";

      if (isTextLikeMediaType(mediaType)) {
        const decoded = decodeDataUrlText(candidate.url);
        if (decoded && decoded.trim().length > 0) {
          const excerpt = decoded.slice(0, 12_000);
          output.push({
            type: "text",
            text: [`[Attached file: ${filename} (${mediaType})]`, excerpt].join("\n\n"),
          });
          continue;
        }
      }

      output.push({
        type: "text",
        text: `[Attached file: ${filename} (${mediaType}) was provided, but direct inline file URLs are not supported for this provider.]`,
      });
      continue;
    }

    output.push(part);
  }

  return output;
}

async function extractModelMessages(body: ChatRequestBody): Promise<ModelMessage[]> {
  if (body.messages && body.messages.length > 0) {
    const normalized = body.messages
      .map((message) => {
        const role = typeof message.role === "string" ? message.role : "user";

        // Preferred: UIMessage parts (text/file/tool/source/etc.)
        if (Array.isArray(message.parts) && message.parts.length > 0) {
          return { role, parts: sanitizePartsForModel(message.parts) };
        }

        // Compatibility: string content payloads
        if (typeof message.content === "string" && message.content.trim()) {
          return {
            role,
            parts: [{ type: "text", text: message.content }],
          };
        }

        // Compatibility: content blocks that contain text
        if (Array.isArray(message.content)) {
          const text = message.content
            .filter((block) => block.type === "text" && typeof block.text === "string")
            .map((block) => block.text as string)
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

function summarizeLastUserInput(body: ChatRequestBody): string | null {
  if (!body.messages) return null;

  const lastUserMessage = [...body.messages].reverse().find((message) => message.role === "user");
  if (!lastUserMessage) return null;

  // UIMessage format with parts supports file attachments.
  if (Array.isArray(lastUserMessage.parts)) {
    const text = lastUserMessage.parts
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text as string)
      .join("\n")
      .trim();

    const files = lastUserMessage.parts
      .filter((part) => part.type === "file")
      .map((part, index: number) =>
        typeof part.filename === "string" && part.filename.trim()
          ? part.filename.trim()
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

function getLastUserParts(body: ChatRequestBody): ChatRequestPart[] | undefined {
  if (!body.messages) return undefined;

  const lastUserMessage = [...body.messages].reverse().find((message) => message.role === "user");
  if (!lastUserMessage) return undefined;

  if (Array.isArray(lastUserMessage.parts) && lastUserMessage.parts.length > 0) {
    return lastUserMessage.parts;
  }

  if (typeof lastUserMessage.content === "string" && lastUserMessage.content.trim()) {
    return [{ type: "text", text: lastUserMessage.content.trim() }];
  }

  return undefined;
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
  let originalMessages: UIMessage[] | undefined;
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
    const rateLimit = await checkRateLimit({
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

    const rawBody = await req.json();
    const parsedBody = chatRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      const issue = parsedBody.error.issues[0];
      const issuePath = issue?.path?.length ? issue.path.join(".") : "body";
      logApiCompletion(requestContext, { status: 400, error: "invalid_request_body" });
      return jsonResponse(
        { error: `Invalid request body at ${issuePath}: ${issue?.message ?? "Request payload is malformed."}` },
        400,
        { "x-request-id": requestContext.requestId },
      );
    }

    const body = parsedBody.data;
    originalMessages = Array.isArray(body.messages) ? (body.messages as UIMessage[]) : undefined;
    if (DEBUG_CHAT_LOGS) {
      console.log("[chat] body keys:", JSON.stringify(Object.keys(body)));
    }

    const modelMessages = await extractModelMessages(body);
    if (DEBUG_CHAT_LOGS) {
      console.log("[chat] extracted model messages:", modelMessages.length);
    }

    const textMsgs = extractTextMessages(body);
    const summarizedUserInput = summarizeLastUserInput(body);
    const lastUserParts = getLastUserParts(body);

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
    const requestedBuilderTarget = normalizeBuilderTarget(body.builderTarget);
    const requestedBuilderLocks = normalizeBuilderLocks(body.builderLocks ?? DEFAULT_BUILDER_LOCKS);
    const builderSession = normalizeBuilderSession(body.builderSession);
    const userCustomization = normalizeUserProfile(body.userCustomization);
    const preferVision = requestHasImageInput(body);
    const webSearchRequested = body.webSearch === true;
    const killerId = body.killerId as string | undefined;
    const killer = killerId ? KILLERS.find((k) => k.id === killerId) ?? null : null;
    const policyWarnings: string[] = [];
    const inferredCanvasBuildIntent = isCanvasBuildIntent(summarizedUserInput ?? textMsgs.at(-1)?.content ?? null);
    const requestedCanvasBuildIntent = requestedBuilderTarget !== "auto";

    const webSearchPermission = killer
      ? evaluatePermissionDecision(killer.executionPolicy.permissions.webSearch, {
          explicitUserCheckpoint: webSearchRequested,
          label: "Web search",
        })
      : { allowed: true, requiresCheckpoint: false, reason: null };

    const externalNetworkPermission = killer
      ? evaluatePermissionDecision(killer.executionPolicy.permissions.externalNetwork, {
          explicitUserCheckpoint: webSearchRequested,
          label: "External network access",
        })
      : { allowed: true, requiresCheckpoint: false, reason: null };

    const builderPermission = killer
      ? evaluatePermissionDecision(killer.executionPolicy.permissions.builderActions, {
          explicitUserCheckpoint: requestedCanvasBuildIntent,
          label: "Builder actions",
        })
      : { allowed: true, requiresCheckpoint: false, reason: null };

    const effectiveWebSearchRequested =
      webSearchRequested && webSearchPermission.allowed && externalNetworkPermission.allowed;
    const canvasBuildIntent = builderPermission.allowed && (requestedCanvasBuildIntent || inferredCanvasBuildIntent);

    for (const permission of [webSearchPermission, externalNetworkPermission]) {
      if (permission.reason && webSearchRequested) {
        policyWarnings.push(permission.reason);
      }
    }

    if (builderPermission.reason && (requestedCanvasBuildIntent || inferredCanvasBuildIntent)) {
      policyWarnings.push(builderPermission.reason);
    }

    const sandboxStatus = killer
      ? await getSandboxProviderStatus(killer.executionPolicy)
      : null;

    const sandboxExecutionPermission = killer
      ? evaluatePermissionDecision(killer.executionPolicy.permissions.sandboxExecution, {
          explicitUserCheckpoint: false,
          label: "Code execution",
        })
      : { allowed: false, requiresCheckpoint: false, reason: null };

    const canRunCode =
      sandboxExecutionPermission.allowed &&
      isSandboxEnabled() &&
      !canvasBuildIntent;

    if (sandboxStatus?.reason) {
      policyWarnings.push(sandboxStatus.reason);
    }

    const entitlement = shouldPersist
      ? await resolveUserEntitlements({ userId, email: userEmail })
      : null;
    const hasPaidAccess = shouldPersist && Boolean(entitlement?.canUsePaidModes);

    // Guest users are limited to free mode; auth is required for think/pro tiers.
    if (!shouldPersist && selectedMode !== "fast") {
      logApiCompletion(requestContext, { status: 401, error: "auth_required_mode" });
      return jsonResponse({ error: "Sign in to use Think and Pro modes." }, 401, {
        "x-request-id": requestContext.requestId,
      });
    }

    if (effectiveWebSearchRequested && !shouldPersist) {
      logApiCompletion(requestContext, { status: 401, error: "auth_required_web_search" });
      return jsonResponse({ error: "Sign in to use web search." }, 401, {
        "x-request-id": requestContext.requestId,
      });
    }

    if (effectiveWebSearchRequested && !isWebSearchConfigured()) {
      logApiCompletion(requestContext, { status: 503, error: "web_search_not_configured" });
      return jsonResponse({ error: "Web search is not configured yet." }, 503, {
        "x-request-id": requestContext.requestId,
      });
    }

    if (effectiveWebSearchRequested && shouldPersist) {
      const freeDailySearches = Number(process.env.WEB_SEARCH_DAILY_REQUESTS_FREE ?? "20");
      const paidDailySearches = Number(process.env.WEB_SEARCH_DAILY_REQUESTS_PAID ?? "100");
      const dailySearchLimit = hasPaidAccess ? paidDailySearches : freeDailySearches;

      const searchQuota = await checkRateLimit({
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
    if (shouldPersist && selectedMode !== "fast") {
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

    const baseSystemPrompt = killer ? killer.systemPrompt : SYSTEM_PROMPT;
    const systemPromptParts = [baseSystemPrompt, RESPONSE_STYLE_PROMPT];

    if (killer) {
      systemPromptParts.push(buildExecutionPolicyGuidance(killer.executionPolicy));

      const sandboxRuntimeNote = sandboxStatus ? buildSandboxProviderRuntimeNote(sandboxStatus) : null;
      if (sandboxRuntimeNote) {
        systemPromptParts.push(["Sandbox runtime status:", sandboxRuntimeNote].join("\n"));
      }
    }

    const userCustomizationPrompt = buildUserCustomizationPrompt(userCustomization);
    if (userCustomizationPrompt) {
      systemPromptParts.push(userCustomizationPrompt);
    }

    if (policyWarnings.length > 0) {
      systemPromptParts.push(
        [
          "Execution policy notes:",
          ...policyWarnings.map((warning) => `- ${warning}`),
          "Do not claim that blocked actions were executed. Continue with the best answer possible within policy.",
        ].join("\n")
      );
    }

    if (effectiveWebSearchRequested) {
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

    if (canvasBuildIntent) {
      systemPromptParts.push(
        buildCanvasArtifactPrompt(summarizedUserInput ?? textMsgs.at(-1)?.content ?? null, requestedBuilderTarget)
      );

      const iterationPrompt = buildIterationConstraintsPrompt(requestedBuilderLocks, builderSession);
      if (iterationPrompt) {
        systemPromptParts.push(iterationPrompt);
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
        await saveMessage({ chatId: id, role: "user", content: persistedUserContent, parts: lastUserParts });

        const userTurnCount = Array.isArray(body.messages)
          ? body.messages.filter((message) => message.role === "user").length
          : textMsgs.filter((m) => m.role === "user").length;

        if (userTurnCount === 1) {
          await updateChatTitle(id, persistedUserContent.slice(0, 60));
        }
      }
    }

    const resolvedModel = await getModel(selectedMode, preferVision);

    if (canvasBuildIntent && TWO_PASS_BUILDER_ENABLED) {
      const stream = buildTwoPassBuilderStream({
        originalMessages,
        userInput: summarizedUserInput ?? textMsgs.at(-1)?.content ?? null,
        requestedBuilderTarget,
        model: resolvedModel.model,
        modelId: resolvedModel.modelId,
        provider: resolvedModel.provider,
        modelMessages,
        systemPrompt,
        qualityRetryThreshold: BUILDER_QUALITY_RETRY_THRESHOLD,
        shouldPersist,
        userId: shouldPersist ? userId : undefined,
        chatId: shouldPersist ? id : undefined,
        selectedMode,
      });

      logApiCompletion(requestContext, { status: 200 });
      return withRequestHeaders(
        createUIMessageStreamResponse({ stream }),
        requestContext.requestId,
      );
    }

    const result = streamText({
      model: resolvedModel.model,
      system: systemPrompt,
      messages: modelMessages,
      ...(canRunCode ? { tools: { run_code: buildRunCodeTool() } } : {}),
      stopWhen: stepCountIs(canRunCode ? 10 : 5),
      onFinish: async ({ text, totalUsage, providerMetadata }) => {
        if (canvasBuildIntent) {
          const artifact = parseBuilderArtifact(text ?? "");
          safeRecordBuilderMetric({
            parseSuccess: Boolean(artifact),
            artifactType: artifact?.type,
            requestedTarget: requestedBuilderTarget,
          });
        }

        const persistedText = (text ?? "").trim();

        if (persistedText && shouldPersist) {
          await saveMessage({
            chatId: id,
            role: "assistant",
            content: persistedText,
            parts: [{ type: "text", text: persistedText }],
          });
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
    return withRequestHeaders(
      result.toUIMessageStreamResponse({
        originalMessages,
        onError: error => (error instanceof Error ? error.message : "Chat stream failed"),
      }),
      requestContext.requestId,
    );
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("aborted")) {
      logApiCompletion(requestContext, { status: 499, error: "client_aborted" });
      return withRequestHeaders(
        new Response("", {
          status: 499,
          statusText: "Client Closed Request",
        }),
        requestContext.requestId,
      );
    }

    const message =
      error instanceof Error ? error.message : "Internal server error";
    console.error("[chat] error:", error instanceof Error ? error.stack : error);
    logApiCompletion(requestContext, { status: 500, error: message });
    return jsonResponse({ error: message }, 500, {
      "x-request-id": requestContext.requestId,
    });
  }
}
