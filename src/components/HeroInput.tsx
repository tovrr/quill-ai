"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const PLACEHOLDERS = [
  "Research top AI startups from Q1 2026 and write a report...",
  "Build a Next.js landing page with Tailwind and animations...",
  "Write 5 cold email variants for my B2B SaaS targeting CTOs...",
  "Analyze my Q4 sales data and find growth opportunities...",
  "Create a 30-day social media content calendar for my startup...",
  "Explain quantum computing in simple terms with examples...",
];

export function HeroInput() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = "auto";
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 140)}px`;
  }, [value]);

  // Animate placeholder cycling
  useEffect(() => {
    if (value) return; // stop animation when user is typing
    const target = PLACEHOLDERS[placeholderIndex];
    let i = 0;
    setDisplayed("");
    setIsTyping(true);

    const typeInterval = setInterval(() => {
      i++;
      setDisplayed(target.slice(0, i));
      if (i >= target.length) {
        clearInterval(typeInterval);
        setIsTyping(false);
        // Pause, then move to next
        setTimeout(() => {
          setPlaceholderIndex((idx) => (idx + 1) % PLACEHOLDERS.length);
        }, 2800);
      }
    }, 28);

    return () => clearInterval(typeInterval);
  }, [placeholderIndex, value]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const task = value.trim();
    if (!task) {
      // Use the currently displayed placeholder as the task
      const task2 = displayed || PLACEHOLDERS[placeholderIndex];
      router.push(`/agent?q=${encodeURIComponent(task2)}`);
      return;
    }
    router.push(`/agent?q=${encodeURIComponent(task)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-2xl mx-auto">
      <div className="rounded-2xl border border-quill-border bg-[#0d0d15] focus-within:border-[rgba(239,68,68,0.55)] focus-within:shadow-[0_0_24px_rgba(239,68,68,0.1)] transition-all duration-200">
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-[#9b9bb8] font-medium tracking-wide uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
            Task for Quill
          </div>
          <span className="text-[11px] text-quill-muted">Agent mode</span>
        </div>

        <div className="flex items-end gap-2 px-3 pb-3">
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={isTyping ? displayed + "▌" : displayed}
            rows={1}
            className="flex-1 bg-transparent resize-none px-2 py-2 text-sm sm:text-base text-quill-text placeholder-[#4a4a6a] outline-none leading-relaxed min-w-0"
            autoComplete="off"
            spellCheck="false"
            aria-label="Describe your task"
          />

          <button
            type="submit"
            title="Run task"
            className="shrink-0 w-10 h-10 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white transition-all shadow-[0_0_0_1px_rgba(239,68,68,0.35)] active:scale-95 flex items-center justify-center"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>

      <p className="mt-2 text-center text-[11px] text-quill-muted">
        Enter to run · Shift+Enter for new line
      </p>
    </form>
  );
}
