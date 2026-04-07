"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { BuilderTarget } from "@/lib/builder-artifacts";

export type Mode = "fast" | "thinking" | "advanced";

interface TaskInputProps {
  onSend: (message: string, files?: FileList) => void;
  onStop?: () => void;
  onGenerateImage?: (prompt: string) => Promise<void>;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  builderTarget: BuilderTarget;
  onBuilderTargetChange: (target: BuilderTarget) => void;
  canvasMode: boolean;
  onCanvasToggle: () => void;
  webSearchEnabled: boolean;
  onWebSearchToggle: () => void;
  showWebSearch?: boolean;
  webSearchState?: "available" | "auth-required" | "coming-soon";
  allowedModes?: Mode[];
  showLockedModes?: boolean;
  canGenerateImage?: boolean;
  disabled?: boolean;
  isGeneratingImage?: boolean;
  isWorking?: boolean;
  placeholder?: string;
  workingLabel?: string;
  initialDraft?: string;
  initialAttachedFile?: File | null;
}

const BUILDER_TARGETS: Array<{ id: BuilderTarget; label: string; desc: string }> = [
  { id: "auto", label: "Auto", desc: "Infer from prompt" },
  { id: "page", label: "Page", desc: "HTML live preview" },
  { id: "react-app", label: "React", desc: "Multi-file app" },
  { id: "nextjs-bundle", label: "Next.js", desc: "Bundle files" },
];

const MODES: { id: Mode; label: string; desc: string }[] = [
  { id: "fast", label: "Fast", desc: "Quick responses" },
  { id: "thinking", label: "Think", desc: "Deep reasoning" },
  { id: "advanced", label: "Pro", desc: "Best quality" },
];

