"use client";

import { useState, useCallback } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { ChatWindow } from "@/components/agent/ChatWindow";
import { TaskInput } from "@/components/agent/TaskInput";
import { AgentStatusBar, type AgentStatus } from "@/components/agent/AgentStatusBar";
import { QuillLogo } from "@/components/ui/QuillLogo";
import { type Message } from "@/components/agent/MessageBubble";
import {
  simulateAgentResponse,
  createUserMessage,
  createAssistantMessage,
} from "@/lib/agentSimulator";

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: `Hi! I'm **Quill**, your personal AI agent. I can research the web, write content, analyze data, write code, and execute complex multi-step tasks autonomously — just like having a brilliant assistant at your fingertips.\n\nWhat would you like me to tackle today?`,
  timestamp: new Date(),
};

export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");
  const [taskTitle, setTaskTitle] = useState<string | undefined>();
  const [stepCount, setStepCount] = useState<number | undefined>();
  const [totalSteps, setTotalSteps] = useState<number | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleSend = useCallback(async (userInput: string) => {
    const userMsg = createUserMessage(userInput);
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);
    setAgentStatus("thinking");
    setTaskTitle(userInput.slice(0, 60) + (userInput.length > 60 ? "..." : ""));
    setStepCount(undefined);
    setTotalSteps(undefined);

    // Simulate thinking delay
    await new Promise((r) => setTimeout(r, 900 + Math.random() * 600));
    setAgentStatus("running");
    setStepCount(1);
    setTotalSteps(3);

    await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));
    setStepCount(2);

    await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
    setStepCount(3);

    await new Promise((r) => setTimeout(r, 400));

    const response = simulateAgentResponse(userInput);
    const assistantMsg = createAssistantMessage(response);
    setMessages((prev) => [...prev, assistantMsg]);
    setIsTyping(false);
    setAgentStatus("done");

    // Reset status after a moment
    setTimeout(() => {
      setAgentStatus("idle");
      setTaskTitle(undefined);
      setStepCount(undefined);
      setTotalSteps(undefined);
    }, 3000);
  }, []);

  return (
    <div className="flex h-screen bg-[#0a0a0f] overflow-hidden">
      {/* Sidebar */}
      {sidebarOpen && <Sidebar />}

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
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
              onClick={() => setMessages([WELCOME_MESSAGE])}
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
        <AgentStatusBar
          status={agentStatus}
          taskTitle={taskTitle}
          stepCount={stepCount}
          totalSteps={totalSteps}
        />

        {/* Chat */}
        <ChatWindow messages={messages} isTyping={isTyping} />

        {/* Input */}
        <div className="shrink-0 px-6 pb-6 pt-3 border-t border-[#1e1e2e] bg-[#0a0a0f]">
          <div className="max-w-3xl mx-auto">
            <TaskInput
              onSend={handleSend}
              disabled={isTyping}
              placeholder="Give Quill a task to execute..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
