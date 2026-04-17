"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowPathIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  GlobeAltIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  PlusIcon,
  RectangleGroupIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { SparklesIcon, StopIcon } from "@heroicons/react/20/solid";
import type { BuilderTarget } from "@/lib/builder/artifacts";

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
  { id: "auto", label: "Smart", desc: "Quill picks the best format" },
  { id: "page", label: "Live Page", desc: "Preview in browser instantly" },
  { id: "react-app", label: "React App", desc: "Interactive component" },
  { id: "nextjs-bundle", label: "Next.js", desc: "Full app bundle" },
];

const MODES: { id: Mode; label: string; desc: string }[] = [
  { id: "fast", label: "Flash", desc: "Instant answers" },
  { id: "thinking", label: "Think", desc: "More careful and thorough" },
  { id: "advanced", label: "Pro", desc: "Highest quality output" },
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
  const currentModeLabel = MODES.find((m) => m.id === mode)?.label ?? visibleModes[0]?.label ?? "Flash";
  const hasLockedModes = visibleModes.some((m) => !enabledModes.has(m.id));
  const imageGenerationEnabled = canGenerateImage ?? true;
  const hasTypedContent = value.trim().length > 0;
  const isActiveComposer = isFocused || hasTypedContent || imageMode;
  const showWorkingGlow = Boolean(isWorking) || Boolean(isGeneratingImage);
  const canStop = Boolean(isWorking && onStop);
  const mobileExpanded =
    isActiveComposer ||
    Boolean(attachedFiles && attachedFiles.length > 0) ||
    Boolean(isWorking) ||
    Boolean(isGeneratingImage);

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
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-quill-border border border-quill-border-2 text-xs text-[#A1A7B0]"
              >
                <PaperClipIcon className="h-2.75 w-2.75 shrink-0" aria-hidden="true" />
                <span className="max-w-25 truncate">{file.name}</span>
                <button
                  onClick={() => removeFile(i)}
                  className="ml-0.5 text-quill-muted hover:text-quill-text transition-colors"
                  aria-label="Remove file"
                >
                  <XMarkIcon className="h-2.5 w-2.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Image mode badge */}
        {imageMode && (
          <div className="px-4 pt-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-quill-accent-glow border border-[rgba(239,68,68,0.3)] text-xs text-[#F87171] font-medium">
              <SparklesIcon className="h-2.75 w-2.75" aria-hidden="true" />
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
          className={`w-full bg-transparent resize-none px-3 sm:px-5 text-sm text-quill-text placeholder-quill-muted outline-none leading-relaxed transition-all ${
            mobileExpanded
              ? "py-2.5 sm:py-4 min-h-12 sm:min-h-13"
              : "py-2 sm:py-4 min-h-10 sm:min-h-13"
          }`}
          style={{ maxHeight: "160px" }}
        />

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 pb-2.5 pt-1.5">
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
          <div className="flex min-w-0 items-center gap-1 pr-1">
            <button
              onClick={() => {
                fileInputRef.current?.click();
                setModeDropdownOpen(false);
                setBuilderDropdownOpen(false);
              }}
              disabled={isDisabled}
              title="Attach file"
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                attachedFiles && attachedFiles.length > 0
                  ? "text-[#F87171] bg-[rgba(248,113,113,0.1)] hover:bg-[rgba(248,113,113,0.16)]"
                  : "text-quill-muted hover:text-quill-text hover:bg-quill-border"
              }`}
            >
              {/* Mobile: + icon; Desktop: paperclip */}
              <PlusIcon className="h-4.5 w-4.5 md:hidden" aria-hidden="true" />
              <PaperClipIcon className="hidden h-4.5 w-4.5 md:block" aria-hidden="true" />
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
              className={`${mobileExpanded ? "flex" : "hidden md:flex"} items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all disabled:cursor-not-allowed ${
                webSearchState === "available"
                  ? webSearchEnabled
                    ? "text-quill-green bg-[rgba(52,211,153,0.1)] hover:bg-[rgba(52,211,153,0.16)]"
                    : "text-quill-muted hover:text-quill-text hover:bg-quill-border"
                  : webSearchState === "auth-required"
                    ? "text-quill-muted hover:text-quill-text hover:bg-quill-border"
                    : "text-quill-muted bg-quill-border/40 opacity-70"
              } ${isDisabled ? "opacity-30" : ""}`}
            >
              <GlobeAltIcon className="h-4.5 w-4.5" aria-hidden="true" />
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
              className={`${mobileExpanded ? "flex" : "hidden md:flex"} items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                !imageGenerationEnabled
                  ? "text-quill-muted hover:text-quill-text hover:bg-quill-border"
                  : imageMode
                  ? "text-[#F87171] bg-[rgba(248,113,113,0.1)] hover:bg-[rgba(248,113,113,0.16)]"
                  : "text-quill-muted hover:text-quill-text hover:bg-quill-border"
              }`}
            >
              {/* Sparkles icon */}
              <SparklesIcon className="h-3.25 w-3.25" aria-hidden="true" />
            </button>
          )}

          </div>{/* end left group */}

          {/* Right: mode selector + send */}
          <div className="flex shrink-0 items-center gap-1 border-l border-quill-border pl-1.5" ref={dropdownRef}>
            <div className="relative">
              <button
                onClick={() => {
                  setBuilderDropdownOpen((v) => !v);
                  setModeDropdownOpen(false);
                }}
                disabled={isDisabled}
                title="Builder options"
                className={`${mobileExpanded ? "flex" : "hidden md:flex"} min-w-0 items-center justify-between gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed sm:min-w-17 ${
                  builderDropdownOpen || builderTarget !== "auto" || canvasMode
                    ? "bg-quill-border text-quill-text"
                    : "text-quill-muted hover:text-quill-text hover:bg-quill-border"
                }`}
              >
                <RectangleGroupIcon className="h-3 w-3" aria-hidden="true" />
                {(builderTarget !== "auto" || canvasMode) && (
                  <span className="hidden sm:inline">{BUILDER_TARGETS.find((target) => target.id === builderTarget)?.label ?? "Build"}</span>
                )}
                {(builderTarget !== "auto" || canvasMode) && !builderDropdownOpen && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F87171]" />
                )}
                <ChevronDownIcon
                  className="h-2.5 w-2.5 transition-transform duration-150"
                  aria-hidden="true"
                  style={{ transform: builderDropdownOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              </button>

              {builderDropdownOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-64 bg-quill-surface border border-quill-border rounded-2xl shadow-2xl shadow-black/50 z-50 animate-fade-in overflow-hidden">
                  <div className="overflow-y-auto" style={{ maxHeight: "min(360px, calc(100vh - 140px))" }}>
                    <div className="px-4 pt-1 pb-0.5 text-[10px] font-medium text-quill-muted uppercase tracking-wider">
                      Output format
                    </div>

                    {BUILDER_TARGETS.map((target) => (
                      <button
                        key={target.id}
                        onClick={() => {
                          onBuilderTargetChange(target.id);
                          setBuilderDropdownOpen(false);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-2 text-sm transition-all text-left hover:bg-quill-surface-2"
                        style={{ color: builderTarget === target.id ? "#F87171" : "#A1A7B0" }}
                      >
                        <span className="flex-1">
                          {target.label}
                          <span className="ml-2 text-[11px] text-quill-muted">{target.desc}</span>
                        </span>
                        {builderTarget === target.id && (
                          <CheckIcon className="h-3.25 w-3.25 shrink-0" aria-hidden="true" />
                        )}
                      </button>
                    ))}

                    <div className="border-t border-quill-border mx-2 my-1" />

                    <button
                      onClick={() => {
                        onCanvasToggle();
                        setBuilderDropdownOpen(false);
                      }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-[#A1A7B0] hover:text-quill-text hover:bg-quill-surface-2 transition-all text-left mb-1"
                    >
                      <RectangleGroupIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Preview panel
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
                className={`flex min-w-0 items-center justify-between gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed sm:min-w-15 ${
                  modeDropdownOpen
                    ? "bg-quill-border text-quill-text"
                    : "text-quill-muted hover:text-quill-text hover:bg-quill-border"
                }`}
              >
                <span className="hidden sm:inline">{currentModeLabel}</span>
                <ChevronDownIcon
                  className="h-2.5 w-2.5 transition-transform duration-150"
                  aria-hidden="true"
                  style={{ transform: modeDropdownOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                />
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
                          color: !isEnabled ? "#838387" : mode === m.id ? "#F87171" : "#A1A7B0",
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
                          <CheckIcon className="h-3.25 w-3.25 shrink-0" aria-hidden="true" />
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
                          <ArrowRightIcon className="h-2.75 w-2.75" aria-hidden="true" />
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
                className="w-9 h-9 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-95 shadow-md bg-[#6b1f24] hover:bg-[#7f252b] shadow-[rgba(107,31,36,0.35)]"
              >
                  <StopIcon className="h-3 w-3 text-white" aria-hidden="true" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!value.trim() || isDisabled}
                className={`w-9 h-9 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 shadow-md ${
                  imageMode
                    ? "bg-[#F87171] hover:bg-[#9370f0] shadow-[rgba(248,113,113,0.3)]"
                    : "bg-[#EF4444] hover:bg-[#DC2626] shadow-[rgba(239,68,68,0.3)]"
                }`}
              >
                {isGeneratingImage ? (
                  <ArrowPathIcon className="h-3.25 w-3.25 animate-spin text-white" aria-hidden="true" />
                ) : imageMode ? (
                  <SparklesIcon className="h-3.25 w-3.25 text-white" aria-hidden="true" />
                ) : (
                  <PaperAirplaneIcon className="h-3.25 w-3.25 text-white" aria-hidden="true" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hint */}
      <p className="keyboard-hint hidden text-center text-[11px] text-quill-muted sm:block">
        <kbd className="px-1 py-0.5 rounded bg-quill-border text-[#A1A7B0] text-[10px] font-mono">Enter</kbd>{" "}
        send &middot;{" "}
        <kbd className="px-1 py-0.5 rounded bg-quill-border text-[#A1A7B0] text-[10px] font-mono">Shift+Enter</kbd>{" "}
        new line
        {imageMode && <span className="ml-2 text-[#EF4444]">· Image generation active</span>}
      </p>
    </div>
  );
}
