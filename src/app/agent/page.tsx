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

export default function AgentPage() {
  const [chatId] = useState(() => crypto.randomUUID());
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");
  const [selectedMode, setSelectedMode] = useState<Mode>("advanced");
  const [canvasMode, setCanvasMode] = useState(false);
  const [canvasContent, setCanvasContent] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Sidebar: pinned = stays open; hovered = temporarily visible
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const sidebarHideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sidebarVisible = sidebarPinned || sidebarHovered;

  const showSidebar = useCallback(() => {
    clearTimeout(sidebarHideTimer.current);
    setSidebarHovered(true);
  }, []);

  const hideSidebar = useCallback(() => {
    sidebarHideTimer.current = setTimeout(() => setSidebarHovered(false), 180);
  }, []);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep a ref so prepareSendMessagesRequest always sees the latest mode
  const modeRef = useRef<Mode>(selectedMode);
  useEffect(() => {
    modeRef.current = selectedMode;
  }, [selectedMode]);

  // Transport created once; injects mode + chatId into every request body
  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ body, id }) => ({
          body: { ...body, chatId: id, mode: modeRef.current },
        }),
      }),
    []
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
    id: chatId,
    onError: () => setAgentStatus("error"),
  });

  // Sync status bar with stream status
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
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (lastAssistant) {
      const text = lastAssistant.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n");
      if (text) {
        setCanvasContent(text);
        if (isHTMLContent(text)) {
          setCanvasMode(true);
        }
      }
    }
  }, [messages]);

  // Auto-scroll to bottom
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
    [setMessages]
  );

  const isLoading = status === "streaming" || status === "submitted";

  const modeLabels: Record<Mode, string> = {
    fast: "Flash",
    thinking: "Thinking",
    advanced: "Pro",
  };

  return (
    <div className="relative flex h-screen bg-[#0a0a0f] overflow-hidden">

      {/* ── Auto-hide sidebar overlay ─────────────────────────────────── */}
      {/* Trigger strip — always present on the left edge */}
      <div
        className="absolute left-0 top-0 h-full z-50 flex"
        onMouseLeave={hideSidebar}
      >
        {/* Thin hover trigger */}
        <div
          className="w-1.5 h-full shrink-0 cursor-pointer"
          onMouseEnter={showSidebar}
          style={{
            background: sidebarVisible
              ? "transparent"
              : "linear-gradient(to right, rgba(124,106,247,0.18), transparent)",
          }}
        />

        {/* Sidebar panel — animates in/out */}
        <div
          className="h-full overflow-hidden"
          style={{
            width: sidebarVisible ? "256px" : "0px",
            transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
          }}
          onMouseEnter={showSidebar}
        >
          <div className="w-64 h-full">
            <Sidebar />
          </div>
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-[#1e1e2e] bg-[#0a0a0f] shrink-0">
          {/* Hamburger — pins/unpins sidebar */}
          <button
            onClick={() => setSidebarPinned((v) => !v)}
            className={`p-1.5 rounded-lg transition-all ${
              sidebarPinned
                ? "text-[#a78bfa] bg-[rgba(124,106,247,0.08)]"
                : "text-[#6b6b8a] hover:text-[#e8e8f0] hover:bg-[#16161f]"
            }`}
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

          {/* Active mode badge */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#111118] border border-[#1e1e2e]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7c6af7] shrink-0" />
            <span className="text-[11px] font-medium text-[#a8a8c0]">
              {modeLabels[selectedMode]}
            </span>
          </div>

          <div className="ml-auto">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1e1e2e] text-xs text-[#6b6b8a] hover:text-[#e8e8f0] hover:border-[#2a2a3e] transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New chat
            </button>
          </div>
        </header>

        {/* Status bar */}
        <AgentStatusBar status={agentStatus} />

        {/* Content area */}
        <div className="flex flex-1 min-h-0">
          {/* Chat column */}
          <div className="flex flex-col flex-1 min-w-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#111118] border border-[#1e1e2e] flex items-center justify-center">
                    <QuillLogo size={32} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold gradient-text">Quill AI</h2>
                    <p className="text-sm text-[#6b6b8a] mt-1 max-w-sm">
                      Your personal AI agent. Ask anything, attach files, generate images, or build a page.
                    </p>
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <RealMessageBubble key={msg.id} message={msg} />
              ))}

              {isLoading && !isGeneratingImage && (
                <div className="flex items-start gap-3 animate-fade-in">
                  <div className="w-7 h-7 rounded-full bg-[#111118] border border-[#1e1e2e] flex items-center justify-center shrink-0 mt-0.5">
                    <QuillLogo size={16} />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-[#111118] border border-[#1e1e2e] px-4 py-3 flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-[#7c6af7] animate-typing-dot"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {isGeneratingImage && (
                <div className="flex items-start gap-3 animate-fade-in">
                  <div className="w-7 h-7 rounded-full bg-[#111118] border border-[#1e1e2e] flex items-center justify-center shrink-0 mt-0.5">
                    <QuillLogo size={16} />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-[#111118] border border-[rgba(167,139,250,0.3)] px-4 py-3 flex items-center gap-2">
                    <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M21 12a9 9 0 1 1-6.22-8.56" />
                    </svg>
                    <span className="text-xs text-[#a78bfa]">Generating image...</span>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 px-6 pb-6 pt-3 border-t border-[#1e1e2e] bg-[#0a0a0f]">
              <div className="max-w-3xl mx-auto">
                <TaskInput
                  onSend={handleSend}
                  onGenerateImage={handleGenerateImage}
                  mode={selectedMode}
                  onModeChange={setSelectedMode}
                  canvasMode={canvasMode}
                  onCanvasToggle={() => setCanvasMode((v) => !v)}
                  disabled={isLoading}
                  isGeneratingImage={isGeneratingImage}
                  placeholder="Give Quill a task to execute..."
                />
              </div>
            </div>
          </div>

          {/* ── Canvas panel — smooth slide-in from right ─────────────── */}
          <div
            className="shrink-0 overflow-hidden"
            style={{
              width: canvasMode ? "520px" : "0px",
              transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            <CanvasPanel
              content={canvasContent}
              onClose={() => setCanvasMode(false)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