export function TaskInput({
  onSend,
  onStop,
  onGenerateImage,
  mode,
  onModeChange,
  builderTarget,
  onBuilderTargetChange,
  canvasMode,
  onCanvasToggle,
  webSearchEnabled,
  onWebSearchToggle,
  showWebSearch,
  webSearchState,
  allowedModes,
  showLockedModes,
  canGenerateImage,
  disabled,
  isGeneratingImage,
  isWorking,
  placeholder,
  workingLabel,
  initialDraft,
  initialAttachedFile,
}: TaskInputProps) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [imageMode, setImageMode] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<FileList | null>(null);
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false);
  const [builderDropdownOpen, setBuilderDropdownOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const initialDraftHydratedRef = useRef(false);
  const initialFileHydratedRef = useRef(false);

  const toFileList = (files: File[]): FileList => {
    const dt = new DataTransfer();
    for (const file of files) {
      dt.items.add(file);
    }
    return dt.files;
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        160
      )}px`;
    }
  }, [value]);

  useEffect(() => {
    if (initialDraftHydratedRef.current) return;
    if (!initialDraft || initialDraft.trim().length === 0) return;
    initialDraftHydratedRef.current = true;
    // One-time hydration from parent handoff props after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(initialDraft.trim());
  }, [initialDraft]);

  useEffect(() => {
    if (initialFileHydratedRef.current) return;
    if (!initialAttachedFile) return;
    initialFileHydratedRef.current = true;
    // One-time hydration from parent handoff props after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAttachedFiles(toFileList([initialAttachedFile]));
  }, [initialAttachedFile]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!modeDropdownOpen && !builderDropdownOpen) return;
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModeDropdownOpen(false);
        setBuilderDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [modeDropdownOpen, builderDropdownOpen]);

  const isDisabled = disabled || isGeneratingImage;

  const handleSend = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || isDisabled) return;

    if (imageMode && onGenerateImage) {
      await onGenerateImage(trimmed);
      setValue("");
      setImageMode(false);
    } else {
      onSend(trimmed, attachedFiles ?? undefined);
      setValue("");
      setAttachedFiles(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [value, isDisabled, imageMode, onGenerateImage, onSend, attachedFiles]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setAttachedFiles(e.target.files);
      setModeDropdownOpen(false);
      setBuilderDropdownOpen(false);
    }
  };

  const removeFile = (index: number) => {
    if (!attachedFiles) return;
    const dt = new DataTransfer();
    Array.from(attachedFiles).forEach((f, i) => {
      if (i !== index) dt.items.add(f);
    });
    setAttachedFiles(dt.files.length > 0 ? dt.files : null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const currentPlaceholder = imageMode
    ? "Describe the image to generate..."
    : placeholder ?? "Ask Quill to do anything...";
  const enabledModes = new Set(allowedModes ?? MODES.map((m) => m.id));
  const visibleModes = showLockedModes ? MODES : MODES.filter((m) => enabledModes.has(m.id));
  const currentModeLabel = MODES.find((m) => m.id === mode)?.label ?? visibleModes[0]?.label ?? "Fast";
  const hasLockedModes = visibleModes.some((m) => !enabledModes.has(m.id));
  const imageGenerationEnabled = canGenerateImage ?? true;
  const hasTypedContent = value.trim().length > 0;
  const isActiveComposer = isFocused || hasTypedContent || imageMode;
  const showWorkingGlow = Boolean(isWorking) || Boolean(isGeneratingImage);
  const canStop = Boolean(isWorking && onStop);

  return (
    <div className="flex flex-col gap-2">
      {/* Input area */}
      <div
        className={`rounded-2xl bg-quill-surface transition-all duration-300 border ${
          isActiveComposer
            ? "border-[rgba(239,68,68,0.55)] shadow-[0_0_24px_rgba(239,68,68,0.16)]"
            : "border-quill-border shadow-[inset_0_0_0_1px_rgba(239,68,68,0.03)]"
        } ${showWorkingGlow ? "composer-working-glow" : ""}`}
      >
        {/* Attached file chips */}
        {attachedFiles && attachedFiles.length > 0 && (
          <div className="px-4 pt-3 flex flex-wrap gap-2">
            {Array.from(attachedFiles).map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-quill-border border border-quill-border-2 text-xs text-[#a8a8c0]"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                >
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
                <span className="max-w-25 truncate">{file.name}</span>
                <button
                  onClick={() => removeFile(i)}
                  className="ml-0.5 text-quill-muted hover:text-quill-text transition-colors"
                  aria-label="Remove file"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Image mode badge */}
        {imageMode && (
          <div className="px-4 pt-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-quill-accent-glow border border-[rgba(239,68,68,0.3)] text-xs text-[#F87171] font-medium">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              Image generation mode
            </span>
          </div>
        )}

        {isWorking && !imageMode && (
          <div className="px-4 pt-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.22)] text-xs text-[#f2b1b1] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F87171] animate-pulse" />
              {workingLabel ?? "Quill is working..."}
            </span>
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={isDisabled}
          placeholder={currentPlaceholder}
          rows={1}
          className="w-full bg-transparent resize-none px-4 sm:px-5 py-3.5 sm:py-4 text-sm text-quill-text placeholder-quill-muted outline-none leading-relaxed min-h-16 sm:min-h-13"
          style={{ maxHeight: "160px" }}
        />

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            multiple
            accept="image/*,.pdf,.txt,.md,.csv,.json,.docx,.xlsx"
          />

          {/* Left: attach + search + image */}
          <div className="flex items-center gap-1 overflow-x-auto pr-1">
            <button
              onClick={() => {
                fileInputRef.current?.click();
                setModeDropdownOpen(false);
                setBuilderDropdownOpen(false);
              }}
              disabled={isDisabled}
              title="Attach file"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                attachedFiles && attachedFiles.length > 0
                  ? "text-[#F87171] bg-[rgba(248,113,113,0.1)] hover:bg-[rgba(248,113,113,0.16)]"
                  : "text-quill-muted hover:text-quill-text hover:bg-quill-border"
              }`}
            >
              {/* Mobile: + icon; Desktop: paperclip */}
              <svg className="md:hidden" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <svg className="hidden md:block" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              {attachedFiles && attachedFiles.length > 0 && (
                <span className="text-[10px] bg-[#EF4444] text-white px-1.5 py-0.5 rounded-full">
                  {attachedFiles.length}
                </span>
              )}
            </button>

          {/* Web search standalone button */}
          {showWebSearch && (
            <button
              onClick={() => {
                if (webSearchState === "auth-required") {
                  router.push("/login?callbackUrl=%2Fagent");
                  return;
                }

                if (webSearchState !== "available") {
                  setModeDropdownOpen(false);
                  setBuilderDropdownOpen(false);
                  return;
                }

                onWebSearchToggle();
              }}
              disabled={isDisabled || webSearchState === "coming-soon"}
              title={
                webSearchState === "available"
                  ? webSearchEnabled
                    ? "Web search on - click to disable"
                    : "Enable web search"
                  : webSearchState === "auth-required"
                    ? "Sign in to use web search"
                    : "Web search coming soon"
              }
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all disabled:cursor-not-allowed ${
                webSearchState === "available"
                  ? webSearchEnabled
                    ? "text-quill-green bg-[rgba(52,211,153,0.1)] hover:bg-[rgba(52,211,153,0.16)]"
                    : "text-quill-muted hover:text-quill-text hover:bg-quill-border"
                  : webSearchState === "auth-required"
                    ? "text-quill-muted hover:text-quill-text hover:bg-quill-border"
                    : "text-quill-muted bg-quill-border/40 opacity-70"
              } ${isDisabled ? "opacity-30" : ""}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              {webSearchState === "coming-soon" && (
                <span className="rounded-full border border-quill-border-2 px-1.5 py-0.5 text-[10px] leading-none">
                  Soon
                </span>
              )}
            </button>
          )}

          {/* Generate image standalone button */}
          {onGenerateImage && (
            <button
              onClick={() => {
                if (!imageGenerationEnabled) {
                  router.push("/login?callbackUrl=%2Fagent");
                  return;
                }
                setImageMode((m) => !m);
                setAttachedFiles(null);
              }}
              disabled={isDisabled}
              title={imageGenerationEnabled ? (imageMode ? "Image generation on - click to disable" : "Enable image generation") : "Sign in to generate images"}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                !imageGenerationEnabled
                  ? "text-quill-muted hover:text-quill-text hover:bg-quill-border"
                  : imageMode
                  ? "text-[#F87171] bg-[rgba(248,113,113,0.1)] hover:bg-[rgba(248,113,113,0.16)]"
                  : "text-quill-muted hover:text-quill-text hover:bg-quill-border"
              }`}
            >
              {/* Sparkles icon */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                <path d="M5 3v4" />
                <path d="M19 17v4" />
                <path d="M3 5h4" />
                <path d="M17 19h4" />
              </svg>
            </button>
          )}

          </div>{/* end left group */}

          {/* Right: mode selector + send */}
          <div className="flex items-center gap-1.5 shrink-0" ref={dropdownRef}>
            <div className="relative">
              <button
                onClick={() => {
                  setBuilderDropdownOpen((v) => !v);
                  setModeDropdownOpen(false);
                }}
                disabled={isDisabled}
                title="Builder options"
                className={`flex min-w-17 items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                  builderDropdownOpen || builderTarget !== "auto" || canvasMode
                    ? "bg-quill-border text-quill-text"
                    : "text-quill-muted hover:text-quill-text hover:bg-quill-border"
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="15" y1="3" x2="15" y2="21" />
                </svg>
                {(builderTarget !== "auto" || canvasMode) && (
                  <span className="hidden md:inline">{BUILDER_TARGETS.find((target) => target.id === builderTarget)?.label ?? "Build"}</span>
                )}
                {(builderTarget !== "auto" || canvasMode) && !builderDropdownOpen && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F87171]" />
                )}
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-transform duration-150"
                  style={{ transform: builderDropdownOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {builderDropdownOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-64 bg-quill-surface border border-quill-border rounded-2xl shadow-2xl shadow-black/50 z-50 animate-fade-in overflow-hidden">
                  <div className="overflow-y-auto" style={{ maxHeight: "min(360px, calc(100vh - 140px))" }}>
                    <div className="px-4 pt-1 pb-0.5 text-[10px] font-medium text-quill-muted uppercase tracking-wider">
                      Builder target
                    </div>

                    {BUILDER_TARGETS.map((target) => (
                      <button
                        key={target.id}
                        onClick={() => {
                          onBuilderTargetChange(target.id);
                          setBuilderDropdownOpen(false);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-2 text-sm transition-all text-left hover:bg-quill-surface-2"
                        style={{ color: builderTarget === target.id ? "#F87171" : "#a8a8c0" }}
                      >
                        <span className="flex-1">
                          {target.label}
                          <span className="ml-2 text-[11px] text-quill-muted">{target.desc}</span>
                        </span>
                        {builderTarget === target.id && (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    ))}

                    <div className="border-t border-quill-border mx-2 my-1" />

                    <button
                      onClick={() => {
                        onCanvasToggle();
                        setBuilderDropdownOpen(false);
                      }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-[#a8a8c0] hover:text-quill-text hover:bg-quill-surface-2 transition-all text-left mb-1"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <line x1="15" y1="3" x2="15" y2="21" />
                      </svg>
                      Canvas view
                      {canvasMode && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F87171]" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => {
                  setModeDropdownOpen((v) => !v);
                  setBuilderDropdownOpen(false);
                }}
                disabled={isDisabled}
                title="Model mode"
                className={`flex min-w-15 items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                  modeDropdownOpen
                    ? "bg-quill-border text-quill-text"
                    : "text-quill-muted hover:text-quill-text hover:bg-quill-border"
                }`}
              >
                <span>{currentModeLabel}</span>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-transform duration-150"
                  style={{ transform: modeDropdownOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {modeDropdownOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-64 bg-quill-surface border border-quill-border rounded-2xl shadow-2xl shadow-black/50 z-50 animate-fade-in overflow-hidden">
                  <div className="overflow-y-auto" style={{ maxHeight: "min(420px, calc(100vh - 140px))" }}>
                    <div className="px-4 pt-1 pb-0.5 text-[10px] font-medium text-quill-muted uppercase tracking-wider">
                      Mode
                    </div>

                    {visibleModes.map((m) => {
                      const isEnabled = enabledModes.has(m.id);
                      return (
                      <button
                        key={m.id}
                        onClick={() => {
                          if (!isEnabled) {
                            setModeDropdownOpen(false);
                            router.push("/pricing");
                            return;
                          }
                          onModeChange(m.id);
                          setModeDropdownOpen(false);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-2 text-sm transition-all text-left hover:bg-quill-surface-2"
                        style={{
                          color: !isEnabled ? "#6b6b8a" : mode === m.id ? "#F87171" : "#a8a8c0",
                        }}
                      >
                        <span className="flex-1">
                          {m.label}
                          <span className="ml-2 text-[11px] text-quill-muted">{m.desc}</span>
                        </span>
                        {!isEnabled && (
                          <span className="rounded-full border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-2 py-0.5 text-[10px] font-medium text-[#F87171]">
                            Paid
                          </span>
                        )}
                        {isEnabled && mode === m.id && (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );})}

                    {hasLockedModes && (
                      <div className="mx-3 mb-2 mt-1 rounded-xl border border-quill-accent-glow bg-[rgba(239,68,68,0.05)] p-3">
                        <p className="text-xs text-[#c7c7d8]">Think and Pro require a paid plan.</p>
                        <button
                          onClick={() => {
                            setModeDropdownOpen(false);
                            router.push("/pricing");
                          }}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#EF4444] px-2.5 py-1.5 text-[11px] font-medium text-white transition-all hover:bg-[#DC2626]"
                        >
                          Upgrade
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {canStop ? (
              <button
                onClick={onStop}
                type="button"
                title="Stop generation"
                className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-95 shadow-md bg-[#6b1f24] hover:bg-[#7f252b] shadow-[rgba(107,31,36,0.35)]"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                  <rect x="6" y="6" width="12" height="12" rx="1.5" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!value.trim() || isDisabled}
                className={`w-10 h-10 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 shadow-md ${
                  imageMode
                    ? "bg-[#F87171] hover:bg-[#9370f0] shadow-[rgba(248,113,113,0.3)]"
                    : "bg-[#EF4444] hover:bg-[#DC2626] shadow-[rgba(239,68,68,0.3)]"
                }`}
              >
                {isGeneratingImage ? (
                  <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 12a9 9 0 1 1-6.22-8.56" />
                  </svg>
                ) : imageMode ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hint */}
      <p className="keyboard-hint text-center text-[11px] text-quill-muted">
        <kbd className="px-1 py-0.5 rounded bg-quill-border text-[#a8a8c0] text-[10px] font-mono">Enter</kbd>{" "}
        send &middot;{" "}
        <kbd className="px-1 py-0.5 rounded bg-quill-border text-[#a8a8c0] text-[10px] font-mono">Shift+Enter</kbd>{" "}
        new line
        {imageMode && <span className="ml-2 text-[#EF4444]">· Image generation active</span>}
      </p>
    </div>
  );
}
