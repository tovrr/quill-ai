"use client";

export const dynamic = "force-dynamic";

import { Suspense, useCallback, useRef, useEffect, useState, useMemo } from "react";
import dynamicImport from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  ArrowPathIcon,
  Bars3Icon,
  ExclamationCircleIcon,
  PencilSquareIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { Sidebar } from "@/components/layout/Sidebar";
import { AccountMenu } from "@/components/layout/AccountMenu";
import {
  AgentStatusBar,
  getAgentStatusColor,
  getAgentStatusMessage,
  type AgentStatus,
} from "@/components/agent/AgentStatusBar";
import { QuillLogo } from "@/components/ui/QuillLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TaskInput, type Mode } from "@/components/agent/TaskInput";
import { RealMessageBubble } from "@/components/agent/RealMessageBubble";
import { isCanvasRenderableContent, isHTMLContent } from "@/components/agent/canvas-utils";
import {
  buildAssistantFallbackMessage,
  extractTextFromMessageParts,
  getMessageParts,
  hasRenderableAssistantContent,
  normalizeAssistantMessage,
} from "@/lib/ai/assistant-message-utils";
import { getKillerById, type Killer } from "@/lib/ai/killers";
import type { BuilderLocks, BuilderSessionContext, BuilderTarget } from "@/lib/builder/artifacts";
import { DEFAULT_BUILDER_LOCKS, parseBuilderArtifact } from "@/lib/builder/artifacts";
import {
  DEFAULT_USER_PROFILE,
  normalizeUserProfile,
  type UserInstructionProfile,
} from "@/lib/extensions/customization";
import { loadAppSettings, saveAppSettings, type AppSettings } from "@/lib/ui-settings";
import { getUiVariant, trackUiEvent } from "@/lib/ui-experiments";

const GUEST_SESSION_KEY = "quill_guest_active_session_v1";
const GUEST_SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24;
const ASSISTANT_STREAM_WATCHDOG_MS = 90000;
const HOMEPAGE_FILE_HANDOFF_PREFIX = "quill_home_file_handoff_v1:";
const GUEST_CHAT_TITLE_PREFIX = "quill_guest_chat_title_v1:";
const MESSAGE_WINDOW_SIZE = 40;
const MESSAGE_WINDOW_INCREMENT = 40;

const CanvasPanel = dynamicImport(() => import("@/components/agent/CanvasPanel").then((mod) => mod.CanvasPanel), {
  loading: () => (
    <div className="flex h-full w-full items-center justify-center border-l border-quill-border bg-quill-bg text-sm text-quill-muted">
      Loading canvas...
    </div>
  ),
});

type StoredGuestSession = {
  chatId: string;
  messages: UIMessage[];
  selectedMode: Mode;
  updatedAt: number;
};

type ImportableMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  parts?: unknown[];
};

type PersistedMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  partsJson?: unknown;
};

type UiPersistedMessage = PersistedMessage & {
  role: "user" | "assistant" | "system";
};

type HomepageFileHandoffPayload = {
  name: string;
  type: string;
  lastModified: number;
  dataUrl: string;
};

function dataUrlToFile(payload: HomepageFileHandoffPayload): File | null {
  const match = payload.dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) return null;

  const [, mediaType, base64] = match;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new File([bytes], payload.name, {
    type: payload.type || mediaType || "application/octet-stream",
    lastModified: payload.lastModified || Date.now(),
  });
}

function toUiMessages(messages: PersistedMessage[]): UIMessage[] {
  return messages
    .filter(
      (message): message is UiPersistedMessage =>
        message.role === "user" || message.role === "assistant" || message.role === "system",
    )
    .map((message) => {
      const uiMessage = {
        id: message.id,
        role: message.role,
        parts:
          Array.isArray(message.partsJson) && message.partsJson.length > 0
            ? (message.partsJson as UIMessage["parts"])
            : ([{ type: "text", text: message.content }] as UIMessage["parts"]),
      } satisfies UIMessage;

      return uiMessage.role === "assistant" ? normalizeAssistantMessage(uiMessage) : uiMessage;
    });
}

function readGuestSession(): StoredGuestSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GUEST_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredGuestSession;
    if (!parsed?.chatId || !Array.isArray(parsed.messages) || !parsed.updatedAt) {
      return null;
    }
    if (Date.now() - parsed.updatedAt > GUEST_SESSION_MAX_AGE_MS) {
      localStorage.removeItem(GUEST_SESSION_KEY);
      return null;
    }
    const normalizedMessages = parsed.messages
      .map((message) => {
        if (!message || typeof message !== "object") return null;

        const candidate = message as {
          id?: unknown;
          role?: unknown;
          parts?: unknown;
          content?: unknown;
        };

        if (candidate.role !== "user" && candidate.role !== "assistant" && candidate.role !== "system") {
          return null;
        }

        const normalizedMessage = {
          id: typeof candidate.id === "string" && candidate.id.trim().length > 0 ? candidate.id : crypto.randomUUID(),
          role: candidate.role,
          parts: getMessageParts({ parts: candidate.parts, content: candidate.content }),
        } satisfies UIMessage;

        return normalizedMessage.role === "assistant"
          ? normalizeAssistantMessage(normalizedMessage)
          : normalizedMessage;
      })
      .filter((message): message is UIMessage => message !== null);

    return {
      ...parsed,
      messages: normalizedMessages,
    };
  } catch {
    return null;
  }
}

function writeGuestSession(session: StoredGuestSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage quota/privacy mode failures
  }
}

function clearGuestSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(GUEST_SESSION_KEY);
  } catch {
    // Ignore storage failures
  }
}

function toImportableMessages(messages: UIMessage[]): ImportableMessage[] {
  return messages
    .map((message) => {
      const role = (message as { role?: unknown }).role;
      if (role !== "user" && role !== "assistant" && role !== "system" && role !== "tool") {
        return null;
      }

      const normalizedMessage =
        role === "assistant" ? normalizeAssistantMessage(message) : { ...message, parts: getMessageParts(message) };

      const content = extractTextFromMessageParts(normalizedMessage.parts as unknown[]);

      if (!content && normalizedMessage.parts.length === 0) return null;
      return { role, content, parts: normalizedMessage.parts } as ImportableMessage;
    })
    .filter((item): item is ImportableMessage => Boolean(item));
}

// Read URL search params safely on the client
function getSearchParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}

function isLikelyCanvasBuildIntent(input: string | null): boolean {
  if (!input) return false;
  const lower = input.toLowerCase();
  const buildWords = ["build", "create", "make", "design", "generate"];
  const previewTargets = [
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
    "nextjs",
    "react",
    "tailwind",
    "artifact",
    "doc",
    "docs",
    "document",
    "report",
    "slides",
    "deck",
    "sheet",
    "spreadsheet",
    "table",
  ];

  return buildWords.some((word) => lower.includes(word)) && previewTargets.some((word) => lower.includes(word));
}

function isLikelyCodeTaskIntent(input: string | null): boolean {
  if (!input) return false;
  const lower = input.toLowerCase();
  const codeWords = [
    "code",
    "function",
    "class",
    "component",
    "script",
    "bug",
    "fix",
    "debug",
    "refactor",
    "typescript",
    "javascript",
    "python",
    "sql",
    "api",
    "endpoint",
  ];

  return codeWords.some((word) => lower.includes(word));
}

