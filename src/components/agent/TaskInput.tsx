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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  sendOnEnter?: boolean;
  showActionLabels?: boolean;
  reviewSummary?: {
    label: string;
    additions?: number;
    deletions?: number;
    keepLabel?: string;
    undoLabel?: string;
  };
  onReviewKeep?: () => void;
  onReviewUndo?: () => void;
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
  sendOnEnter = true,
  showActionLabels = false,
  reviewSummary,
  onReviewKeep,
  onReviewUndo,
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
  const initialDraftHydratedRef = useRef(false);
  const initialFileHydratedRef = useRef(false);
  const isComposingRef = useRef(false);

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
    if (sendOnEnter && e.key === "Enter" && !e.shiftKey) {
      // Guard against IME composition (CJK keyboards confirm via Enter)
      if (e.nativeEvent.isComposing || isComposingRef.current || e.keyCode === 229) return;
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
  const showControlLabels = showActionLabels || isActiveComposer || mobileExpanded;
  const showReviewRow = Boolean(reviewSummary);
  const compactToolbarButtons = !showControlLabels;
  const compactAttachButton = compactToolbarButtons && !(attachedFiles && attachedFiles.length > 0);
  const compactBuilderButton = compactToolbarButtons && builderTarget === "auto" && !canvasMode;
  const toolbarButtonBaseClass = "rounded-lg text-xs font-medium whitespace-nowrap transition-all";
  const toolbarButtonSizingClass = compactToolbarButtons ? "h-10 w-10 justify-center px-0" : "gap-1.5 px-2.5 py-1.5";
  const attachButtonSizingClass = compactAttachButton ? "h-10 w-10 justify-center px-0" : "gap-1.5 px-2.5 py-1.5";
  const builderButtonSizingClass = compactBuilderButton
    ? "h-10 w-10 justify-center gap-1 px-0 sm:min-w-0"
    : "justify-between gap-1.5 px-2.5 py-1.5 sm:min-w-17";
  const modeButtonSizingClass = compactToolbarButtons
    ? "justify-center gap-1.5 sm:min-w-15"
    : "justify-between gap-1.5 sm:min-w-15";
  const activeCapabilityBadges = [
    webSearchEnabled ? "Web search" : null,
    imageMode ? "Image" : null,
    builderTarget !== "auto" ? BUILDER_TARGETS.find((target) => target.id === builderTarget)?.label ?? "Build" : null,
    canvasMode ? "Canvas" : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="flex flex-col gap-2">
      {/* Input area */}
      <div
        className={`rounded-2xl bg-quill-surface transition-all duration-300 border overflow-hidden ${
          isActiveComposer
            ? "border-[rgba(239,68,68,0.55)] shadow-[0_0_24px_rgba(239,68,68,0.16)]"
            : "border-quill-border shadow-[inset_0_0_0_1px_rgba(239,68,68,0.03)]"
        } ${showWorkingGlow ? "composer-working-glow" : ""}`}
      >
        {showReviewRow ? (
          <div className="flex items-center justify-between gap-2 border-b border-quill-border/70 px-3 py-2 text-[11px]">
            <div className="flex min-w-0 items-center gap-2 text-quill-text">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-quill-accent" />
              <span className="truncate font-medium">{reviewSummary?.label}</span>
              {typeof reviewSummary?.additions === "number" && (
                <span className="shrink-0 text-quill-green">+{reviewSummary.additions}</span>
              )}
              {typeof reviewSummary?.deletions === "number" && (
                <span className="shrink-0 text-[#f2a1a1]">-{reviewSummary.deletions}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                onClick={() => {
                  onReviewKeep?.();
                }}
                variant="outline"
                className="h-auto rounded-lg border-quill-border-2 bg-quill-surface-2 px-2 py-1 text-[11px] text-quill-text hover:border-[rgba(239,68,68,0.35)]"
              >
                {reviewSummary?.keepLabel ?? "Keep"}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setValue("");
                  setAttachedFiles(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                  setImageMode(false);
                  onReviewUndo?.();
                }}
                variant="outline"
                className="h-auto rounded-lg border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-2 py-1 text-[11px] text-[#f7b0b0] hover:bg-[rgba(239,68,68,0.14)]"
              >
                {reviewSummary?.undoLabel ?? "Undo"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="hidden items-center justify-between gap-2 border-b border-quill-border/70 px-4 py-2 text-[11px] sm:flex">
            <div className="inline-flex min-w-0 items-center gap-2 text-quill-muted">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-quill-accent" />
              <span className="truncate">Describe a task</span>
            </div>
            <span className="truncate text-[10px] uppercase tracking-[0.12em] text-quill-muted">
              {imageMode ? "Image mode" : currentModeLabel}
            </span>
          </div>
        )}

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
                <Button
                  type="button"
                  onClick={() => removeFile(i)}
                  variant="ghost"
                  size="icon"
                  className="ml-0.5 h-5 w-5 text-quill-muted hover:text-quill-text"
                  aria-label="Remove file"
                >
                  <XMarkIcon className="h-2.5 w-2.5" aria-hidden="true" />
                </Button>
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
          onCompositionStart={() => { isComposingRef.current = true; }}
          onCompositionEnd={() => { isComposingRef.current = false; }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={isDisabled}
          placeholder={currentPlaceholder}
          rows={1}
          className={`w-full bg-transparent resize-none px-3 sm:px-5 text-sm sm:text-[15px] text-quill-text placeholder-quill-muted outline-none leading-relaxed transition-all ${
            mobileExpanded
              ? "py-2.5 sm:py-4 min-h-12 sm:min-h-13"
              : "py-2 sm:py-4 min-h-10 sm:min-h-13"
          }`}
          style={{ maxHeight: "160px" }}
        />

        {/* Toolbar */}
        <TooltipProvider delayDuration={500}>
        <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-quill-border/70 px-2.5 pb-2.5 pt-2">
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
            <Tooltip>
              <TooltipTrigger asChild>
            <Button
              onClick={() => {
                fileInputRef.current?.click();
                setModeDropdownOpen(false);
                setBuilderDropdownOpen(false);
              }}
              type="button"
              variant="ghost"
              disabled={isDisabled}
              aria-label="Attach file"
              className={`flex items-center ${toolbarButtonBaseClass} disabled:opacity-30 ${attachButtonSizingClass} ${
                attachedFiles && attachedFiles.length > 0
                  ? "text-[#F87171] bg-[rgba(248,113,113,0.1)] hover:bg-[rgba(248,113,113,0.16)]"
                  : "text-quill-muted hover:text-quill-text hover:bg-quill-border"
              }`}
            >
              {/* Mobile: + icon; Desktop: paperclip */}
              <PlusIcon className="h-4.5 w-4.5 md:hidden" aria-hidden="true" />
              <PaperClipIcon className="hidden h-4.5 w-4.5 md:block" aria-hidden="true" />
              {showControlLabels && <span className="hidden sm:inline">Attach</span>}
              {attachedFiles && attachedFiles.length > 0 && (
                <span className="text-[10px] bg-[#EF4444] text-white px-1.5 py-0.5 rounded-full">
                  {attachedFiles.length}
                </span>
              )}
            </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {attachedFiles && attachedFiles.length > 0 ? `${attachedFiles.length} file${attachedFiles.length > 1 ? "s" : ""} attached` : "Attach file"}
              </TooltipContent>
            </Tooltip>

          {/* Web search standalone button */}
          {showWebSearch && (
            <Tooltip>
              <TooltipTrigger asChild>
            <Button
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
              type="button"
              variant="ghost"
              disabled={isDisabled || webSearchState === "coming-soon"}
              aria-label={webSearchState === "available" ? (webSearchEnabled ? "Disable web search" : "Search the web") : webSearchState === "auth-required" ? "Sign in to use web search" : "Web search coming soon"}
              className={`flex items-center ${toolbarButtonBaseClass} ${toolbarButtonSizingClass} ${
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
              {showControlLabels && <span className="hidden sm:inline">Search</span>}
              {webSearchState === "coming-soon" && (
                <span className="rounded-full border border-quill-border-2 px-1.5 py-0.5 text-[10px] leading-none">
                  Soon
                </span>
              )}
            </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {webSearchState === "available" ? (webSearchEnabled ? "Disable web search" : "Search the web") : webSearchState === "auth-required" ? "Sign in to use web search" : "Coming soon"}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Generate image standalone button */}
          {onGenerateImage && (
            <Tooltip>
              <TooltipTrigger asChild>
            <Button
              onClick={() => {
                if (!imageGenerationEnabled) {
                  router.push("/login?callbackUrl=%2Fagent");
                  return;
                }
                setImageMode((m) => !m);
                setAttachedFiles(null);
              }}
              type="button"
              variant="ghost"
              disabled={isDisabled}
              aria-label={imageGenerationEnabled ? (imageMode ? "Disable image generation" : "Generate an image") : "Sign in to generate images"}
              className={`flex items-center ${toolbarButtonBaseClass} disabled:opacity-30 ${toolbarButtonSizingClass} ${
                !imageGenerationEnabled
                  ? "text-quill-muted hover:text-quill-text hover:bg-quill-border"
                  : imageMode
                  ? "text-[#F87171] bg-[rgba(248,113,113,0.1)] hover:bg-[rgba(248,113,113,0.16)]"
                  : "text-quill-muted hover:text-quill-text hover:bg-quill-border"
              }`}
            >
              {/* Sparkles icon */}
              <SparklesIcon className="h-3.25 w-3.25" aria-hidden="true" />
              {showControlLabels && <span className="hidden sm:inline">Image</span>}
            </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {imageGenerationEnabled ? (imageMode ? "Disable image generation" : "Generate an image") : "Sign in to generate images"}
              </TooltipContent>
            </Tooltip>
          )}

          </div>{/* end left group */}

          {/* Right: mode selector + send */}
          <div className="flex shrink-0 items-center gap-1 border-l border-quill-border pl-1.5">
            <DropdownMenu open={builderDropdownOpen} onOpenChange={setBuilderDropdownOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isDisabled}
                  aria-label="Builder options"
                  className={`flex min-w-0 items-center ${toolbarButtonBaseClass} disabled:opacity-30 ${builderButtonSizingClass} ${
                    builderDropdownOpen || builderTarget !== "auto" || canvasMode
                      ? "bg-quill-border text-quill-text"
                      : "text-quill-muted hover:text-quill-text hover:bg-quill-border"
                  }`}
                >
                  <RectangleGroupIcon className="h-3 w-3" aria-hidden="true" />
                  {(builderTarget !== "auto" || canvasMode || showControlLabels) && (
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
                </Button>
              </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top">Output format &amp; canvas</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-quill-muted">Output format</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={builderTarget}
                  onValueChange={(value) => onBuilderTargetChange(value as BuilderTarget)}
                >
                  {BUILDER_TARGETS.map((target) => (
                    <DropdownMenuRadioItem key={target.id} value={target.id} className="items-start py-2">
                      <span className="flex flex-col gap-0.5">
                        <span>{target.label}</span>
                        <span className="text-[11px] text-quill-muted">{target.desc}</span>
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onCanvasToggle} className="gap-3 py-2.5">
                  <RectangleGroupIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Preview panel</span>
                  {canvasMode && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F87171]" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu open={modeDropdownOpen} onOpenChange={setModeDropdownOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isDisabled}
                  aria-label="Model mode"
                  className={`flex min-w-0 items-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all disabled:opacity-30 ${modeButtonSizingClass} ${
                    modeDropdownOpen
                      ? "bg-quill-border text-quill-text"
                      : "text-quill-muted hover:text-quill-text hover:bg-quill-border"
                  }`}
                >
                  <span className={showControlLabels ? "hidden sm:inline" : "inline text-[11px] sm:inline"}>
                    {showControlLabels ? currentModeLabel : currentModeLabel}
                  </span>
                  <ChevronDownIcon
                    className="h-2.5 w-2.5 transition-transform duration-150"
                    aria-hidden="true"
                    style={{ transform: modeDropdownOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                </Button>
              </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top">Select AI model</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-quill-muted">Mode</DropdownMenuLabel>
                {visibleModes.map((m) => {
                  const isEnabled = enabledModes.has(m.id);
                  return (
                    <DropdownMenuItem
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
                      className="items-start gap-3 py-2"
                    >
                      <span className="flex flex-1 flex-col gap-0.5">
                        <span className={!isEnabled ? "text-quill-muted" : mode === m.id ? "text-[#F87171]" : "text-[#A1A7B0]"}>
                          {m.label}
                        </span>
                        <span className="text-[11px] text-quill-muted">{m.desc}</span>
                      </span>
                      {!isEnabled ? (
                        <span className="rounded-full border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-2 py-0.5 text-[10px] font-medium text-[#F87171]">
                          Paid
                        </span>
                      ) : mode === m.id ? (
                        <CheckIcon className="h-3.25 w-3.25 shrink-0 text-[#F87171]" aria-hidden="true" />
                      ) : null}
                    </DropdownMenuItem>
                  );
                })}

                {hasLockedModes && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="mx-1 rounded-xl border border-quill-accent-glow bg-[rgba(239,68,68,0.05)] p-3">
                      <p className="text-xs text-[#c7c7d8]">Think and Pro require a paid plan.</p>
                      <Button
                        type="button"
                        onClick={() => {
                          setModeDropdownOpen(false);
                          router.push("/pricing");
                        }}
                        className="mt-2 inline-flex h-auto items-center gap-1.5 rounded-lg bg-[#EF4444] px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-[#DC2626]"
                      >
                        Upgrade
                        <ArrowRightIcon className="h-2.75 w-2.75" aria-hidden="true" />
                      </Button>
                    </div>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {canStop ? (
              <Tooltip>
                <TooltipTrigger asChild>
              <Button
                onClick={onStop}
                type="button"
                size="icon"
                aria-label="Stop generation"
                className="h-9 w-9 sm:h-9 sm:w-9 transition-all duration-150 active:scale-95 shadow-md bg-[#6b1f24] hover:bg-[#7f252b] shadow-[rgba(107,31,36,0.35)]"
              >
                  <StopIcon className="h-3 w-3 text-white" aria-hidden="true" />
              </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Stop generation</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                onClick={handleSend}
                type="button"
                size="icon"
                disabled={!value.trim() || isDisabled}
                style={{ touchAction: "manipulation" }}
                className={`h-9 w-9 sm:h-9 sm:w-9 transition-all duration-150 disabled:opacity-30 active:scale-95 shadow-md ${
                  imageMode
                    ? "bg-[#F87171] hover:bg-[#ef4444] shadow-[rgba(248,113,113,0.3)]"
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
              </Button>
            )}
          </div>
        </div>
        </TooltipProvider>
      </div>

      {activeCapabilityBadges.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          {activeCapabilityBadges.map((label) => (
            <Badge key={label} variant="secondary" className="bg-quill-surface text-[10px] text-quill-muted">
              {label}
            </Badge>
          ))}
        </div>
      )}

      {/* Hint */}
      <div className="keyboard-hint hidden items-center justify-between gap-3 px-1 text-[11px] text-quill-muted sm:flex">
        <p>
          <kbd className="px-1 py-0.5 rounded bg-quill-border text-[#A1A7B0] text-[10px] font-mono">Enter</kbd>{" "}
          send &middot;{" "}
          <kbd className="px-1 py-0.5 rounded bg-quill-border text-[#A1A7B0] text-[10px] font-mono">Shift+Enter</kbd>{" "}
          new line
        </p>
        <p className="truncate text-right">
          {attachedFiles?.length ? `${attachedFiles.length} file${attachedFiles.length > 1 ? "s" : ""} attached` : "Artifacts and modes stay local to this thread"}
        </p>
      </div>
    </div>
  );
}
