"use client";

import { QuillLogo } from "@/components/ui/QuillLogo";
import { ToolCallCard, type ToolCall } from "@/components/agent/ToolCallCard";

export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  timestamp: Date;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[#7c6af7] animate-typing-dot"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

export function MessageBubble({
  message,
  isTyping,
}: {
  message?: Message;
  isTyping?: boolean;
}) {
  if (isTyping) {
    return (
      <div className="flex items-start gap-3 animate-fade-in">
        <div className="w-7 h-7 rounded-full bg-[#111118] border border-[#1e1e2e] flex items-center justify-center shrink-0 mt-0.5">
          <QuillLogo size={16} />
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-[#111118] border border-[#1e1e2e]">
          <TypingIndicator />
        </div>
      </div>
    );
  }

  if (!message) return null;

  const isUser = message.role === "user";

  return (
    <div
      className={`flex items-start gap-3 animate-fade-in ${
        isUser ? "flex-row-reverse" : ""
      }`}
    >
      {/* Avatar */}
      {isUser ? (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#a78bfa] to-[#60a5fa] flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-0.5">
          U
        </div>
      ) : (
        <div className="w-7 h-7 rounded-full bg-[#111118] border border-[#1e1e2e] flex items-center justify-center shrink-0 mt-0.5">
          <QuillLogo size={16} />
        </div>
      )}

      {/* Content */}
      <div className={`flex flex-col gap-2 max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Tool calls */}
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="w-full flex flex-col gap-2">
            {message.toolCalls.map((call) => (
              <ToolCallCard key={call.id} call={call} />
            ))}
          </div>
        )}

        {/* Text bubble */}
        {message.content && (
          <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
              isUser
                ? "bg-[#7c6af7] text-white rounded-tr-sm"
                : "bg-[#111118] border border-[#1e1e2e] text-[#e8e8f0] rounded-tl-sm"
            }`}
          >
            {message.content}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-[#6b6b8a] px-1">
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