function looksLikeCodeStream(text: string): boolean {
  return /```[a-zA-Z]*|\b(import|export|const|let|var|function|class|interface|type|def|async|await|from|SELECT|INSERT|UPDATE|CREATE TABLE)\b/.test(
    text,
  );
}

function extractMessageText(message: UIMessage): string {
  return extractTextFromMessageParts(getMessageParts(message) as unknown[]);
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function canonicalizeAssistantForDisplay(message: UIMessage): UIMessage {
  const normalized = normalizeAssistantMessage({
    ...message,
    parts: getMessageParts(message),
  });

  if (hasRenderableAssistantContent(normalized)) {
    return normalized;
  }

  const fallbackText = extractTextFromMessageParts(getMessageParts(normalized) as unknown[]);
  if (fallbackText.length === 0) return normalized;

  return {
    ...normalized,
    role: "assistant",
    parts: [{ type: "text", text: fallbackText }] as UIMessage["parts"],
  };
}

function replaceOrAppendAssistantFallback(prev: UIMessage[], text: string): UIMessage[] {
  const last = prev[prev.length - 1];
  if (last?.role === "assistant") {
    if (hasRenderableAssistantContent(last)) {
      return prev;
    }

    return [...prev.slice(0, -1), buildAssistantFallbackMessage(text, last)];
  }

  return [...prev, buildAssistantFallbackMessage(text)];
}

export default function AgentPage() {
  const router = useRouter();

  // Initialise chatId from URL or generate new
  const [urlChatId] = useState(() => getSearchParam("chat"));
  const [chatId] = useState(() => urlChatId ?? readGuestSession()?.chatId ?? crypto.randomUUID());

  // Active killer agent (from URL ?killer=id)
  const [killer, setKiller] = useState<Killer | null>(null);

  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");
  const [selectedMode, setSelectedMode] = useState<Mode>("fast");
  // Always use 'auto' builder target for no/low-code users
  const builderTarget: BuilderTarget = "auto";
  const setBuilderTarget = () => {};
  const [builderLocks, setBuilderLocks] = useState<BuilderLocks>(DEFAULT_BUILDER_LOCKS);
  const [recentRefinements, setRecentRefinements] = useState<string[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [canUsePaidModes, setCanUsePaidModes] = useState(false);
  const [planLabel, setPlanLabel] = useState("Free");
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [webSearchState, setWebSearchState] = useState<"available" | "auth-required" | "coming-soon">("coming-soon");
  const [canvasMode, setCanvasMode] = useState(false);
  const [canvasContent, setCanvasContent] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [activeTaskTitle, setActiveTaskTitle] = useState<string | undefined>(undefined);
  const [statusStepCount, setStatusStepCount] = useState<number | undefined>(undefined);
  const [chatTitle, setChatTitle] = useState("New chat");
  const [isEditingChatTitle, setIsEditingChatTitle] = useState(false);
  const [chatTitleDraft, setChatTitleDraft] = useState("New chat");
  const [isSavingChatTitle, setIsSavingChatTitle] = useState(false);
  const [initialComposerDraft, setInitialComposerDraft] = useState("");
  const [initialHomepageFile, setInitialHomepageFile] = useState<File | null>(null);
  const [isDraftReview, setIsDraftReview] = useState(false);
  const [streamClockMs, setStreamClockMs] = useState(0);

  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [guestImportStatus, setGuestImportStatus] = useState<"idle" | "importing" | "done" | "error">("idle");
  const [isMounted, setIsMounted] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [uiSettings, setUiSettings] = useState<AppSettings>(() => loadAppSettings());
  const [historyWindowState, setHistoryWindowState] = useState<{ chatId: string; expandedCount: number }>({
    chatId,
    expandedCount: 0,
  });
  const [statusBarCollapsed, setStatusBarCollapsed] = useState(false);
  const activeKiller = isMounted ? killer : null;

  const artifact = useMemo(() => parseBuilderArtifact(canvasContent), [canvasContent]);
  // builderTarget is always 'auto', so only check for HTML content
  const canUsePageRefineActions = isHTMLContent(canvasContent);

  const allowedModes: Mode[] = canUsePaidModes ? ["fast", "thinking", "advanced"] : ["fast"];
  const isTrialPlan = planLabel.toLowerCase().startsWith("trial") || trialDaysLeft !== null;

  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRequestRef = useRef<number | null>(null);
  const streamStartRef = useRef<number | null>(null);
  const guestSessionRestoredRef = useRef(false);
  const guestSessionImportTriedRef = useRef(false);
  const manualStopRef = useRef(false);
  const awaitingAssistantRef = useRef(false);
  const pendingAssistantSinceRef = useRef<number | null>(null);
  const chatTitleInputRef = useRef<HTMLInputElement>(null);
  const historyExpansionScrollRef = useRef<{ previousScrollHeight: number; previousScrollTop: number } | null>(null);
  const streamTelemetryRef = useRef<{
    startedAt: number | null;
    firstAssistantAt: number | null;
    firstRenderableAt: number | null;
  }>({
    startedAt: null,
    firstAssistantAt: null,
    firstRenderableAt: null,
  });

  // Refs for transport (stable, avoid re-creating)
  const modeRef = useRef<Mode>(selectedMode);
  const builderTargetRef = useRef<BuilderTarget>(builderTarget);
  const builderLocksRef = useRef<BuilderLocks>(builderLocks);
  const builderSessionRef = useRef<BuilderSessionContext>({});
  const killerRef = useRef<string | null>(killer?.id ?? null);
  const userProfileRef = useRef<UserInstructionProfile>(DEFAULT_USER_PROFILE);
  const webSearchRef = useRef(webSearchEnabled);
  useEffect(() => {
    modeRef.current = selectedMode;
  }, [selectedMode]);
  useEffect(() => {
    builderTargetRef.current = builderTarget;
  }, [builderTarget]);
  useEffect(() => {
    builderLocksRef.current = builderLocks;
  }, [builderLocks]);
  useEffect(() => {
    webSearchRef.current = webSearchEnabled;
  }, [webSearchEnabled]);
  useEffect(() => {
    killerRef.current = killer?.id ?? null;
  }, [killer]);

  useEffect(() => {
    const id = getSearchParam("killer");
    setKiller(id ? (getKillerById(id) ?? null) : null);
  }, []);

  useEffect(() => {
    const handoffId = getSearchParam("hf");
    if (!handoffId) return;

    const q = getSearchParam("q");
    if (q) {
      setInitialComposerDraft(q);
    }

    try {
      const raw = sessionStorage.getItem(`${HOMEPAGE_FILE_HANDOFF_PREFIX}${handoffId}`);
      if (!raw) return;

      const parsed = JSON.parse(raw) as HomepageFileHandoffPayload;
      if (!parsed?.name || !parsed?.dataUrl) return;

      const file = dataUrlToFile(parsed);
      if (file) {
        setInitialHomepageFile(file);
      }
    } catch {
      // Ignore malformed handoff payloads.
    } finally {
      sessionStorage.removeItem(`${HOMEPAGE_FILE_HANDOFF_PREFIX}${handoffId}`);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedTitle = localStorage.getItem(`${GUEST_CHAT_TITLE_PREFIX}${chatId}`);
    if (savedTitle && savedTitle.trim()) {
      setChatTitle(savedTitle.trim());
      setChatTitleDraft(savedTitle.trim());
    }
  }, [chatId]);

  useEffect(() => {
    if (!isEditingChatTitle) return;
    chatTitleInputRef.current?.focus();
    chatTitleInputRef.current?.select();
  }, [isEditingChatTitle]);

  // Pre-fill composer from ?draft= param without auto-sending (used by QuillClaw shortcuts)
  useEffect(() => {
    const draft = getSearchParam("draft");
    if (!draft) return;
    setInitialComposerDraft(draft);
    setIsDraftReview(true);
  }, []);

  // Load persistent user customization profile from settings storage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const loaded = loadAppSettings();
      userProfileRef.current = normalizeUserProfile(loaded.instructionProfile);
      setUiSettings(loaded);

      const variant = getUiVariant();
      const raw = localStorage.getItem("quill-settings");
      const parsed = raw ? (JSON.parse(raw) as Partial<AppSettings>) : null;
      const hasConversationLayout = parsed && typeof parsed.conversationLayout === "string";
      if (!hasConversationLayout && variant === "workspace-default") {
        const next = { ...loaded, conversationLayout: "workspace" as const };
        saveAppSettings(next);
        setUiSettings(next);
      }

      trackUiEvent("agent_page_open", {
        conversationLayout: loaded.conversationLayout,
        focusMode: loaded.focusMode,
      });
    } catch {
      userProfileRef.current = DEFAULT_USER_PROFILE;
    }
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "quill-settings") return;
      const loaded = loadAppSettings();
      setUiSettings(loaded);
      userProfileRef.current = normalizeUserProfile(loaded.instructionProfile);
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    builderSessionRef.current = {
      lastArtifactType: artifact?.type,
      lastArtifactTitle: artifact?.title,
      recentRefinements,
    };
  }, [artifact, recentRefinements]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ body, id, messages }) => ({
          body: {
            ...(body ?? {}),
            messages,
            chatId: id,
            mode: modeRef.current,
            builderTarget: builderTargetRef.current,
            builderLocks: builderLocksRef.current,
            builderSession: builderSessionRef.current,
            userCustomization: userProfileRef.current,
            webSearch: webSearchRef.current,
            ...(killerRef.current ? { killerId: killerRef.current } : {}),
          },
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, setMessages, stop } = useChat({
    transport,
    id: chatId,
    onError: (error: unknown) => {
      streamTelemetryRef.current = {
        startedAt: null,
        firstAssistantAt: null,
        firstRenderableAt: null,
      };
      awaitingAssistantRef.current = false;
      pendingAssistantSinceRef.current = null;
      if (manualStopRef.current) {
        manualStopRef.current = false;
        setAgentStatus("idle");
        return;
      }

      const message = error instanceof Error ? error.message.toLowerCase() : "";
      const isAbort = message.includes("aborted") || message.includes("aborterror") || message.includes("networkerror");

      if (isAbort) {
        setMessages((prev: UIMessage[]) => {
          const last = prev[prev.length - 1];
          if (hasRenderableAssistantContent(last)) return prev;

          return replaceOrAppendAssistantFallback(prev, "Request interrupted before completion. Please retry.");
        });
        setAgentStatus("idle");
        return;
      }

      const userFacingError =
        error instanceof Error && error.message.trim().length > 0
          ? error.message.trim()
          : "The assistant ran into an error before completing the response.";

      setPageError(userFacingError);

      setMessages((prev: UIMessage[]) => {
        const last = prev[prev.length - 1];
        const shouldAppend = !hasRenderableAssistantContent(last);
        if (!shouldAppend) return prev;

        return replaceOrAppendAssistantFallback(prev, `I hit an error while responding: ${userFacingError}`);
      });
      setAgentStatus("error");
    },
  });
  const displayMessages = useMemo(
    () =>
      messages
        .filter((message) => (message as { role?: string }).role !== "tool")
        .map((message) =>
          message.role === "assistant"
            ? canonicalizeAssistantForDisplay(message)
            : { ...message, parts: getMessageParts(message) },
        ),
    [messages],
  );
  const expandedHistoryCount = historyWindowState.chatId === chatId ? historyWindowState.expandedCount : 0;
  const visibleMessageCount = Math.min(displayMessages.length, MESSAGE_WINDOW_SIZE + expandedHistoryCount);
  const hiddenMessageCount = Math.max(0, displayMessages.length - visibleMessageCount);
  const visibleMessages = useMemo(
    () => (hiddenMessageCount > 0 ? displayMessages.slice(hiddenMessageCount) : displayMessages),
    [displayMessages, hiddenMessageCount],
  );
  const lastAssistantMessageId = useMemo(() => {
    const lastAssistant = [...displayMessages].reverse().find((message) => message.role === "assistant");
    return lastAssistant?.id ?? null;
  }, [displayMessages]);
  const hasActiveAssistantMessage = Boolean(
    messages[messages.length - 1] && messages[messages.length - 1]?.role === "assistant",
  );
  const isLoading = status === "streaming" || status === "submitted";
  const activeToolNames = useMemo(() => {
    const latestAssistant = [...displayMessages].reverse().find((message) => message.role === "assistant");
    if (!latestAssistant) return [] as string[];

    const parts = getMessageParts(latestAssistant);
    const names: string[] = [];
    for (const part of parts) {
      const candidate = part as Record<string, unknown>;
      const type = typeof candidate.type === "string" ? candidate.type : "";
      const isToolPart = type === "dynamic-tool" || type.startsWith("tool-");
      if (!isToolPart) continue;

      const state = typeof candidate.state === "string" ? candidate.state.trim().toLowerCase() : "";
      const isActive = state === "input-streaming" || state === "input-available" || state === "call";
      if (!isActive) continue;

      const rawName = typeof candidate.toolName === "string" ? candidate.toolName : type.replace(/^tool-/, "");
      const label = rawName.trim();
      if (!label || names.includes(label)) continue;
      names.push(label);
    }

    return names;
  }, [displayMessages]);

  useEffect(() => {
    const pendingExpansion = historyExpansionScrollRef.current;
    if (!pendingExpansion) return;

    const container = messagesContainerRef.current;
    if (!container) return;

    const frame = requestAnimationFrame(() => {
      const nextScrollHeight = container.scrollHeight;
      const scrollDelta = nextScrollHeight - pendingExpansion.previousScrollHeight;
      container.scrollTop = pendingExpansion.previousScrollTop + scrollDelta;
      historyExpansionScrollRef.current = null;
    });

    return () => cancelAnimationFrame(frame);
  }, [visibleMessages]);

  const sendMessageTracked = useCallback(
    (payload: { text: string; files?: FileList }) => {
      setPageError(null);
      awaitingAssistantRef.current = true;
      pendingAssistantSinceRef.current = Date.now();
      streamTelemetryRef.current = {
        startedAt: performance.now(),
        firstAssistantAt: null,
        firstRenderableAt: null,
      };
      sendMessage(payload);
    },
    [sendMessage],
  );

  useEffect(() => {
    if (!awaitingAssistantRef.current) return;

    const timer = window.setTimeout(() => {
      if (!awaitingAssistantRef.current) return;
      const startedAt = pendingAssistantSinceRef.current;
      if (!startedAt) return;

      const elapsed = Date.now() - startedAt;
      if (elapsed < ASSISTANT_STREAM_WATCHDOG_MS) return;

      awaitingAssistantRef.current = false;
      pendingAssistantSinceRef.current = null;
      manualStopRef.current = true;
      stop();

      setMessages((prev: UIMessage[]) => {
        const tail = prev[prev.length - 1];
        if (tail?.role === "assistant" && hasRenderableAssistantContent(tail)) return prev;

        return replaceOrAppendAssistantFallback(
          prev,
          "The response stream timed out before rendering in the browser. Please retry. If it repeats, refresh the page and disable extensions for localhost.",
        );
      });
      setAgentStatus("error");
    }, ASSISTANT_STREAM_WATCHDOG_MS);

    return () => window.clearTimeout(timer);
  }, [messages, setMessages, status, stop]);

  // Auto-send task from ?q= query param (e.g. from homepage hero input)
  const heroTaskFiredRef = useRef(false);
  useEffect(() => {
    if (heroTaskFiredRef.current) return;
    if (getSearchParam("hf")) return;
    if (getSearchParam("draft")) return;
    const q = getSearchParam("q");
    if (!q) return;
    heroTaskFiredRef.current = true;
    // Small delay so useChat transport is initialised
    setTimeout(() => {
      setAgentStatus("thinking");
      sendMessageTracked({ text: q });
    }, 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve client entitlements to gate mode options for guest/free users.
  useEffect(() => {
    const loadEntitlements = async () => {
      try {
        const res = await fetch("/api/me/entitlements", { cache: "no-store" });
        if (!res.ok) {
          setIsAuthenticated(false);
          setCanUsePaidModes(false);
          setPlanLabel("Free");
          setTrialDaysLeft(null);
          setWebSearchState("coming-soon");
          if (res.status >= 500) {
            setPageError(
              "Could not verify your account status. Paid features may be shown conservatively until retry.",
            );
          }
          return;
        }
        const data = (await res.json()) as {
          authenticated?: boolean;
          canUsePaidModes?: boolean;
          planLabel?: string;
          trialDaysLeft?: number;
          webSearchState?: "available" | "auth-required" | "coming-soon";
        };
        setIsAuthenticated(Boolean(data.authenticated));
        setCanUsePaidModes(Boolean(data.canUsePaidModes));
        setPlanLabel(data.planLabel ?? (data.canUsePaidModes ? "Paid access" : "Free"));
        setTrialDaysLeft(typeof data.trialDaysLeft === "number" ? data.trialDaysLeft : null);
        setWebSearchState(data.webSearchState ?? "coming-soon");
      } catch {
        setIsAuthenticated(false);
        setCanUsePaidModes(false);
        setPlanLabel("Free");
        setTrialDaysLeft(null);
        setWebSearchState("coming-soon");
        setPageError("Could not verify your account status. Check your connection and try again.");
      } finally {
        setAuthResolved(true);
      }
    };

    void loadEntitlements();
  }, []);

  // Restore one active guest session on first load.
  useEffect(() => {
    if (!authResolved || isAuthenticated || guestSessionRestoredRef.current) return;
    guestSessionRestoredRef.current = true;

    const stored = readGuestSession();
    if (!stored || stored.messages.length === 0) return;
    if (messages.length > 0) return;

    setMessages(stored.messages);
    if (stored.selectedMode === "fast") {
      setSelectedMode("fast");
    }
  }, [authResolved, isAuthenticated, messages.length, setMessages]);

  // Load persisted user chat when opening /agent?chat=<id> from history.
  useEffect(() => {
    if (!authResolved || !isAuthenticated || !urlChatId) return;
    if (messages.length > 0) return;

    let cancelled = false;

    const loadChat = async () => {
      try {
        const response = await fetch(`/api/chats/${chatId}`, { cache: "no-store" });
        if (!response.ok) {
          if (!cancelled) {
            setPageError("Failed to load this conversation. Refresh and try again.");
          }
          return;
        }

        const payload = (await response.json()) as { messages?: PersistedMessage[]; chat?: { title?: string } };
        if (cancelled || !Array.isArray(payload.messages) || payload.messages.length === 0) return;

        setPageError(null);
        if (typeof payload.chat?.title === "string" && payload.chat.title.trim()) {
          setChatTitle(payload.chat.title.trim());
          setChatTitleDraft(payload.chat.title.trim());
        }
        setMessages(toUiMessages(payload.messages));
      } catch {
        if (!cancelled) {
          setPageError("Failed to load this conversation. Check your connection and try again.");
        }
      }
    };

    void loadChat();

    return () => {
      cancelled = true;
    };
  }, [authResolved, isAuthenticated, urlChatId, chatId, messages.length, setMessages]);

  // Persist exactly one active guest conversation locally.
  useEffect(() => {
    if (!authResolved) return;

    if (isAuthenticated) return;

    writeGuestSession({
      chatId,
      messages: displayMessages,
      selectedMode,
      updatedAt: Date.now(),
    });
  }, [authResolved, isAuthenticated, chatId, displayMessages, selectedMode]);

  // One-time migration: import guest conversation into user history after login.
  useEffect(() => {
    if (!authResolved || !isAuthenticated || guestSessionImportTriedRef.current) return;
    guestSessionImportTriedRef.current = true;

    const stored = readGuestSession();
    if (!stored || stored.messages.length === 0) {
      clearGuestSession();
      setGuestImportStatus("done");
      return;
    }

    const importableMessages = toImportableMessages(stored.messages);
    if (importableMessages.length === 0) {
      clearGuestSession();
      setGuestImportStatus("done");
      return;
    }

    const runImport = async () => {
      setGuestImportStatus("importing");
      try {
        const response = await fetch("/api/chats/import-guest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId: stored.chatId,
            messages: importableMessages,
          }),
        });

        if (!response.ok) throw new Error("Guest import failed");

        const data = (await response.json().catch(() => null)) as { chatId?: string } | null;

        clearGuestSession();
        setGuestImportStatus("done");

        if (data?.chatId && data.chatId !== chatId) {
          const url = new URL(window.location.href);
          url.searchParams.set("chat", data.chatId);
          url.searchParams.delete("q");
          window.location.href = url.toString();
        }
      } catch {
        // Keep local session if import fails so user does not lose conversation.
        setGuestImportStatus("error");
        setPageError("We could not import your guest conversation after sign-in. Your local copy is still intact.");
      }
    };

    void runImport();
  }, [authResolved, isAuthenticated, chatId]);

  useEffect(() => {
    if (!canUsePaidModes && selectedMode !== "fast") {
      setSelectedMode("fast");
    }
  }, [canUsePaidModes, selectedMode]);

  // Sync URL with chatId once first message is sent
  useEffect(() => {
    if (messages.length > 0 && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      let shouldReplace = false;
      if (!url.searchParams.has("chat")) {
        url.searchParams.set("chat", chatId);
        if (killer) url.searchParams.set("killer", killer.id);
        shouldReplace = true;
      }
      if (url.searchParams.has("q")) {
        url.searchParams.delete("q");
        shouldReplace = true;
      }
      if (url.searchParams.has("hf")) {
        url.searchParams.delete("hf");
        shouldReplace = true;
      }
      if (shouldReplace) {
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [messages.length, chatId, killer]);

  // Sync status bar
  useEffect(() => {
    const timer = setTimeout(() => {
      if (status === "streaming" || status === "submitted") {
        if (status === "submitted") {
          setAgentStatus("thinking");
          setStatusStepCount(1);
        } else {
          setAgentStatus("running");
          setStatusStepCount(2);
        }
      } else if (status === "ready" && messages.length > 0) {
        const last = messages[messages.length - 1];

        if (awaitingAssistantRef.current && last?.role !== "assistant") {
          awaitingAssistantRef.current = false;
          pendingAssistantSinceRef.current = null;
          setMessages((prev: UIMessage[]) => {
            const tail = prev[prev.length - 1];
            if (tail?.role === "assistant" && hasRenderableAssistantContent(tail)) return prev;

            return replaceOrAppendAssistantFallback(
              prev,
              "I received your request but the browser dropped the response stream before rendering it. Please retry. If this keeps happening, disable browser extensions for localhost and hard-refresh.",
            );
          });
        }

        if (last?.role === "assistant" && !hasRenderableAssistantContent(last)) {
          awaitingAssistantRef.current = false;
          pendingAssistantSinceRef.current = null;
          setMessages((prev: UIMessage[]) => {
            const tail = prev[prev.length - 1];
            if (!tail || tail.role !== "assistant" || hasRenderableAssistantContent(tail)) {
              return prev;
            }

            return replaceOrAppendAssistantFallback(
              prev,
              "I could not complete that response. Please retry, or switch to a different mode.",
            );
          });
        } else if (last?.role === "assistant") {
          awaitingAssistantRef.current = false;
          pendingAssistantSinceRef.current = null;
        }

        setAgentStatus("done");
        setStatusStepCount(3);

        const telemetry = streamTelemetryRef.current;
        if (telemetry.startedAt !== null) {
          const now = performance.now();
          const firstAssistantMs =
            telemetry.firstAssistantAt !== null ? Math.round(telemetry.firstAssistantAt - telemetry.startedAt) : null;
          const firstRenderableMs =
            telemetry.firstRenderableAt !== null ? Math.round(telemetry.firstRenderableAt - telemetry.startedAt) : null;
          const totalMs = Math.round(now - telemetry.startedAt);

          console.info(
            "[chat.telemetry]",
            JSON.stringify({
              event: "chat_stream_complete",
              firstAssistantMs,
              firstRenderableMs,
              totalMs,
              messageCount: messages.length,
            }),
          );
          streamTelemetryRef.current = {
            startedAt: null,
            firstAssistantAt: null,
            firstRenderableAt: null,
          };
        }

        const resetTimer = setTimeout(() => {
          setAgentStatus("idle");
          setStatusStepCount(undefined);
        }, 3000);
        return () => clearTimeout(resetTimer);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [status, messages, setMessages]);

  useEffect(() => {
    const telemetry = streamTelemetryRef.current;
    if (telemetry.startedAt === null) return;

    const lastAssistant = [...displayMessages].reverse().find((message) => message.role === "assistant");
    if (!lastAssistant) return;

    if (telemetry.firstAssistantAt === null) {
      telemetry.firstAssistantAt = performance.now();
    }

    if (telemetry.firstRenderableAt === null && hasRenderableAssistantContent(lastAssistant)) {
      telemetry.firstRenderableAt = performance.now();
    }
  }, [displayMessages]);

  // Update canvas content; auto-open for renderable artifacts/pages
  useEffect(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const lastUserText = lastUser ? extractMessageText(lastUser) : null;
    const hasExplicitBuilderTarget = builderTarget !== "auto";
    const userBuildIntent = hasExplicitBuilderTarget || isLikelyCanvasBuildIntent(lastUserText);
    const userCodeIntent = isLikelyCodeTaskIntent(lastUserText);

    const lastAssistantWithText = [...messages]
      .reverse()
      .find((m) => m.role === "assistant" && extractMessageText(m).length > 0);

    if (!lastAssistantWithText) return;

    const text = extractMessageText(lastAssistantWithText);
    const renderableNow = isCanvasRenderableContent(text);
    const looksLikeArtifactStream =
      /<quill-artifact>|artifactVersion|"type"\s*:\s*"(page|document|react-app|nextjs-bundle)"|```(?:json|html)/i.test(
        text,
      );
    const looksCodeLike = looksLikeCodeStream(text);
    const shouldTrackInCanvas =
      renderableNow ||
      (isLoading && userBuildIntent && looksLikeArtifactStream) ||
      (isLoading && userCodeIntent && looksCodeLike);

    if (shouldTrackInCanvas) {
      setCanvasContent(text);
    }

    if (shouldTrackInCanvas && uiSettings.autoOpenCanvas) {
      setCanvasMode(true);
    }
  }, [messages, isLoading, builderTarget, uiSettings.autoOpenCanvas]);

  const handleMessagesScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 80;
  }, []);

  const handleLoadOlderMessages = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      historyExpansionScrollRef.current = {
        previousScrollHeight: container.scrollHeight,
        previousScrollTop: container.scrollTop,
      };
    }

    setHistoryWindowState((current) => ({
      chatId,
      expandedCount:
        current.chatId === chatId ? current.expandedCount + MESSAGE_WINDOW_INCREMENT : MESSAGE_WINDOW_INCREMENT,
    }));
  }, [chatId]);

  // Auto-scroll with RAF+timeout debounce — prevents scroll conflicts while streaming
  // and respects the user's read position when they scroll up.
  useEffect(() => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    if (scrollRequestRef.current) cancelAnimationFrame(scrollRequestRef.current);

    const lastMessage = displayMessages[displayMessages.length - 1];
    const forceStickToBottom = Boolean(isLoading) || lastMessage?.role === "user";
    if (!forceStickToBottom && !shouldAutoScrollRef.current) return;
    if (isScrollingRef.current) return;

    const behavior: ScrollBehavior = forceStickToBottom ? "smooth" : "auto";
    scrollRequestRef.current = requestAnimationFrame(() => {
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = true;
        bottomRef.current?.scrollIntoView({ behavior });
        setTimeout(
          () => {
            isScrollingRef.current = false;
          },
          behavior === "smooth" ? 300 : 50,
        );
      }, 16);
    });
  }, [displayMessages, isLoading]);

  // Live elapsed timer — 100ms tick while a stream is active.
  useEffect(() => {
    if (isLoading) {
      if (streamStartRef.current === null) streamStartRef.current = Date.now();
      setStreamClockMs(0);
      const interval = setInterval(() => {
        setStreamClockMs(Date.now() - (streamStartRef.current ?? Date.now()));
      }, 100);
      return () => clearInterval(interval);
    } else {
      streamStartRef.current = null;
      setStreamClockMs(0);
    }
  }, [isLoading]);

  useEffect(() => {
    if (canvasMode && mobileSidebarOpen) {
      setMobileSidebarOpen(false);
    }
  }, [canvasMode, mobileSidebarOpen]);

  const handleSend = useCallback(
    (text: string, files?: FileList) => {
      trackUiEvent("composer_send", {
        hasFiles: Boolean(files && files.length > 0),
        mode: selectedMode,
        builderTarget,
      });
      setIsDraftReview(false);
      setActiveTaskTitle(text.trim().slice(0, 80) || "Task");
      setStatusStepCount(1);
      const shouldUseCanvas =
        builderTarget !== "auto" || isLikelyCanvasBuildIntent(text) || isLikelyCodeTaskIntent(text);
      if (!shouldUseCanvas) {
        setCanvasMode(false);
      }

      setAgentStatus("thinking");
      if (files && files.length > 0) {
        sendMessageTracked({ text, files });
      } else {
        sendMessageTracked({ text });
      }
    },
    [sendMessageTracked, builderTarget, selectedMode],
  );

  const handleQuickPageRefine = useCallback(
    (label: string, instruction: string) => {
      setRecentRefinements((prev) => {
        const next = [label, ...prev.filter((item) => item !== label)];
        return next.slice(0, 5);
      });
      setActiveTaskTitle(label);
      setStatusStepCount(1);
      setAgentStatus("thinking");
      sendMessageTracked({
        text: [
          "Refine the current page artifact.",
          `Instruction: ${instruction}`,
          "Keep the existing structure unless needed.",
          "Return only an updated artifact block.",
        ].join("\n"),
      });
    },
    [sendMessageTracked],
  );

  const toggleBuilderLock = useCallback((lock: keyof BuilderLocks) => {
    setBuilderLocks((prev) => ({
      ...prev,
      [lock]: !prev[lock],
    }));
  }, []);

  const handleOpenCanvasFromMessage = useCallback((content: string) => {
    setCanvasContent(content);
    setCanvasMode(true);
  }, []);

  const pageRefineActions = [
    {
      id: "premium",
      label: "More premium",
      instruction: "Increase visual polish with stronger hierarchy and refined spacing.",
    },
    {
      id: "mobile",
      label: "Improve mobile",
      instruction: "Optimize spacing, typography, and tap targets for small screens.",
    },
    {
      id: "cta",
      label: "Stronger CTA",
      instruction: "Make the primary call-to-action clearer and more conversion-focused.",
    },
    {
      id: "motion",
      label: "Softer motion",
      instruction: "Reduce motion intensity and keep only subtle, meaningful transitions.",
    },
  ] as const;

  const starterPrompts = [
    {
      id: "landing",
      label: "Launch page",
      detail: "Hero, proof, CTA, motion",
      prompt: "Build a premium Next.js landing page with strong hierarchy, social proof, and polished motion.",
      target: "nextjs-bundle" as BuilderTarget,
    },
    {
      id: "prototype",
      label: "App prototype",
      detail: "Core flow + responsive UI",
      prompt: "Design a mobile-first product prototype with a clear primary flow and responsive dashboard screens.",
      target: "react-app" as BuilderTarget,
    },
    {
      id: "debug",
      label: "Debug code",
      detail: "Root cause, fix, validate",
      prompt:
        "Debug this issue systematically, explain the root cause, apply the smallest robust fix, and validate it.",
      target: "auto" as BuilderTarget,
    },
    {
      id: "research",
      label: "Research brief",
      detail: "Decision memo + next steps",
      prompt: "Research this topic and turn it into an executive brief with tradeoffs, recommendation, and next steps.",
      target: "auto" as BuilderTarget,
    },
  ] as const;

  const sectionRefineActions = [
    { id: "hero", label: "Regenerate hero", section: "hero" },
    { id: "pricing", label: "Regenerate pricing", section: "pricing" },
    { id: "testimonials", label: "Regenerate testimonials", section: "testimonials" },
  ] as const;

  const handleSectionRegenerate = useCallback(
    (section: "hero" | "pricing" | "testimonials") => {
      setRecentRefinements((prev) => {
        const label = `Regenerated ${section}`;
        const next = [label, ...prev.filter((item) => item !== label)];
        return next.slice(0, 5);
      });
      setActiveTaskTitle(`Regenerate ${section}`);
      setStatusStepCount(1);
      setAgentStatus("thinking");
      sendMessageTracked({
        text: [
          "Refine the current page artifact.",
          `Regenerate only the ${section} section with a stronger variant.`,
          `Target exactly section markers id='${section}' and data-quill-section='${section}'.`,
          "If markers are missing, add them and regenerate only that section.",
          "Keep all other sections visually and structurally unchanged.",
          "Return only an updated artifact block.",
        ].join("\n"),
      });
    },
    [sendMessageTracked],
  );

  const handleGenerateImage = useCallback(
    async (prompt: string) => {
      trackUiEvent("composer_generate_image", { promptLength: prompt.length });
      setPageError(null);
      setIsGeneratingImage(true);
      setActiveTaskTitle(prompt.trim().slice(0, 80) || "Generate image");
      setStatusStepCount(1);
      setAgentStatus("thinking");

      setMessages((msgs: UIMessage[]) => [
        ...msgs,
        {
          id: crypto.randomUUID(),
          role: "user" as const,
          parts: [{ type: "text" as const, text: prompt }],
          metadata: {},
        },
      ]);

      try {
        const res = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error ?? "Image generation failed");

        setMessages((msgs: UIMessage[]) => [
          ...msgs,
          {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            parts: [{ type: "text" as const, text: `![${prompt}](${data.url})` }],
            metadata: {},
          },
        ]);
        setAgentStatus("done");
        setTimeout(() => setAgentStatus("idle"), 3000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to generate image";
        setPageError(`Image generation failed: ${msg}`);
        setMessages((msgs: UIMessage[]) => [
          ...msgs,
          {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            parts: [{ type: "text" as const, text: `Image generation failed: ${msg}.` }],
            metadata: {},
          },
        ]);
        setAgentStatus("error");
        setTimeout(() => setAgentStatus("idle"), 3000);
      } finally {
        setIsGeneratingImage(false);
      }
    },
    [setMessages],
  );

  // handleStarterPrompt is not used anymore since builderTarget is always 'auto'.

  const handleNewChat = useCallback(() => {
    if (!isAuthenticated) {
      clearGuestSession();
      if (typeof window !== "undefined") {
        localStorage.removeItem(`${GUEST_CHAT_TITLE_PREFIX}${chatId}`);
      }
    }
    setActiveTaskTitle(undefined);
    setChatTitle("New chat");
    setChatTitleDraft("New chat");
    setStatusStepCount(undefined);
    const url = new URL(window.location.href);
    url.searchParams.delete("chat");
    url.searchParams.delete("q");
    window.location.href = url.toString();
  }, [chatId, isAuthenticated]);

  const saveChatTitle = useCallback(async () => {
    const normalized = chatTitleDraft.replace(/\s+/g, " ").trim();
    const nextTitle = normalized || "New chat";

    if (nextTitle === chatTitle) {
      setIsEditingChatTitle(false);
      return;
    }

    if (!isAuthenticated) {
      setChatTitle(nextTitle);
      setChatTitleDraft(nextTitle);
      setIsEditingChatTitle(false);
      if (typeof window !== "undefined") {
        localStorage.setItem(`${GUEST_CHAT_TITLE_PREFIX}${chatId}`, nextTitle);
      }
      return;
    }

    setIsSavingChatTitle(true);
    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle }),
      });

      if (!response.ok) {
        throw new Error("Failed to save title");
      }

      setChatTitle(nextTitle);
      setChatTitleDraft(nextTitle);
      setPageError(null);
    } catch {
      setPageError("Could not update chat title. Please try again.");
      setChatTitleDraft(chatTitle);
    } finally {
      setIsSavingChatTitle(false);
      setIsEditingChatTitle(false);
    }
  }, [chatId, chatTitle, chatTitleDraft, isAuthenticated]);

  const handleRegenerate = useCallback(() => {
    if (isLoading) return;
    const lastUserIdx = messages.reduceRight((found: number, msg, idx) => {
      return found !== -1 ? found : msg.role === "user" ? idx : -1;
    }, -1);
    if (lastUserIdx === -1) return;
    const lastUserMsg = messages[lastUserIdx];
    const userText = extractTextFromMessageParts(getMessageParts(lastUserMsg) as unknown[]);
    if (!userText?.trim()) return;
    setMessages(messages.slice(0, lastUserIdx));
    sendMessage({ text: userText.trim() });
  }, [messages, setMessages, sendMessage, isLoading]);

  const modeLabels: Record<Mode, string> = { fast: "Flash", thinking: "Thinking", advanced: "Pro" };
  // trustIndicators removed for minimal UI
  const hasCanvasContent = canvasContent.trim().length > 0;
  const mobileWorkspaceView: "menu" | "chat" | "canvas" = mobileSidebarOpen ? "menu" : canvasMode ? "canvas" : "chat";
  const sidebarFallback = <div className="h-full w-full bg-quill-bg" aria-hidden="true" />;

  const handleOpenMobileMenu = useCallback(() => {
    setCanvasMode(false);
    setMobileSidebarOpen(true);
  }, []);

  const handleShowMobileChat = useCallback(() => {
    setMobileSidebarOpen(false);
    setCanvasMode(false);
  }, []);

  const handleShowMobileCanvas = useCallback(() => {
    if (!hasCanvasContent) return;
    setMobileSidebarOpen(false);
    setCanvasMode(true);
  }, [hasCanvasContent]);

  return (
    <div className="agent-screen relative flex h-screen bg-quill-bg overflow-hidden">
      {/* Desktop: always-visible sidebar */}
      {!uiSettings.focusMode && (
        <aside className="hidden md:block w-64 h-full shrink-0 border-r border-quill-border">
          <Suspense fallback={sidebarFallback}>
            <Sidebar />
          </Suspense>
        </aside>
      )}

      {/* Mobile backdrop */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Mobile: fixed full-screen sidebar drawer */}
      <div
        className="md:hidden fixed inset-y-0 left-0 z-50 w-72 transition-transform duration-300 ease-out"
        style={{ transform: mobileSidebarOpen ? "translateX(0)" : "translateX(-100%)" }}
      >
        <Suspense fallback={sidebarFallback}>
          <Sidebar onClose={() => setMobileSidebarOpen(false)} mobileCompact />
        </Suspense>
      </div>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header
          className={`flex items-center gap-2 border-b border-quill-border bg-quill-bg shrink-0 ${uiSettings.focusMode ? "px-2 py-2 md:px-3" : "px-3 py-2 md:gap-3 md:px-4 md:py-3"}`}
        >
          {/* Hamburger: mobile drawer toggle */}
          <Button
            onClick={() => {
              if (canvasMode) {
                setCanvasMode(false);
                return;
              }
              setMobileSidebarOpen((v) => !v);
            }}
            variant="ghost"
            size="sm"
            className="icon-btn md:hidden h-auto rounded-lg p-1.5 text-quill-muted transition-all hover:bg-quill-surface-2 hover:text-quill-text"
            aria-label="Toggle sidebar"
          >
            <Bars3Icon className="h-4.25 w-4.25" aria-hidden="true" />
          </Button>

          {/* Active mode badge and trial plan removed for minimal UI */}

          {/* Mobile-only: truncated chat title in header center */}
          {chatTitle && (
            <span className="md:hidden flex-1 min-w-0 truncate text-center text-xs text-quill-muted px-1">
              {chatTitle}
            </span>
          )}

          {/* Chat title editing and tooltip removed for minimal UI */}
          {/* Header right controls (new chat, auth, importing) removed for minimal UI */}
        </header>

        {/* Mobile tab bar removed: only hamburger menu remains for navigation. */}

        {uiSettings.statusSurface === "hybrid" &&
          (agentStatus !== "idle" || Boolean(activeTaskTitle) || statusStepCount !== undefined) && (
            <>
              <div className="md:hidden border-b border-quill-border bg-quill-bg">
                {/* Mobile: Collapsible status bar header */}
                <button
                  onClick={() => setStatusBarCollapsed(!statusBarCollapsed)}
                  type="button"
                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-quill-surface transition-colors text-[11px] font-medium text-quill-muted"
                  aria-label={statusBarCollapsed ? "Show status" : "Hide status"}
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        agentStatus === "running" || agentStatus === "thinking" ? "animate-pulse" : ""
                      }`}
                      style={{ background: getAgentStatusColor(agentStatus) }}
                    />
                    Agent {getAgentStatusMessage(agentStatus)}
                  </span>
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${statusBarCollapsed ? "" : "rotate-180"}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7-7m0 0L5 14m7-7v12"
                    />
                  </svg>
                </button>

                {/* Mobile: Expanded status details */}
                {!statusBarCollapsed && (
                  <div className="px-3 py-2 border-t border-quill-border bg-quill-surface text-[10px] text-quill-muted space-y-1">
                    {activeTaskTitle && <div className="truncate">Task: {activeTaskTitle}</div>}
                    {statusStepCount !== undefined && (
                      <div>
                        Progress: {statusStepCount}/{statusStepCount !== undefined ? 3 : 0}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="hidden md:block">
                <AgentStatusBar
                  status={agentStatus}
                  taskTitle={activeTaskTitle}
                  stepCount={statusStepCount}
                  totalSteps={statusStepCount !== undefined ? 3 : undefined}
                />
              </div>
            </>
          )}

        {/* Content */}
        <div className="relative flex flex-1 min-h-0">
          <div className="flex flex-col flex-1 min-w-0">
            {/* Messages */}
            <div
              ref={messagesContainerRef}
              onScroll={handleMessagesScroll}
              className={`agent-messages flex-1 overflow-y-auto px-3 md:px-6 py-3 md:py-4 ${uiSettings.compactMessages ? "space-y-2 md:space-y-3" : "space-y-3 md:space-y-4"}`}
            >
              {displayMessages.length === 0 && (
                <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-center py-6 md:py-10">
                  <div className="w-full rounded-[28px] border border-quill-border bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.08),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.015),rgba(255,255,255,0))] px-5 py-6 shadow-[0_18px_70px_rgba(0,0,0,0.28)] md:px-8 md:py-8">
                    <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                      <div className="max-w-2xl">
                        <div
                          className="mb-4 flex h-15 w-15 items-center justify-center rounded-3xl"
                          style={
                            activeKiller
                              ? { background: `${activeKiller.accent}15`, border: `1px solid ${activeKiller.accent}30` }
                              : { background: "#171A20", border: "1px solid #272B33" }
                          }
                        >
                          {activeKiller ? (
                            <span className="h-5 w-5 rounded-full" style={{ background: activeKiller.accent }} />
                          ) : (
                            <QuillLogo size={34} />
                          )}
                        </div>
                        <h2
                          className="text-2xl font-semibold tracking-tight"
                          style={activeKiller ? { color: activeKiller.accent } : {}}
                        >
                          {activeKiller ? (
                            activeKiller.name
                          ) : (
                            <span className="gradient-text">Build, refine, and ship in one thread</span>
                          )}
                        </h2>
                        <p className="mt-3 max-w-xl text-sm leading-7 text-quill-muted md:text-[15px]">
                          {activeKiller
                            ? activeKiller.description
                            : "Quill should feel like a premium operator, not a blank terminal. Start with a strong outcome, then inspect the artifact, refine sections, and export without losing context."}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-quill-muted">
                          <span className="rounded-full border border-quill-border bg-quill-surface px-3 py-1.5">
                            Chat-first workflow
                          </span>
                          <span className="rounded-full border border-quill-border bg-quill-surface px-3 py-1.5">
                            Live artifact canvas
                          </span>
                          <span className="rounded-full border border-quill-border bg-quill-surface px-3 py-1.5">
                            Mobile-ready controls
                          </span>
                        </div>
                      </div>

                      <div className="w-full max-w-xl rounded-3xl border border-quill-border bg-[#13171d] p-3 md:p-4">
                        <div className="mb-3 flex items-center justify-between px-1">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-quill-muted">
                              Start Faster
                            </p>
                            <p className="mt-1 text-sm text-quill-text">
                              Pick a high-signal task and Quill will do the rest.
                            </p>
                          </div>
                          <span className="rounded-full border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] px-2.5 py-1 text-[10px] font-medium text-[#f7b0b0]">
                            Operator mode
                          </span>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          {starterPrompts.map((starter) => (
                            <Button
                              key={starter.id}
                              type="button"
                              variant="ghost"
                              // Output format is always 'auto', so just set the draft
                              onClick={() => setInitialComposerDraft(starter.prompt)}
                              className="h-auto items-start justify-start rounded-2xl border border-quill-border bg-quill-surface px-3 py-3 text-left hover:border-quill-border-2 hover:bg-quill-surface-2"
                            >
                              <span className="flex flex-col items-start gap-1">
                                <span className="text-sm font-medium text-quill-text">{starter.label}</span>
                                <span className="text-[11px] leading-5 text-quill-muted">{starter.detail}</span>
                              </span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {hiddenMessageCount > 0 && (
                <div className="flex justify-center pb-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleLoadOlderMessages}
                    className="h-auto rounded-full border-quill-border bg-quill-surface px-3 py-1.5 text-[11px] text-quill-muted hover:bg-quill-surface-2 hover:text-quill-text"
                  >
                    Show {Math.min(MESSAGE_WINDOW_INCREMENT, hiddenMessageCount)} older message
                    {Math.min(MESSAGE_WINDOW_INCREMENT, hiddenMessageCount) === 1 ? "" : "s"}
                    <span className="ml-1 text-[10px] text-quill-muted/70">({hiddenMessageCount} hidden)</span>
                  </Button>
                </div>
              )}

              {visibleMessages.map((msg: UIMessage) => {
                const isLastAssistant = msg.role === "assistant" && msg.id === lastAssistantMessageId;
                return (
                  <RealMessageBubble
                    key={msg.id}
                    message={msg}
                    onOpenCanvasFromMessage={handleOpenCanvasFromMessage}
                    onRegenerate={isLastAssistant && !isLoading ? handleRegenerate : undefined}
                    layoutMode={uiSettings.conversationLayout}
                    showAssistantAvatar={uiSettings.showAssistantAvatar}
                    assistantBubbles={uiSettings.assistantBubbles}
                    contextualActions={uiSettings.contextualActions}
                    compact={uiSettings.compactMessages}
                    isStreaming={Boolean(isLoading && isLastAssistant)}
                  />
                );
              })}

              {isLoading && !isGeneratingImage && (!hasActiveAssistantMessage || activeToolNames.length > 0) && (
                <div className="flex items-start gap-3 animate-fade-in">
                  <div className="w-7 h-7 rounded-full bg-quill-surface border border-quill-border flex items-center justify-center shrink-0 mt-0.5">
                    <QuillLogo size={16} />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-quill-surface border border-quill-border px-4 py-3 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-typing-dot"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                      <span className="text-xs text-quill-muted">
                        {activeToolNames.length > 0
                          ? `Running ${activeToolNames.length} tool${activeToolNames.length > 1 ? "s" : ""}...`
                          : hasActiveAssistantMessage
                            ? "Streaming response..."
                            : "Thinking..."}
                      </span>
                      {streamClockMs > 500 && (
                        <span className="text-[10px] text-quill-muted/60 ml-1">{formatElapsed(streamClockMs)}</span>
                      )}
                    </div>
                    {activeToolNames.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {activeToolNames.slice(0, 3).map((name) => (
                          <span
                            key={name}
                            className="rounded-full border border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.08)] px-2 py-0.5 text-[10px] text-[#f7b0b0]"
                          >
                            {name}
                          </span>
                        ))}
                        {activeToolNames.length > 3 && (
                          <span className="text-[10px] text-quill-muted">+{activeToolNames.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {isGeneratingImage && (
                <div className="flex items-start gap-3 animate-fade-in">
                  <div className="w-7 h-7 rounded-full bg-quill-surface border border-quill-border flex items-center justify-center shrink-0 mt-0.5">
                    <QuillLogo size={16} />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-quill-surface border border-[rgba(248,113,113,0.3)] px-4 py-3 flex items-center gap-2">
                    <ArrowPathIcon className="h-3.25 w-3.25 animate-spin text-[#F87171]" aria-hidden="true" />
                    <span className="text-xs text-[#F87171]">Generating image...</span>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input — safe-area bottom padding handled by .agent-composer-shell CSS rule in globals.css */}
            <div className="agent-composer-shell shrink-0 px-3 md:px-6 pb-4 md:pb-5 pt-1.5 md:pt-2 border-t border-quill-border bg-quill-bg">
              <div className="max-w-3xl mx-auto">
                {pageError && (
                  <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-[rgba(248,113,113,0.3)] bg-[rgba(239,68,68,0.08)] px-3.5 py-2.5 animate-fade-in">
                    <div className="flex items-start gap-2.5">
                      <ExclamationCircleIcon
                        className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#F87171]"
                        aria-hidden="true"
                      />
                      <p className="text-[12px] leading-relaxed text-[#f7b0b0]">{pageError}</p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => setPageError(null)}
                      variant="outline"
                      className="h-auto shrink-0 rounded-lg border-[rgba(248,113,113,0.25)] px-2 py-1 text-[11px] text-[#f7b0b0] hover:bg-[rgba(239,68,68,0.12)]"
                    >
                      Dismiss
                    </Button>
                  </div>
                )}
                <TaskInput
                  onSend={handleSend}
                  onStop={() => {
                    manualStopRef.current = true;
                    streamTelemetryRef.current = {
                      startedAt: null,
                      firstAssistantAt: null,
                      firstRenderableAt: null,
                    };
                    stop();
                    setAgentStatus("idle");
                  }}
                  onGenerateImage={handleGenerateImage}
                  mode={selectedMode}
                  onModeChange={setSelectedMode}
                  builderTarget={builderTarget}
                  onBuilderTargetChange={() => {}}
                  canvasMode={canvasMode}
                  onCanvasToggle={() => setCanvasMode((v) => !v)}
                  webSearchEnabled={webSearchEnabled}
                  onWebSearchToggle={() => setWebSearchEnabled((v) => !v)}
                  showWebSearch
                  webSearchState={webSearchState}
                  allowedModes={allowedModes}
                  showLockedModes
                  canGenerateImage={isAuthenticated}
                  disabled={isLoading}
                  isGeneratingImage={isGeneratingImage}
                  isWorking={isLoading || isGeneratingImage}
                  placeholder={activeKiller ? `Ask ${activeKiller.name}...` : "Give Quill a task to execute..."}
                  workingLabel={
                    isGeneratingImage
                      ? "Generating image..."
                      : activeKiller
                        ? `${activeKiller.name} is working...`
                        : "Quill is working..."
                  }
                  initialDraft={initialComposerDraft}
                  initialAttachedFile={initialHomepageFile}
                  sendOnEnter={uiSettings.sendOnEnter}
                  showActionLabels={uiSettings.showComposerLabels}
                  // trustIndicators prop removed for minimal UI
                  reviewSummary={
                    isDraftReview && messages.length === 0 && !isLoading
                      ? {
                          label: "Draft review",
                          additions: initialComposerDraft.trim().length > 0 ? 1 : undefined,
                          deletions: 0,
                          keepLabel: "Keep",
                          undoLabel: "Undo",
                        }
                      : undefined
                  }
                  onReviewKeep={() => {
                    setIsDraftReview(false);
                  }}
                  onReviewUndo={() => {
                    setIsDraftReview(false);
                    setInitialComposerDraft("");
                    setInitialHomepageFile(null);
                  }}
                />

                {/* All quick actions, templates, and chips removed per user request. Only the main task input remains visible. */}
              </div>
            </div>
          </div>

          {/* Canvas panel — softer desktop overlay, full-screen on mobile */}
          {canvasMode && (
            <>
              <Button
                type="button"
                aria-label="Close canvas"
                onClick={() => setCanvasMode(false)}
                variant="ghost"
                className="hidden absolute inset-0 z-20 bg-black/20 backdrop-blur-[1px] animate-fade-in md:block"
              />
              <div
                className="hidden md:block absolute inset-y-0 right-0 z-30 shadow-2xl shadow-black/40 animate-slide-in-left"
                style={{ width: "min(520px, 42vw)" }}
              >
                <CanvasPanel content={canvasContent} onClose={() => setCanvasMode(false)} isWorking={isLoading} />
              </div>
            </>
          )}

          {/* Mobile: full-screen canvas overlay */}
          {canvasMode && (
            <div className="md:hidden fixed inset-0 z-40 animate-slide-up">
              <CanvasPanel content={canvasContent} onClose={() => setCanvasMode(false)} isWorking={isLoading} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
