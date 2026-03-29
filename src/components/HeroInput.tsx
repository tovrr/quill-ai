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
  const inputRef = useRef<HTMLInputElement>(null);

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
      <div className="relative flex items-center rounded-2xl border border-[rgba(239,68,68,0.35)] bg-[#0d0d15] focus-within:border-[rgba(239,68,68,0.7)] focus-within:shadow-[0_0_32px_rgba(239,68,68,0.12)] transition-all duration-200 group">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          placeholder={isTyping ? displayed + "▌" : displayed}
          className="flex-1 bg-transparent px-5 py-4 text-sm sm:text-base text-[#e8e8f0] placeholder-[#4a4a6a] outline-none leading-relaxed min-w-0"
          autoComplete="off"
          spellCheck="false"
          aria-label="Describe your task"
        />
        <div className="pr-2 shrink-0">
          <button
            type="submit"
            className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white text-sm font-semibold transition-all shadow-lg shadow-[rgba(239,68,68,0.25)] active:scale-95 whitespace-nowrap"
          >
            Try it
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-[#4a4a6a]">
        No account needed · Free to start · No credit card
      </p>
    </form>
  );
}
