"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { Sidebar } from "@/components/layout/Sidebar";
import { AgentStatusBar, type AgentStatus } from "@/components/agent/AgentStatusBar";
import { QuillLogo } from "@/components/ui/QuillLogo";
import { TaskInput } from "@/components/agent/TaskInput";
import { RealMessageBubble } from "@/components/agent/RealMessageBubble";

export default function AgentPage() {
  const [chatId] = useState(() => crypto.randomUUID());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new TextStreamChatTransport({ api: "/api/chat" }),
    id: chatId,
    onError: () => setAgentStatus("error"),
  });

  // Sync status bar with stream status (deferred to avoid setState-in-effect lint rule)
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

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(
    (text: string) => {
      setAgentStatus("thinking");
      sendMessage({ text });
    },
    [sendMessage]
  );

  const isLoading = status === "streaming" || status === "submitted";

  return (
    <div className="flex h-screen bg-[#0a0a0f] overflow-hidden">
      {sidebarOpen && <Sidebar />}

      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-[#1e1e2e] bg-[#0a0a0f] shrink-0">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-1.5 rounded-lg text-[#6b6b8a] hover:text-[#e8e8f0] hover:bg-[#16161f] transition-all"
            aria-label="Toggle sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <QuillLogo size={20} />
            <span className="text-sm font-semibold gradient-text">Quill AI</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
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

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#111118] border border-[#1e1e2e] flex items-center justify-center">
                <QuillLogo size={32} />
              </div>
              <div>
                <h2 className="text-lg font-semibold gradient-text">
                  Quill AI
                </h2>
                <p className="text-sm text-[#6b6b8a] mt-1 max-w-sm">
                  Your personal AI agent powered by Gemini. Give me a task — I&apos;ll research, write, analyze, and execute it.
                </p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <RealMessageBubble key={msg.id} message={msg} />
          ))}

          {isLoading && (
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

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 px-6 pb-6 pt-3 border-t border-[#1e1e2e] bg-[#0a0a0f]">
          <div className="max-w-3xl mx-auto">
            <TaskInput
              onSend={handleSend}
              disabled={isLoading}
              placeholder="Give Quill a task to execute..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
