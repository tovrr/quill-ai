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

const HOMEPAGE_FILE_HANDOFF_PREFIX = "quill_home_file_handoff_v1:";
const MAX_HOMEPAGE_FILE_BYTES = 1_500_000;

type HomepageFileHandoffPayload = {
  name: string;
  type: string;
  lastModified: number;
  dataUrl: string;
};

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read file as data URL"));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function HeroInput() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = "auto";
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 140)}px`;
  }, [value]);

  // Animate placeholder cycling
  useEffect(() => {
    if (value) return; // stop animation when user is typing

    if (prefersReducedMotion) {
      setDisplayed(PLACEHOLDERS[0]);
      setIsTyping(false);
      return;
    }

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
  }, [placeholderIndex, value, prefersReducedMotion]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setHandoffError(null);

    let task = value.trim();
    if (!task && selectedFile) {
      task = `Analyze the attached file: ${selectedFile.name}`;
    }
    if (!task) return;

    const params = new URLSearchParams({ q: task });

    if (selectedFile) {
      if (selectedFile.size > MAX_HOMEPAGE_FILE_BYTES) {
        setHandoffError("File is too large for homepage handoff. Open Agent and attach it there.");
        return;
      }

      const handoffId = crypto.randomUUID();
      try {
        const payload: HomepageFileHandoffPayload = {
          name: selectedFile.name,
          type: selectedFile.type,
          lastModified: selectedFile.lastModified,
          dataUrl: await fileToDataUrl(selectedFile),
        };
        sessionStorage.setItem(`${HOMEPAGE_FILE_HANDOFF_PREFIX}${handoffId}`, JSON.stringify(payload));
        params.set("hf", handoffId);
      } catch {
        setHandoffError("Could not prepare file handoff. Open Agent and attach it there.");
        return;
      }
    }

    router.push(`/agent?${params.toString()}`);
  };

  const acceptSuggestion = () => {
    if (value.trim()) return;
    const suggestion = (displayed || PLACEHOLDERS[placeholderIndex]).trim();
    if (!suggestion) return;
    setValue(suggestion);
  };

  const showTabChip = !value.trim();

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setHandoffError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-2xl mx-auto">
      <div className="rounded-2xl border border-[rgba(239,68,68,0.22)] bg-[#0d0d15] focus-within:border-[rgba(239,68,68,0.45)] focus-within:shadow-[0_0_20px_rgba(239,68,68,0.08)] transition-all duration-200">
        <div className="flex items-center gap-2 px-4 pt-3 pb-0.5 text-[11px] text-[#8b8ba8]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
          Describe a task
        </div>

        <div className="flex flex-col gap-2 px-3 pb-3 pt-1 sm:flex-row sm:items-end">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setHandoffError(null);
              setSelectedFile(file ?? null);
            }}
          />

          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Tab" && !e.shiftKey) {
                e.preventDefault();
                acceptSuggestion();
                return;
              }

              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder={isTyping ? displayed + "▌" : displayed}
            rows={2}
            className="w-full sm:flex-1 bg-transparent resize-none overflow-y-auto px-2 py-2.5 text-sm sm:text-base text-quill-text placeholder-[#4a4a6a] outline-none leading-relaxed min-w-0 min-h-22 sm:min-h-13"
            autoComplete="off"
            spellCheck="false"
            aria-label="Describe your task"
          />

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              title="Attach a file"
              onClick={triggerFilePicker}
              className="shrink-0 w-10 h-10 rounded-xl border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] hover:bg-[rgba(239,68,68,0.16)] text-[#f3b1b1] transition-all active:scale-95 flex items-center justify-center"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.2-9.19a4 4 0 1 1 5.65 5.66L9.4 17.43a2 2 0 1 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={acceptSuggestion}
                className={`inline-flex h-10 items-center gap-1 rounded-xl border border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.1)] px-2.5 text-[11px] text-[#f0b0b0] hover:border-[rgba(239,68,68,0.45)] hover:text-[#ffd4d4] transition-colors ${
                  showTabChip ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
                title="Press Tab to accept the suggestion"
                aria-hidden={!showTabChip}
                tabIndex={showTabChip ? 0 : -1}
              >
                <kbd className="rounded border border-[rgba(239,68,68,0.4)] bg-[rgba(0,0,0,0.22)] px-1 font-mono text-[10px] leading-4 text-[#ffd4d4]">Tab</kbd>
                Accept
              </button>

              <button
                type="submit"
                title="Run task"
                disabled={!value.trim() && !selectedFile}
                className="shrink-0 w-10 h-10 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white transition-all active:scale-95 flex items-center justify-center"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {selectedFile && (
          <div className="px-4 pb-3">
            <div className="inline-flex items-center gap-2 rounded-lg border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-2.5 py-1 text-[11px] text-[#f3b1b1]">
              <span className="max-w-55 truncate sm:max-w-90" title={selectedFile.name}>{selectedFile.name}</span>
              <button
                type="button"
                onClick={clearSelectedFile}
                className="rounded px-1 text-[#ffd3d3] hover:bg-[rgba(255,255,255,0.08)]"
                aria-label="Remove attached file"
                title="Remove attached file"
              >
                x
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 min-h-9 text-center">
        <p className="text-[11px] text-quill-muted">
          Press Tab to accept suggestion, Enter to send. No sign-in required
        </p>
        <p className={`mt-1 text-[11px] text-[#f2a1a1] ${handoffError ? "opacity-100" : "opacity-0"}`}>
          {handoffError ?? "Placeholder"}
        </p>
      </div>
    </form>
  );
}
