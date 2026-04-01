"use client";

import { useCallback, useRef, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import type { UIMessage } from "ai";
import { Sidebar } from "@/components/layout/Sidebar";
import { AgentStatusBar, type AgentStatus } from "@/components/agent/AgentStatusBar";
import { QuillLogo } from "@/components/ui/QuillLogo";
import { TaskInput, type Mode } from "@/components/agent/TaskInput";
import { RealMessageBubble } from "@/components/agent/RealMessageBubble";
import { CanvasPanel, isCanvasRenderableContent, isHTMLContent } from "@/components/agent/CanvasPanel";
import { getKillerById, type Killer } from "@/lib/killers";
import { getAutonomyLevelLabel, summarizePolicyCapabilities } from "@/lib/killer-autonomy";
import type { BuilderLocks, BuilderSessionContext, BuilderTarget } from "@/lib/builder-artifacts";
import { DEFAULT_BUILDER_LOCKS, parseBuilderArtifact } from "@/lib/builder-artifacts";
import {
  DEFAULT_USER_PROFILE,
  USER_PRESET_TEMPLATES,
  normalizeUserProfile,
  type UserInstructionProfile,
} from "@/lib/user-customization";

const GUEST_SESSION_KEY = "quill_guest_active_session_v1";
const GUEST_SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24;

type StoredGuestSession = {
  chatId: string;
  messages: UIMessage[];
  selectedMode: Mode;
  updatedAt: number;
};

type ImportableMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
};

type PersistedMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
};

type UiPersistedMessage = PersistedMessage & {
  role: "user" | "assistant" | "system";
};

function toUiMessages(messages: PersistedMessage[]): UIMessage[] {
  return messages
    .filter(
      (message): message is UiPersistedMessage =>
        message.role === "user" || message.role === "assistant" || message.role === "system",
    )
    .map((message) => ({
      id: message.id,
      role: message.role,
      parts: [{ type: "text", text: message.content }],
    }));
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
    return parsed;
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

      const content = message.parts
        .map((part) => {
          if (typeof part !== "object" || part === null) return "";
          if ((part as { type?: string }).type === "text") {
            const text = (part as { text?: unknown }).text;
            return typeof text === "string" ? text : "";
          }
          return "";
        })
        .join("\n")
        .trim();

      if (!content) return null;
      return { role, content } as ImportableMessage;
    })
    .filter((item): item is ImportableMessage => Boolean(item));
}

// Read URL search params safely on the client
function getSearchParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}

