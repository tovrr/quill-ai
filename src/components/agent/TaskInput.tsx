"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  AdjustmentsHorizontalIcon,
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// Agent/source options for anchoring
const AGENT_SOURCES = [
  { id: "quill", label: "Quill Agent" },
  { id: "openclaw", label: "OpenClaw" },
  { id: "hermes", label: "Hermes Agent" },
  { id: "custom", label: "Custom Agent" },
];

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
  trustIndicators?: string[];
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
  { id: "fast", label: "Flash", desc: "Fastest responses, lighter reasoning" },
  { id: "thinking", label: "Think", desc: "Slower, deeper reasoning for tougher tasks" },
  { id: "advanced", label: "Pro", desc: "Highest quality, best for complex work" },
];

const MODE_HELP: Record<Mode, string> = {
  fast: "Great for quick drafts and short answers.",
  thinking: "Better for planning, debugging, and nuanced tradeoffs.",
  advanced: "Best for high-stakes output quality and difficult tasks.",
};

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
  trustIndicators,
  onReviewKeep,
  onReviewUndo,
}: TaskInputProps) {
  // Agent anchor state
  const [agentSource, setAgentSource] = useState("quill");
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const router = useRouter();
  const [value, setValue] = useState("");
  const [imageMode, setImageMode] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<FileList | null>(null);
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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
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
    : (placeholder ?? "Try: Draft PR summary | Refactor file X | Plan migration Y");
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
  const trustBadges = (trustIndicators ?? []).slice(0, 4);
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
    builderTarget !== "auto" ? (BUILDER_TARGETS.find((target) => target.id === builderTarget)?.label ?? "Build") : null,
    canvasMode ? "Canvas" : null,
  ].filter((value): value is string => Boolean(value));
  const primaryActionLabel = imageMode ? "Create" : builderTarget === "auto" ? "Send" : "Build";

  return (
    <div className="flex flex-col gap-2">
      {/* Input area */}
      <div
        className={`rounded-2xl bg-quill-surface transition-all duration-300 border overflow-hidden ${
          isActiveComposer
            ? "border-[rgba(239,68,68,0.34)] shadow-[0_0_10px_rgba(239,68,68,0.08)]"
            : "border-quill-border shadow-[inset_0_0_0_1px_rgba(239,68,68,0.02)]"
        } ${showWorkingGlow ? "composer-working-glow" : ""}`}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={isDisabled}
          placeholder={currentPlaceholder}
          rows={1}
          className={`w-full bg-transparent resize-none px-3 sm:px-5 text-sm sm:text-[15px] text-quill-text placeholder-quill-muted outline-none leading-relaxed transition-all ${
            mobileExpanded ? "py-2.5 sm:py-4 min-h-12 sm:min-h-13" : "py-2 sm:py-4 min-h-10 sm:min-h-13"
          }`}
          style={{ maxHeight: "160px" }}
        />

        {!imageMode && (isFocused || hasTypedContent || isWorking) && (
          <div className="px-3 pb-2 text-[11px] text-[#AAB1BC] sm:px-5">
            <span className="font-medium text-[#D5DAE3]">{currentModeLabel}:</span> {MODE_HELP[mode]}
          </div>
        )}

        {trustBadges.length > 0 && (isFocused || hasTypedContent || isWorking) && (
          <div className="px-3 pb-2 sm:px-5">
            <div className="flex flex-wrap items-center gap-1.5">
              {trustBadges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-quill-border-2 bg-quill-surface-2 px-2 py-0.5 text-[10px] font-medium text-[#B8C0CB]"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>
        )}

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
                  {attachedFiles && attachedFiles.length > 0
                    ? `${attachedFiles.length} file${attachedFiles.length > 1 ? "s" : ""} attached`
                    : "Attach file"}
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
                          return;
                        }

                        onWebSearchToggle();
                      }}
                      type="button"
                      variant="ghost"
                      disabled={isDisabled || webSearchState === "coming-soon"}
                      aria-label={
                        webSearchState === "available"
                          ? webSearchEnabled
                            ? "Disable web search"
                            : "Search the web"
                          : webSearchState === "auth-required"
                            ? "Sign in to use web search"
                            : "Web search coming soon"
                      }
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
                    {webSearchState === "available"
                      ? webSearchEnabled
                        ? "Disable web search"
                        : "Search the web"
                      : webSearchState === "auth-required"
                        ? "Sign in to use web search"
                        : "Coming soon"}
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
                      aria-label={
                        imageGenerationEnabled
                          ? imageMode
                            ? "Disable image generation"
                            : "Generate an image"
                          : "Sign in to generate images"
                      }
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
                    {imageGenerationEnabled
                      ? imageMode
                        ? "Disable image generation"
                        : "Generate an image"
                      : "Sign in to generate images"}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {/* end left group */}

            {/* Right: config selector + send */}
            <div className="flex shrink-0 items-center gap-1 border-l border-quill-border pl-1.5">
              <div className="hidden md:block">
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={isDisabled}
                          aria-label="Configuration settings"
                          className={
                            "flex min-w-0 items-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all disabled:opacity-30 " +
                            (mode !== "fast" || agentSource !== "quill"
                              ? "bg-quill-border text-quill-text"
                              : "text-quill-muted hover:text-quill-text hover:bg-quill-border")
                          }
                        >
                          <AdjustmentsHorizontalIcon className="h-3.75 w-3.75" aria-hidden="true" />
                          {showControlLabels && <span className="hidden sm:inline">Settings</span>}
                          <ChevronDownIcon
                            className="h-2.5 w-2.5 ml-1 transition-transform duration-150"
                            aria-hidden="true"
                          />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top">Agent, Mode, Skills, and MCPs</TooltipContent>
                  </Tooltip>

                  <DropdownMenuContent align="end" className="w-56 mb-2 bg-[#1A1D21] border-quill-border">
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-quill-muted px-3 py-2">
                      Configuration
                    </DropdownMenuLabel>

                    {/* Agent Source */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="gap-3 w-full py-2.5 px-3">
                        <span>Agent: {AGENT_SOURCES.find((a) => a.id === agentSource)?.label ?? "Quill Agent"}</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-48 bg-[#1A1D21] border-quill-border z-100">
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-quill-muted px-2 py-2">
                          Select Agent
                        </DropdownMenuLabel>
                        <DropdownMenuRadioGroup value={agentSource} onValueChange={setAgentSource}>
                          {AGENT_SOURCES.map((agent) => (
                            <DropdownMenuRadioItem
                              key={agent.id}
                              value={agent.id}
                              className="py-2.5 text-xs cursor-pointer px-2"
                            >
                              {agent.label}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    {/* Mode */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="py-2.5 px-3 gap-3 w-full">
                        <span>Mode: {currentModeLabel}</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-64 bg-[#1A1D21] border-quill-border z-100">
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-quill-muted px-3 pt-2">
                          Model Engine
                        </DropdownMenuLabel>
                        {visibleModes.map((m) => {
                          const isEnabled = enabledModes.has(m.id);
                          return (
                            <DropdownMenuItem
                              key={m.id}
                              onClick={() => {
                                if (!isEnabled) {
                                  router.push("/pricing");
                                  return;
                                }
                                onModeChange(m.id);
                              }}
                              className="items-start gap-3 py-2.5 px-3 cursor-pointer"
                            >
                              <span className="flex flex-1 flex-col gap-0.5">
                                <span
                                  className={
                                    !isEnabled
                                      ? "text-quill-muted"
                                      : mode === m.id
                                        ? "text-[#F87171]"
                                        : "text-[#A1A7B0]"
                                  }
                                >
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
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    {/* Skills */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="py-2.5 px-3 gap-3 w-full opacity-60">
                        <span>Skills (0)</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-56 bg-[#1A1D21] border-quill-border z-100">
                        <div className="px-3 py-3 text-[11px] text-quill-muted text-center italic">
                          Configure specialized commands in your workspace&apos;s .kilocode/skills folder.
                        </div>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    {/* MCPs */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="py-2.5 px-3 gap-3 w-full opacity-60">
                        <span>MCP Servers (0)</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-56 bg-[#1A1D21] border-quill-border z-100">
                        <div className="px-3 py-3 text-[11px] text-quill-muted text-center italic">
                          Configure local Model Context Protocol integrations to enable DB access, git, or Figma.
                        </div>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="md:hidden">
                <Sheet open={mobileSettingsOpen} onOpenChange={setMobileSettingsOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={isDisabled}
                        aria-label="Open mobile settings"
                        onClick={() => setMobileSettingsOpen(true)}
                        className={
                          "flex min-w-0 items-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all disabled:opacity-30 " +
                          (mode !== "fast" || agentSource !== "quill"
                            ? "bg-quill-border text-quill-text"
                            : "text-quill-muted hover:text-quill-text hover:bg-quill-border")
                        }
                      >
                        <AdjustmentsHorizontalIcon className="h-3.75 w-3.75" aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Agent and mode settings</TooltipContent>
                  </Tooltip>

                  <SheetContent side="bottom" className="rounded-t-2xl border-x-0 border-b-0 px-4 pb-6 pt-4">
                    <SheetHeader>
                      <SheetTitle className="text-base">Configuration</SheetTitle>
                      <SheetDescription>Choose source and model behavior for this chat.</SheetDescription>
                    </SheetHeader>

                    <div className="mt-4 space-y-4">
                      <section className="space-y-2">
                        <p className="text-[11px] uppercase tracking-wider text-quill-muted">Agent</p>
                        <div className="grid grid-cols-1 gap-2">
                          {AGENT_SOURCES.map((agent) => {
                            const selected = agentSource === agent.id;
                            return (
                              <Button
                                key={agent.id}
                                type="button"
                                variant="ghost"
                                className={`h-10 justify-between rounded-lg border px-3 ${
                                  selected
                                    ? "border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.09)] text-quill-text"
                                    : "border-quill-border bg-quill-surface-2 text-quill-muted"
                                }`}
                                onClick={() => setAgentSource(agent.id)}
                              >
                                <span className="text-xs">{agent.label}</span>
                                {selected && <CheckIcon className="h-3.75 w-3.75 text-[#F87171]" aria-hidden="true" />}
                              </Button>
                            );
                          })}
                        </div>
                      </section>

                      <section className="space-y-2">
                        <p className="text-[11px] uppercase tracking-wider text-quill-muted">Mode</p>
                        <div className="space-y-2">
                          {visibleModes.map((m) => {
                            const isEnabled = enabledModes.has(m.id);
                            return (
                              <Button
                                key={m.id}
                                type="button"
                                variant="ghost"
                                className={`h-auto w-full items-start justify-between rounded-lg border px-3 py-2 text-left ${
                                  !isEnabled
                                    ? "border-quill-border bg-quill-surface-2 text-quill-muted"
                                    : mode === m.id
                                      ? "border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.09)] text-quill-text"
                                      : "border-quill-border bg-quill-surface-2 text-[#A1A7B0]"
                                }`}
                                onClick={() => {
                                  if (!isEnabled) {
                                    router.push("/pricing");
                                    return;
                                  }
                                  onModeChange(m.id);
                                  setMobileSettingsOpen(false);
                                }}
                              >
                                <span className="flex flex-1 flex-col gap-0.5">
                                  <span className="text-xs">{m.label}</span>
                                  <span className="text-[11px] text-quill-muted">{m.desc}</span>
                                </span>
                                {!isEnabled ? (
                                  <span className="rounded-full border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-2 py-0.5 text-[10px] font-medium text-[#F87171]">
                                    Paid
                                  </span>
                                ) : mode === m.id ? (
                                  <CheckIcon className="h-3.75 w-3.75 shrink-0 text-[#F87171]" aria-hidden="true" />
                                ) : null}
                              </Button>
                            );
                          })}
                        </div>
                      </section>

                      <section className="rounded-lg border border-quill-border bg-quill-surface-2 p-3 text-[11px] text-quill-muted">
                        Skills (0): Configure specialized commands in .kilocode/skills.
                      </section>

                      <section className="rounded-lg border border-quill-border bg-quill-surface-2 p-3 text-[11px] text-quill-muted">
                        MCP Servers (0): Configure local MCP integrations in your workspace settings.
                      </section>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
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
                  className={`h-10 w-10 sm:h-10 sm:w-auto sm:min-w-28 transition-all duration-150 disabled:opacity-35 active:scale-95 ring-1 ring-white/10 shadow-lg ${
                    imageMode
                      ? "bg-[#F87171] hover:bg-[#ef4444] shadow-[0_10px_22px_rgba(248,113,113,0.42)]"
                      : "bg-[#EF4444] hover:bg-[#DC2626] shadow-[0_10px_22px_rgba(239,68,68,0.45)]"
                  } ${value.trim() ? "sm:px-3" : "sm:px-2.5"}`}
                >
                  {isGeneratingImage ? (
                    <ArrowPathIcon className="h-3.25 w-3.25 animate-spin text-white" aria-hidden="true" />
                  ) : imageMode ? (
                    <SparklesIcon className="h-3.25 w-3.25 text-white" aria-hidden="true" />
                  ) : (
                    <PaperAirplaneIcon className="h-3.25 w-3.25 text-white" aria-hidden="true" />
                  )}
                  <span className="hidden sm:inline ml-2 text-xs font-semibold text-white">{primaryActionLabel}</span>
                </Button>
              )}
            </div>
          </div>
        </TooltipProvider>
      </div>

      {activeCapabilityBadges.length > 0 && (isFocused || hasTypedContent || isWorking || imageMode) && (
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          {activeCapabilityBadges.map((label) => (
            <Badge key={label} variant="secondary" className="bg-quill-surface text-[10px] text-quill-muted">
              {label}
            </Badge>
          ))}
        </div>
      )}

      {/* Hint */}
      <div className="keyboard-hint hidden items-center justify-between gap-3 px-1 text-[11px] text-[#AAB1BC] sm:flex">
        <p>
          <kbd className="px-1 py-0.5 rounded bg-quill-border text-[#C4CBD6] text-[10px] font-mono">Enter</kbd> send
          &middot;{" "}
          <kbd className="px-1 py-0.5 rounded bg-quill-border text-[#C4CBD6] text-[10px] font-mono">Shift+Enter</kbd>{" "}
          new line
        </p>
        <p className="truncate text-right">
          {attachedFiles?.length
            ? `${attachedFiles.length} file${attachedFiles.length > 1 ? "s" : ""} attached`
            : "Artifacts and modes stay local to this thread"}
        </p>
      </div>
    </div>
  );
}
