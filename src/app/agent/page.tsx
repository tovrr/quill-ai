"use client";

import { useCallback, useRef, useEffect, useState, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import type { UIMessage } from "ai";
import { Sidebar } from "@/components/layout/Sidebar";
import { AgentStatusBar, type AgentStatus } from "@/components/agent/AgentStatusBar";
import { QuillLogo } from "@/components/ui/QuillLogo";
import { TaskInput, type Mode } from "@/components/agent/TaskInput";
import { RealMessageBubble } from "@/components/agent/RealMessageBubble";
import { CanvasPanel, isHTMLContent } from "@/components/agent/CanvasPanel";
import { getKillerById, type Killer } from "@/lib/killers";

// Read URL search params safely on the client
function getSearchParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}

export default function AgentPage() {
  // Initialise chatId from URL or generate new
  const [chatId] = useState(() => getSearchParam("chat") ?? crypto.randomUUID());

  // Active killer agent (from URL ?killer=id)
  const [killer] = useState<Killer | null>(() => {
    const id = getSearchParam("killer");
    return id ? (getKillerById(id) ?? null) : null;
  });

  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");
  const [selectedMode, setSelectedMode] = useState<Mode>("fast");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [canUsePaidModes, setCanUsePaidModes] = useState(false);
  const [webSearchState, setWebSearchState] = useState<"available" | "auth-required" | "coming-soon">("coming-soon");
  const [canvasMode, setCanvasMode] = useState(false);
  const [canvasContent, setCanvasContent] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const allowedModes: Mode[] = canUsePaidModes ? ["fast", "thinking", "advanced"] : ["fast"];

  const bottomRef = useRef<HTMLDivElement>(null);

  // Refs for transport (stable, avoid re-creating)
  const modeRef = useRef<Mode>(selectedMode);
  const killerRef = useRef<string | null>(killer?.id ?? null);
  const webSearchRef = useRef(webSearchEnabled);
  useEffect(() => { modeRef.current = selectedMode; }, [selectedMode]);
  useEffect(() => { webSearchRef.current = webSearchEnabled; }, [webSearchEnabled]);

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

  // Resolve client entitlements to gate mode options for guest/free users.
  useEffect(() => {
    const loadEntitlements = async () => {
      try {
        const res = await fetch("/api/me/entitlements", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          authenticated?: boolean;
          canUsePaidModes?: boolean;
          webSearchState?: "available" | "auth-required" | "coming-soon";
        };
        setIsAuthenticated(Boolean(data.authenticated));
        setCanUsePaidModes(Boolean(data.canUsePaidModes));
        setWebSearchState(data.webSearchState ?? "coming-soon");
      } catch {
        setIsAuthenticated(false);
        setCanUsePaidModes(false);
        setWebSearchState("coming-soon");
      }
    };

    void loadEntitlements();
  }, []);

  useEffect(() => {
    if (!canUsePaidModes && selectedMode !== "fast") {
      setSelectedMode("fast");
    }
  }, [canUsePaidModes, selectedMode]);

  // Sync URL with chatId once first message is sent
  useEffect(() => {
    if (messages.length > 0 && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("chat")) {
        url.searchParams.set("chat", chatId);
        if (killer) url.searchParams.set("killer", killer.id);
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

  // Update canvas content; auto-open for HTML
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
        if (isHTMLContent(text)) setCanvasMode(true);
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

  const isLoading = status === "streaming" || status === "submitted";

  const modeLabels: Record<Mode, string> = { fast: "Flash", thinking: "Thinking", advanced: "Pro" };

  return (
    <div className="relative flex h-screen bg-quill-bg overflow-hidden">

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

          <div className="flex items-center gap-2">
            <QuillLogo size={20} />
            <span className="text-sm font-semibold gradient-text">Quill AI</span>
          </div>

          {/* Killer badge */}
          {killer && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium"
              style={{ borderColor: `${killer.accent}40`, background: `${killer.accent}12`, color: killer.accent }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: killer.accent }} />
              {killer.name}
            </div>
          )}

          {/* Active mode badge */}
          {!killer && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-quill-surface border border-quill-border">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] shrink-0" />
              <span className="text-[11px] font-medium text-[#a8a8c0]">{modeLabels[selectedMode]}</span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* Share button */}
            <button
              onClick={handleShare}
              disabled={messages.length === 0}
              title="Copy share link"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-quill-border text-xs text-quill-muted hover:text-quill-text hover:border-quill-border-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {shareCopied ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="hidden sm:inline">Copied</span>
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
                  <span className="hidden sm:inline">Share</span>
                </>
              )}
            </button>

            {/* New chat */}
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-quill-border text-xs text-quill-muted hover:text-quill-text hover:border-quill-border-2 transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="hidden sm:inline">New chat</span>
            </button>
          </div>
        </header>

        <AgentStatusBar status={agentStatus} />

        {/* Content */}
        <div className="flex flex-1 min-h-0">
          <div className="flex flex-col flex-1 min-w-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-5">
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
            <div className="shrink-0 px-4 md:px-6 pb-6 pt-3 border-t border-quill-border bg-quill-bg pb-safe">
              <div className="max-w-3xl mx-auto">
                <TaskInput
                  onSend={handleSend}
                  onGenerateImage={handleGenerateImage}
                  mode={selectedMode}
                  onModeChange={setSelectedMode}
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
                  placeholder={killer ? `Ask ${killer.name}...` : "Give Quill a task to execute..."}
                />
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
