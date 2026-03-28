"use client";

import { useState, useRef, useEffect } from "react";

interface TaskInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const suggestions = [
  "Research the top 10 AI companies in 2026",
  "Write a professional bio for my LinkedIn",
  "Create a marketing plan for my app launch",
  "Analyze and summarize this document",
  "Find competitors for my SaaS product",
  "Draft a cold email campaign for B2B leads",
];

export function TaskInput({ onSend, disabled, placeholder }: TaskInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Input area */}
      <div className="relative glow-border rounded-2xl bg-[#111118] transition-all duration-200 focus-within:border-[rgba(124,106,247,0.6)] focus-within:shadow-[0_0_24px_rgba(124,106,247,0.15)]">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder ?? "Ask Quill to do anything..."}
          rows={1}
          className="w-full bg-transparent resize-none px-5 py-4 pr-14 text-sm text-[#e8e8f0] placeholder-[#6b6b8a] outline-none leading-relaxed"
          style={{ minHeight: "52px" }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className="absolute right-3 bottom-3 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed bg-[#7c6af7] hover:bg-[#6b58e8] active:scale-95 shadow-md shadow-[rgba(124,106,247,0.3)]"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      {/* Hint */}
      <p className="text-center text-[11px] text-[#6b6b8a]">
        Press{" "}
        <kbd className="px-1 py-0.5 rounded bg-[#1e1e2e] text-[#a8a8c0] text-[10px] font-mono">
          Enter
        </kbd>{" "}
        to send &middot;{" "}
        <kbd className="px-1 py-0.5 rounded bg-[#1e1e2e] text-[#a8a8c0] text-[10px] font-mono">
          Shift+Enter
        </kbd>{" "}
        for new line
      </p>

      {/* Quick suggestions (show only when empty) */}
      {!value && !disabled && (
        <div className="flex flex-wrap gap-2 justify-center">
          {suggestions.slice(0, 3).map((s) => (
            <button
              key={s}
              onClick={() => setValue(s)}
              className="text-[12px] px-3 py-1.5 rounded-full border border-[#1e1e2e] text-[#6b6b8a] hover:border-[#7c6af7] hover:text-[#a78bfa] hover:bg-[rgba(124,106,247,0.05)] transition-all duration-150"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
