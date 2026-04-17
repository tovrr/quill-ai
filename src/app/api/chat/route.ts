import {
  createUIMessageStreamResponse,
  streamText,
  stepCountIs,
  type UIMessage,
} from "ai";
import { tool, jsonSchema } from "ai";
import { executeCode, isExecutionAvailable, getExecutionBackend } from "@/lib/execution/service";
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
} from "@/lib/db-helpers";
import { recordModelUsage } from "@/lib/model-usage";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildWebSearchContext, searchWeb } from "@/lib/web-search";
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
import { NON_RENDERABLE_ASSISTANT_FALLBACK_TEXT } from "@/lib/ai/assistant-message-utils";
import { buildExecutionPolicyGuidance } from "@/lib/ai/killer-autonomy";
import { buildSandboxProviderRuntimeNote } from "@/lib/execution/providers";
import { buildTwoPassBuilderStream } from "@/lib/chat/two-pass-builder";
import {
  extractTextMessages,
  extractModelMessages,
  getLastUserParts,
  parseChatRequestBody,
  requestHasImageInput,
  summarizeLastUserInput,
} from "@/lib/chat/request-utils";
import { resolveModelForMode, type ChatMode } from "@/lib/chat/model-selection";
import { evaluateChatAccess } from "@/lib/chat/access-gates";
import { evaluatePolicyRuntime } from "@/lib/chat/policy-runtime";

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
    const parsedBody = parseChatRequestBody(rawBody);
    if (!parsedBody.success) {
      logApiCompletion(requestContext, { status: 400, error: "invalid_request_body" });
      return jsonResponse(
        { error: `Invalid request body at ${parsedBody.issuePath}: ${parsedBody.message}` },
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
    const selectedMode: ChatMode = (body.mode as ChatMode) || "advanced";
    const requestedBuilderTarget = normalizeBuilderTarget(body.builderTarget);
    const requestedBuilderLocks = normalizeBuilderLocks(body.builderLocks ?? DEFAULT_BUILDER_LOCKS);
    const builderSession = normalizeBuilderSession(body.builderSession);
    const userCustomization = normalizeUserProfile(body.userCustomization);
    const preferVision = requestHasImageInput(body);
    const webSearchRequested = body.webSearch === true;
    const killerId = body.killerId as string | undefined;
    const inferredCanvasBuildIntent = isCanvasBuildIntent(summarizedUserInput ?? textMsgs.at(-1)?.content ?? null);
    const requestedCanvasBuildIntent = requestedBuilderTarget !== "auto";

    const policyRuntime = await evaluatePolicyRuntime({
      killerId,
      webSearchRequested,
      requestedCanvasBuildIntent,
      inferredCanvasBuildIntent,
    });

    const killer = policyRuntime.killer;
    const policyWarnings = policyRuntime.policyWarnings;
    const effectiveWebSearchRequested = policyRuntime.effectiveWebSearchRequested;
    const canvasBuildIntent = policyRuntime.canvasBuildIntent;
    const sandboxStatus = policyRuntime.sandboxStatus;
    const canRunCode = policyRuntime.canRunCode;

    const access = await evaluateChatAccess({
      userId,
      userEmail,
      shouldPersist,
      selectedMode,
      effectiveWebSearchRequested,
    });

    if (access.failure) {
      logApiCompletion(requestContext, { status: access.failure.status, error: access.failure.errorCode });
      return jsonResponse({ error: access.failure.message }, access.failure.status, {
        "x-request-id": requestContext.requestId,
      });
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

    const resolvedModel = await resolveModelForMode(selectedMode, preferVision);

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