export default function AgentPage() {
  const router = useRouter();

  // Initialise chatId from URL or generate new
  const [urlChatId] = useState(() => getSearchParam("chat"));
  const [chatId] = useState(() => urlChatId ?? readGuestSession()?.chatId ?? crypto.randomUUID());

  // Active killer agent (from URL ?killer=id)
  const [killer] = useState<Killer | null>(() => {
    const id = getSearchParam("killer");
    return id ? (getKillerById(id) ?? null) : null;
  });

  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");
  const [selectedMode, setSelectedMode] = useState<Mode>("fast");
  const [builderTarget, setBuilderTarget] = useState<BuilderTarget>("auto");
  const [builderLocks, setBuilderLocks] = useState<BuilderLocks>(DEFAULT_BUILDER_LOCKS);
  const [recentRefinements, setRecentRefinements] = useState<string[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [canUsePaidModes, setCanUsePaidModes] = useState(false);
  const [planLabel, setPlanLabel] = useState("Free");
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [webSearchState, setWebSearchState] = useState<"available" | "auth-required" | "coming-soon">("coming-soon");
  const [activeProfileLabel, setActiveProfileLabel] = useState("Custom");
  const [canvasMode, setCanvasMode] = useState(false);
  const [canvasContent, setCanvasContent] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [guestImportStatus, setGuestImportStatus] = useState<"idle" | "importing" | "done" | "error">("idle");

  const artifact = useMemo(() => parseBuilderArtifact(canvasContent), [canvasContent]);
  const killerCapabilities = useMemo(
    () => (killer ? summarizePolicyCapabilities(killer.executionPolicy, 3) : []),
    [killer]
  );
  const canUsePageRefineActions =
    builderTarget === "page" ||
    artifact?.type === "page" ||
    (builderTarget === "auto" && isHTMLContent(canvasContent));

  const allowedModes: Mode[] = canUsePaidModes ? ["fast", "thinking", "advanced"] : ["fast"];
  const isTrialPlan = planLabel.toLowerCase().startsWith("trial") || trialDaysLeft !== null;
  const shouldShowTrialUpgradeCta = isTrialPlan && (trialDaysLeft ?? 0) <= 2;

  const bottomRef = useRef<HTMLDivElement>(null);
  const guestSessionRestoredRef = useRef(false);
  const guestSessionImportTriedRef = useRef(false);

  // Refs for transport (stable, avoid re-creating)
  const modeRef = useRef<Mode>(selectedMode);
  const builderTargetRef = useRef<BuilderTarget>(builderTarget);
  const builderLocksRef = useRef<BuilderLocks>(builderLocks);
  const builderSessionRef = useRef<BuilderSessionContext>({});
  const killerRef = useRef<string | null>(killer?.id ?? null);
  const userProfileRef = useRef<UserInstructionProfile>(DEFAULT_USER_PROFILE);
  const webSearchRef = useRef(webSearchEnabled);
  useEffect(() => { modeRef.current = selectedMode; }, [selectedMode]);
  useEffect(() => { builderTargetRef.current = builderTarget; }, [builderTarget]);
  useEffect(() => { builderLocksRef.current = builderLocks; }, [builderLocks]);
  useEffect(() => { webSearchRef.current = webSearchEnabled; }, [webSearchEnabled]);

  // Load persistent user customization profile from settings storage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("quill-settings");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { instructionProfile?: unknown };
      userProfileRef.current = normalizeUserProfile(parsed.instructionProfile);
      setActiveProfileLabel(USER_PRESET_TEMPLATES[userProfileRef.current.preset].label);
    } catch {
      userProfileRef.current = DEFAULT_USER_PROFILE;
      setActiveProfileLabel(USER_PRESET_TEMPLATES.custom.label);
    }
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
      new TextStreamChatTransport({
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
    []
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
    id: chatId,
    onError: () => setAgentStatus("error"),
  });

  // Auto-send task from ?q= query param (e.g. from homepage hero input)
  const heroTaskFiredRef = useRef(false);
  useEffect(() => {
    if (heroTaskFiredRef.current) return;
    const q = getSearchParam("q");
    if (!q) return;
    heroTaskFiredRef.current = true;
    // Small delay so useChat transport is initialised
    setTimeout(() => {
      setAgentStatus("thinking");
      sendMessage({ text: q });
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
        if (!response.ok) return;

        const payload = (await response.json()) as { messages?: PersistedMessage[] };
        if (cancelled || !Array.isArray(payload.messages) || payload.messages.length === 0) return;

        setMessages(toUiMessages(payload.messages));
      } catch {
        // Keep empty state on fetch failures.
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
      messages,
      selectedMode,
      updatedAt: Date.now(),
    });
  }, [authResolved, isAuthenticated, chatId, messages, selectedMode]);

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
      if (shouldReplace) {
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [messages.length, chatId, killer]);

  // Sync status bar
  useEffect(() => {
    const timer = setTimeout(() => {
      if (status === "streaming" || status === "submitted") {
        setAgentStatus("running");
      } else if (status === "ready" && messages.length > 0) {
        setAgentStatus("done");
        const resetTimer = setTimeout(() => setAgentStatus("idle"), 3000);
        return () => clearTimeout(resetTimer);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [status, messages.length]);

  // Update canvas content; auto-open for renderable artifacts/pages
  useEffect(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (lastAssistant) {
      const text = lastAssistant.parts
        .filter((p: unknown): p is { type: "text"; text: string } => {
          return typeof p === "object" && p !== null && (p as { type?: string }).type === "text";
        })
        .map((p: { type: "text"; text: string }) => p.text)
        .join("\n");
      if (text) {
        setCanvasContent(text);
        if (isCanvasRenderableContent(text)) setCanvasMode(true);
      }
    }
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(
    (text: string, files?: FileList) => {
      setAgentStatus("thinking");
      if (files && files.length > 0) {
        sendMessage({ text, files });
      } else {
        sendMessage({ text });
      }
    },
    [sendMessage]
  );

  const handleQuickPageRefine = useCallback(
    (label: string, instruction: string) => {
      setRecentRefinements((prev) => {
        const next = [label, ...prev.filter((item) => item !== label)];
        return next.slice(0, 5);
      });
      setAgentStatus("thinking");
      sendMessage({
        text: [
          "Refine the current page artifact.",
          `Instruction: ${instruction}`,
          "Keep the existing structure unless needed.",
          "Return only an updated artifact block.",
        ].join("\n"),
      });
    },
    [sendMessage]
  );

  const toggleBuilderLock = useCallback((lock: keyof BuilderLocks) => {
    setBuilderLocks((prev) => ({
      ...prev,
      [lock]: !prev[lock],
    }));
  }, []);

  const pageRefineActions = [
    { id: "premium", label: "More premium", instruction: "Increase visual polish with stronger hierarchy and refined spacing." },
    { id: "mobile", label: "Improve mobile", instruction: "Optimize spacing, typography, and tap targets for small screens." },
    { id: "cta", label: "Stronger CTA", instruction: "Make the primary call-to-action clearer and more conversion-focused." },
    { id: "motion", label: "Softer motion", instruction: "Reduce motion intensity and keep only subtle, meaningful transitions." },
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
      setAgentStatus("thinking");
      sendMessage({
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
    [sendMessage],
  );

  const handleGenerateImage = useCallback(
    async (prompt: string) => {
      setIsGeneratingImage(true);
      setAgentStatus("thinking");

      setMessages((msgs: UIMessage[]) => [
        ...msgs,
        { id: crypto.randomUUID(), role: "user" as const, parts: [{ type: "text" as const, text: prompt }], metadata: {} },
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
          { id: crypto.randomUUID(), role: "assistant" as const, parts: [{ type: "text" as const, text: `![${prompt}](${data.url})` }], metadata: {} },
        ]);
        setAgentStatus("done");
        setTimeout(() => setAgentStatus("idle"), 3000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to generate image";
        setMessages((msgs: UIMessage[]) => [
          ...msgs,
          { id: crypto.randomUUID(), role: "assistant" as const, parts: [{ type: "text" as const, text: `Image generation failed: ${msg}.` }], metadata: {} },
        ]);
        setAgentStatus("error");
        setTimeout(() => setAgentStatus("idle"), 3000);
      } finally {
        setIsGeneratingImage(false);
      }
    },
    [setMessages]
  );

  const handleShare = useCallback(() => {
    // Ensure URL has chatId before copying
    const url = new URL(window.location.href);
    url.searchParams.set("chat", chatId);
    const shareUrl = `${window.location.origin}/share/${chatId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    });
  }, [chatId]);

  const handleNewChat = useCallback(() => {
    if (!isAuthenticated) {
      clearGuestSession();
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("chat");
    url.searchParams.delete("q");
    window.location.href = url.toString();
  }, [isAuthenticated]);

  const isLoading = status === "streaming" || status === "submitted";

  const modeLabels: Record<Mode, string> = { fast: "Flash", thinking: "Thinking", advanced: "Pro" };

  return (
    <div className="agent-screen relative flex h-screen bg-quill-bg overflow-hidden">

      {/* Desktop: always-visible sidebar */}
      <aside className="hidden md:block w-64 h-full shrink-0 border-r border-quill-border">
        <Sidebar />
      </aside>

      {/* Mobile backdrop */}
      {mobileSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile: fixed full-screen sidebar drawer */}
      <div
        className="md:hidden fixed inset-y-0 left-0 z-50 w-72 transition-transform duration-300 ease-out"
        style={{ transform: mobileSidebarOpen ? "translateX(0)" : "translateX(-100%)" }}
      >
        <Sidebar onClose={() => setMobileSidebarOpen(false)} />
      </div>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-quill-border bg-quill-bg shrink-0">
          {/* Hamburger: mobile drawer toggle */}
          <button
            onClick={() => setMobileSidebarOpen((v) => !v)}
            className="icon-btn md:hidden p-1.5 rounded-lg transition-all text-quill-muted hover:text-quill-text hover:bg-quill-surface-2"
            aria-label="Toggle sidebar"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <QuillLogo size={20} />
            <span className="text-sm font-semibold gradient-text whitespace-nowrap">Quill AI</span>
          </div>

          {/* Killer badge */}
          {killer && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium"
              style={{ borderColor: `${killer.accent}40`, background: `${killer.accent}12`, color: killer.accent }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: killer.accent }} />
              <span className="md:hidden">{killer.shortName}</span>
              <span className="hidden md:inline">{killer.name}</span>
            </div>
          )}

          {killer && (
            <div
              className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px]"
              style={{ borderColor: `${killer.accent}30`, background: `${killer.accent}10`, color: killer.accent }}
              title={killer.executionPolicy.sandbox.required ? "Requires sandboxed execution for execution-shaped steps" : "No sandbox requirement yet"}
            >
              <span>{getAutonomyLevelLabel(killer.executionPolicy.autonomyLevel)}</span>
            </div>
          )}

          {killer && killerCapabilities.length > 0 && (
            <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-lg border border-quill-border text-[11px] text-quill-muted">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: killer.accent }} />
              <span>{killerCapabilities.join(" • ")}</span>
            </div>
          )}

          {/* Active mode badge */}
          {!killer && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-quill-surface border border-quill-border">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] shrink-0" />
              <span className="text-[11px] font-medium text-[#a8a8c0]">{modeLabels[selectedMode]}</span>
            </div>
          )}

          {!killer && (
            <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg border border-quill-border text-[11px] text-quill-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] shrink-0" />
              <span>Profile: {activeProfileLabel}</span>
            </div>
          )}

          {isTrialPlan && (
            <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg border border-[rgba(248,113,113,0.35)] bg-[rgba(239,68,68,0.08)] text-[11px] font-medium text-[#FCA5A5]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F87171] shrink-0" />
              <span>{trialDaysLeft !== null ? `Trial ${trialDaysLeft}d left` : planLabel}</span>
            </div>
          )}

          {shouldShowTrialUpgradeCta && (
            <button
              onClick={() => router.push("/pricing")}
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-medium transition-all"
              title="Upgrade before trial expires"
            >
              Upgrade
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* Share button */}
            <button
              onClick={handleShare}
              disabled={messages.length === 0}
              title="Copy share link"
              className="flex items-center justify-center size-8 md:size-auto md:gap-1.5 md:px-3 md:py-1.5 rounded-lg border border-quill-border text-xs text-quill-muted hover:text-quill-text hover:border-quill-border-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {shareCopied ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="hidden md:inline">Copied</span>
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  <span className="hidden md:inline">Share</span>
                </>
              )}
            </button>

            {/* New chat */}
            <button
              onClick={handleNewChat}
              className="flex items-center justify-center size-8 md:size-auto md:gap-1.5 md:px-3 md:py-1.5 rounded-lg border border-quill-border text-xs text-quill-muted hover:text-quill-text hover:border-quill-border-2 transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="hidden md:inline">New chat</span>
            </button>

            {guestImportStatus === "importing" && (
              <span className="hidden md:inline text-[11px] text-quill-muted">Importing guest chat...</span>
            )}
          </div>
        </header>

        <AgentStatusBar status={agentStatus} />

        {/* Content */}
        <div className="flex flex-1 min-h-0">
          <div className="flex flex-col flex-1 min-w-0">
            {/* Messages */}
            <div className="agent-messages flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-5">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={killer ? { background: `${killer.accent}15`, border: `1px solid ${killer.accent}30` } : { background: "#111118", border: "1px solid #1e1e2e" }}
                  >
                    {killer ? (
                      <span className="w-5 h-5 rounded-full" style={{ background: killer.accent }} />
                    ) : (
                      <QuillLogo size={32} />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold" style={killer ? { color: killer.accent } : {}}>
                      {killer ? killer.name : <span className="gradient-text">Quill AI</span>}
                    </h2>
                    <p className="text-sm text-quill-muted mt-1 max-w-sm">
                      {killer ? killer.description : "Your personal AI agent. Ask anything, attach files, generate images, or build a page."}
                    </p>
                    {killer && (
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 max-w-md">
                        <span
                          className="px-2 py-1 rounded-lg border text-[11px] font-medium"
                          style={{ borderColor: `${killer.accent}30`, background: `${killer.accent}12`, color: killer.accent }}
                        >
                          {getAutonomyLevelLabel(killer.executionPolicy.autonomyLevel)}
                        </span>
                        {killerCapabilities.map((capability) => (
                          <span key={capability} className="px-2 py-1 rounded-lg border border-quill-border text-[11px] text-quill-muted">
                            {capability}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {messages.map((msg: UIMessage) => (
                <RealMessageBubble key={msg.id} message={msg} />
              ))}

              {isLoading && !isGeneratingImage && (
                <div className="flex items-start gap-3 animate-fade-in">
                  <div className="w-7 h-7 rounded-full bg-quill-surface border border-quill-border flex items-center justify-center shrink-0 mt-0.5">
                    <QuillLogo size={16} />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-quill-surface border border-quill-border px-4 py-3 flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-typing-dot" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}

              {isGeneratingImage && (
                <div className="flex items-start gap-3 animate-fade-in">
                  <div className="w-7 h-7 rounded-full bg-quill-surface border border-quill-border flex items-center justify-center shrink-0 mt-0.5">
                    <QuillLogo size={16} />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-quill-surface border border-[rgba(248,113,113,0.3)] px-4 py-3 flex items-center gap-2">
                    <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M21 12a9 9 0 1 1-6.22-8.56" />
                    </svg>
                    <span className="text-xs text-[#F87171]">Generating image...</span>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input — safe-area bottom padding for iPhone home indicator */}
            <div className="agent-composer-shell shrink-0 px-4 md:px-6 pb-6 pt-3 border-t border-quill-border bg-quill-bg pb-safe">
              <div className="max-w-3xl mx-auto">
                <TaskInput
                  onSend={handleSend}
                  onGenerateImage={handleGenerateImage}
                  mode={selectedMode}
                  onModeChange={setSelectedMode}
                  builderTarget={builderTarget}
                  onBuilderTargetChange={setBuilderTarget}
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
                  placeholder={killer ? `Ask ${killer.name}...` : "Give Quill a task to execute..."}
                />

                {canUsePageRefineActions && messages.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pageRefineActions.map((action) => (
                      <button
                        key={action.id}
                        onClick={() => handleQuickPageRefine(action.label, action.instruction)}
                        disabled={isLoading || isGeneratingImage}
                        className="px-2.5 py-1.5 rounded-lg border border-quill-border text-[11px] text-quill-muted hover:text-quill-text hover:border-quill-border-2 hover:bg-quill-surface transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}

                {canUsePageRefineActions && messages.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sectionRefineActions.map((action) => (
                      <button
                        key={action.id}
                        onClick={() => handleSectionRegenerate(action.section)}
                        disabled={isLoading || isGeneratingImage}
                        className="px-2.5 py-1.5 rounded-lg border border-[rgba(248,113,113,0.35)] bg-[rgba(239,68,68,0.08)] text-[11px] text-[#f7b0b0] hover:bg-[rgba(239,68,68,0.14)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}

                {canUsePageRefineActions && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {([
                      ["layout", "Lock layout"],
                      ["colors", "Lock colors"],
                      ["sectionOrder", "Lock sections"],
                      ["copy", "Lock copy"],
                    ] as Array<[keyof BuilderLocks, string]>).map(([key, label]) => {
                      const active = builderLocks[key];
                      return (
                        <button
                          key={key}
                          onClick={() => toggleBuilderLock(key)}
                          className={`px-2.5 py-1.5 rounded-lg border text-[11px] transition-all ${
                            active
                              ? "border-[rgba(239,68,68,0.45)] bg-[rgba(239,68,68,0.1)] text-[#f7b0b0]"
                              : "border-quill-border text-quill-muted hover:text-quill-text hover:border-quill-border-2 hover:bg-quill-surface"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Canvas panel — side panel on desktop, full-screen overlay on mobile */}
          {/* Desktop: smooth slide-in from right */}
          <div
            className="hidden md:block shrink-0 overflow-hidden"
            style={{ width: canvasMode ? "520px" : "0px", transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)" }}
          >
            <CanvasPanel content={canvasContent} onClose={() => setCanvasMode(false)} />
          </div>

          {/* Mobile: full-screen canvas overlay */}
          {canvasMode && (
            <div className="md:hidden fixed inset-0 z-40 animate-slide-up">
              <CanvasPanel content={canvasContent} onClose={() => setCanvasMode(false)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
