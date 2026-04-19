"use client";

import { memo, useState } from "react";
import {
  ArrowPathIcon,
  CheckIcon,
  ChevronDownIcon,
  ClipboardDocumentIcon,
  ExclamationCircleIcon,
  HandThumbDownIcon,
  HandThumbUpIcon,
  PaperClipIcon,
} from "@heroicons/react/24/outline";
import type { UIMessage } from "ai";
import { QuillLogo } from "@/components/ui/QuillLogo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import Image from "next/image";
import {
  extractTextFromMessageParts,
  hasRenderableTextValue,
  isRenderableMessagePart,
  getMessageParts,
  hasRenderableAssistantContent,
  NON_RENDERABLE_ASSISTANT_FALLBACK_TEXT,
  normalizeVisibleText,
} from "@/lib/ai/assistant-message-utils";
import { parseBuilderArtifact } from "@/lib/builder/artifacts";

type ConversationLayoutMode = "workspace" | "chat";

// â”€â”€ Tool label helpers (ported from open-cowork) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function shortenPath(p: string): string {
  if (typeof p !== "string") return String(p);
  const segments = p.replace(/\\/g, "/").split("/").filter(Boolean);
  if (segments.length <= 2) return segments.join("/");
  return segments.slice(-2).join("/");
}

function getToolLabel(name: string, input: Record<string, unknown>): string {
  const inp = input ?? {};
  if (name.startsWith("mcp__")) {
    const match = name.match(/^mcp__(.+?)__(.+)$/);
    return match?.[2] ?? name;
  }
  const n = name.toLowerCase();
  if (n === "read" || n === "read_file") {
    const p = String(inp.file_path ?? inp.path ?? "");
    return p ? `Read ${shortenPath(p)}` : "Read file";
  }
  if (n === "write" || n === "write_file") {
    const p = String(inp.file_path ?? inp.path ?? "");
    return p ? `Write ${shortenPath(p)}` : "Write file";
  }
  if (n === "edit" || n === "edit_file") {
    const p = String(inp.file_path ?? inp.path ?? "");
    return p ? `Edit ${shortenPath(p)}` : "Edit file";
  }
  if (n === "bash" || n === "execute_command") {
    const cmd = String(inp.command ?? inp.cmd ?? "");
    if (cmd) return `$ ${cmd.length > 60 ? cmd.slice(0, 57) + "..." : cmd}`;
    return "Run command";
  }
  if (n === "glob") return inp.pattern ? `Glob ${String(inp.pattern)}` : "Glob";
  if (n === "grep") return inp.pattern ? `Grep "${String(inp.pattern)}"` : "Grep";
  if (n === "websearch") return inp.query ? `Search "${String(inp.query)}"` : "Web search";
  if (n === "webfetch") {
    const url = String(inp.url ?? "");
    return url ? `Fetch ${url.length > 50 ? url.slice(0, 47) + "..." : url}` : "Fetch URL";
  }
  return name;
}

// â”€â”€ Reasoning preview helper (strips dangling ** from truncation boundary) â”€â”€â”€â”€
function renderReasoningPreview(raw: string): React.ReactNode[] {
  const text = raw.replace(/\*{1,2}(?:\.{3})?$/, (m) => (m.endsWith("...") ? "..." : ""));
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <strong key={key++} className="font-semibold not-italic">
        {match[1]}
      </strong>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

// â”€â”€ Reasoning block â€” collapsible with 80-char preview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ReasoningBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const preview = text.length > 80 ? text.slice(0, 77) + "..." : text;
  const previewNodes = renderReasoningPreview(preview);
  return (
    <div className="w-full rounded-2xl rounded-tl-sm bg-[#131321] border border-quill-border overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-quill-surface/40 transition-colors"
      >
        <span className="text-[11px] font-medium uppercase tracking-wide text-quill-muted shrink-0">Reasoning</span>
        {!expanded && (
          <span className="text-[11px] text-quill-muted/60 truncate flex-1 min-w-0 italic">{previewNodes}</span>
        )}
        <ChevronDownIcon
          className={`ml-auto h-3.5 w-3.5 text-quill-muted shrink-0 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>
      {expanded && (
        <div className="border-t border-quill-border px-4 py-3 animate-fade-in">
          <MarkdownText text={text} />
        </div>
      )}
    </div>
  );
}

function prettyJson(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function ToolCallBadge({
  toolName,
  state,
  input,
  output,
  errorText,
}: {
  toolName: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: unknown;
}) {
  const isRunning = state === "input-streaming" || state === "input-available" || state === "call";
  const isDone = state === "result" || state === "output-available";
  const isError = state === "output-error";
  const inputText = prettyJson(input);
  const outputText = prettyJson(output);
  const errorOutput = prettyJson(errorText);
  const hasDetails = Boolean(inputText || outputText || errorOutput);
  const statusLabel = isRunning ? "Running" : isDone ? "Done" : isError ? "Failed" : "Pending";

  const containerClass = `w-full rounded-2xl border text-xs animate-fade-in ${
    isRunning
      ? "border-[rgba(239,68,68,0.26)] bg-[rgba(239,68,68,0.08)]"
      : isDone
        ? "border-[rgba(52,211,153,0.22)] bg-[rgba(52,211,153,0.06)]"
        : isError
          ? "border-[rgba(248,113,113,0.28)] bg-[rgba(248,113,113,0.08)]"
          : "border-quill-border bg-[rgba(17,17,24,0.8)]"
  }`;

  const header = (
    <div className="flex w-full items-start gap-3 px-4 py-3 text-left">
      <div className="mt-0.5 shrink-0">
        {isRunning ? (
          <ArrowPathIcon className="h-3.5 w-3.5 animate-spin-slow text-[#EF4444]" aria-hidden="true" />
        ) : isDone ? (
          <CheckIcon className="h-3.5 w-3.5 text-quill-green" aria-hidden="true" />
        ) : isError ? (
          <ExclamationCircleIcon className="h-3.5 w-3.5 text-[#fca5a5]" aria-hidden="true" />
        ) : (
          <span className="mt-0.5 block h-2.5 w-2.5 rounded-full bg-quill-muted" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold text-quill-text">
            {getToolLabel(toolName, (input && typeof input === "object" ? input : {}) as Record<string, unknown>)}
          </span>
          <Badge
            variant="secondary"
            className={`px-2 py-0 text-[10px] ${
              isRunning
                ? "border-[rgba(239,68,68,0.16)] bg-[rgba(239,68,68,0.12)] text-[#F87171]"
                : isDone
                  ? "border-[rgba(52,211,153,0.16)] bg-[rgba(52,211,153,0.1)] text-quill-green"
                  : isError
                    ? "border-[rgba(248,113,113,0.18)] bg-[rgba(248,113,113,0.12)] text-[#fca5a5]"
                    : "text-quill-muted"
            }`}
          >
            {statusLabel}
          </Badge>
          <span className="text-[11px] text-quill-muted">Tool step</span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-quill-muted">
          {isRunning
            ? "Quill is waiting for this tool to finish."
            : isDone
              ? "Tool result is ready."
              : isError
                ? "Tool returned an error."
                : "Tool queued."}
        </p>
      </div>
    </div>
  );

  if (!hasDetails) {
    return <div className={containerClass}>{header}</div>;
  }

  return (
    <Collapsible className={containerClass}>
      <CollapsibleTrigger className="group w-full">
        <div className="flex w-full items-start gap-3 text-left">
          <div className="flex-1">{header}</div>
          <div className="px-4 py-3">
            <ChevronDownIcon
              className="mt-0.5 h-3.5 w-3.5 text-quill-muted transition-transform group-data-[state=open]:rotate-180"
              aria-hidden="true"
            />
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-quill-border/80 px-4 py-3">
        <div className="grid gap-3">
          {inputText && (
            <div className="grid gap-1">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-quill-muted">Input</span>
              <pre className="overflow-x-auto rounded-xl border border-quill-border bg-[#0d0d15] p-3 font-mono text-[11px] leading-relaxed text-[#c8c8e0]">
                {inputText}
              </pre>
            </div>
          )}
          {outputText && (
            <div className="grid gap-1">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-quill-muted">Output</span>
              <pre className="overflow-x-auto rounded-xl border border-quill-border bg-[#0d0d15] p-3 font-mono text-[11px] leading-relaxed text-[#c8c8e0]">
                {outputText}
              </pre>
            </div>
          )}
          {errorOutput && (
            <div className="grid gap-1">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#fca5a5]">Error</span>
              <pre className="overflow-x-auto rounded-xl border border-[rgba(248,113,113,0.24)] bg-[rgba(248,113,113,0.08)] p-3 font-mono text-[11px] leading-relaxed text-[#f6b1b1]">
                {errorOutput}
              </pre>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-quill-text">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="px-1 py-0.5 rounded bg-quill-border text-[#F87171] text-[12px] font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={i} className="italic text-[#c8c8e0]">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <div key={i} className="my-2 rounded-xl overflow-hidden border border-quill-border">
          {lang && (
            <div className="px-3 py-1.5 bg-[#0d0d15] border-b border-quill-border text-[10px] text-quill-muted font-mono uppercase tracking-wide">
              {lang}
            </div>
          )}
          <div className="relative bg-[#0d0d15]">
            <pre className="p-4 md:p-4 overflow-x-auto text-[11px] md:text-[12px] font-mono text-[#c8c8e0] leading-relaxed">
              <code>{codeLines.join("\n")}</code>
            </pre>
            {/* Mobile scroll hint */}
            <div className="md:hidden absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[#0d0d15] to-transparent pointer-events-none flex items-center justify-end pr-1">
              <svg className="w-3 h-3 text-quill-muted/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>,
      );
      i++;
      continue;
    }

    // Markdown image: ![alt](url)
    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      const [, alt, src] = imageMatch;
      elements.push(
        <div key={i} className="my-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt || "Generated image"}
            className="rounded-xl max-w-full max-h-100 object-contain border border-quill-border"
          />
          {alt && <p className="text-[11px] text-quill-muted mt-1.5 italic">{alt}</p>}
        </div>,
      );
      i++;
      continue;
    }

    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-base font-bold text-quill-text mt-3 mb-1">
          {renderInline(line.slice(2))}
        </h1>,
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-sm font-bold text-quill-text mt-2.5 mb-0.5">
          {renderInline(line.slice(3))}
        </h2>,
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-sm font-semibold text-[#c8c8e0] mt-2 mb-0.5">
          {renderInline(line.slice(4))}
        </h3>,
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={i} className="flex gap-2 pl-2">
          <span className="text-[#EF4444] mt-0.5 shrink-0">â€¢</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>,
      );
    } else if (/^\d+\. /.test(line)) {
      const match = line.match(/^(\d+)\. (.*)/);
      if (match) {
        elements.push(
          <div key={i} className="flex gap-2 pl-2">
            <span className="text-[#EF4444] shrink-0 tabular-nums">{match[1]}.</span>
            <span>{renderInline(match[2])}</span>
          </div>,
        );
      }
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={i} className="pl-3 border-l-2 border-[#EF4444] text-[#a8a8c0] italic my-1">
          {renderInline(line.slice(2))}
        </blockquote>,
      );
    } else if (line === "" || line === "---" || line === "***") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i}>{renderInline(line)}</p>);
    }

    i++;
  }

  return <div className="text-[15px] leading-[1.65] space-y-1.5">{elements}</div>;
}

function hasMarkdownSyntax(text: string): boolean {
  return /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s)|```|`[^`]|!\[[^\]]*\]\([^)]*\)|\*\*|__/.test(text);
}

function ArtifactSummary({ text, onOpenCanvas }: { text: string; onOpenCanvas?: (content: string) => void }) {
  const artifact = parseBuilderArtifact(text);
  if (!artifact) return null;

  const action = onOpenCanvas ? (
    <Button
      onClick={() => onOpenCanvas(text)}
      variant="outline"
      size="sm"
      className="shrink-0 h-auto rounded-md px-2 py-1 text-[10px] font-medium text-quill-muted hover:bg-quill-surface-2 hover:text-quill-text"
      title="Open this artifact in Canvas"
      aria-label="Open this artifact in Canvas"
    >
      Show Canvas
    </Button>
  ) : null;

  if (artifact.type === "page") {
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm text-quill-text">Built page artifact ready in Canvas preview.</div>
        {action}
      </div>
    );
  }

  if (artifact.type === "react-app" || artifact.type === "nextjs-bundle") {
    const fileCount = Object.keys(artifact.payload.files ?? {}).length;
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm text-quill-text">
          Built {artifact.type === "react-app" ? "React app" : "Next.js bundle"} artifact with {fileCount} files. Open
          Canvas to inspect code.
        </div>
        {action}
      </div>
    );
  }

  if (artifact.type === "document") {
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm text-quill-text">Built document artifact. Open Canvas to read and export.</div>
        {action}
      </div>
    );
  }

  return null;
}

export const RealMessageBubble = memo(function RealMessageBubble({
  message,
  onOpenCanvasFromMessage,
  onRegenerate,
  layoutMode = "workspace",
  showAssistantAvatar = false,
  assistantBubbles = false,
  contextualActions = true,
  compact = false,
  isStreaming = false,
}: {
  message: UIMessage;
  onOpenCanvasFromMessage?: (content: string) => void;
  onRegenerate?: () => void;
  layoutMode?: ConversationLayoutMode;
  showAssistantAvatar?: boolean;
  assistantBubbles?: boolean;
  contextualActions?: boolean;
  compact?: boolean;
  isStreaming?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [reaction, setReaction] = useState<"like" | "dislike" | null>(null);
  const isUser = message.role === "user";
  const parts = getMessageParts(message);
  const isAssistant = !isUser && message.role === "assistant";
  const assistantPlainText = isAssistant ? extractTextFromMessageParts(parts as unknown[]) : "";
  const reasoningSummaryText = isAssistant
    ? parts
        .filter((part) => part.type === "reasoning")
        .map((part) => normalizeVisibleText(part.text))
        .filter((text) => hasRenderableTextValue(text))
        .join("\n\n")
    : "";
  const canReact = isAssistant && hasRenderableTextValue(assistantPlainText);
  const actionButtonBaseClass =
    "flex h-[30px] w-[30px] items-center justify-center rounded-full border border-transparent transition-all sm:h-8 sm:w-8";
  const actionIconClass = "h-[15px] w-[15px] sm:h-4 sm:w-4";
  const speakerLabel = isUser ? "You" : "Quill";
  const useWorkspaceStyle = layoutMode === "workspace";
  const hideAssistantAvatar = isAssistant && useWorkspaceStyle && !showAssistantAvatar;
  const hideUserAvatar = isUser && useWorkspaceStyle;
  const showSpeakerLabel = useWorkspaceStyle;
  const showAssistantBubble = !isAssistant || !useWorkspaceStyle || assistantBubbles;
  const showResponseActions = canReact && !isStreaming;

  const handleCopy = async () => {
    if (!assistantPlainText) return;
    try {
      await navigator.clipboard.writeText(assistantPlainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard failures
    }
  };

  const renderedPartEntries = parts.map((part, i) => {
    // Text part
    if (part.type === "text") {
      const text = normalizeVisibleText(part.text);
      if (!hasRenderableTextValue(text)) return { kind: "text" as const, node: null };

      const hasArtifact = !isUser && Boolean(parseBuilderArtifact(text));

      const node = isUser ? (
        <div key={i} className="px-4 py-3 rounded-2xl rounded-tr-sm bg-[#EF4444] text-white text-[15px] leading-[1.65]">
          {text}
        </div>
      ) : (
        <div
          key={i}
          className={
            showAssistantBubble
              ? "px-4 py-3 rounded-2xl rounded-tl-sm bg-quill-surface border border-quill-border text-quill-text w-full"
              : "w-full text-quill-text"
          }
        >
          {hasArtifact ? (
            <ArtifactSummary text={text} onOpenCanvas={onOpenCanvasFromMessage} />
          ) : hasMarkdownSyntax(text) ? (
            <MarkdownText text={text} />
          ) : (
            <p className="text-[15px] leading-[1.65] whitespace-pre-wrap wrap-break-word">{text}</p>
          )}
        </div>
      );

      return { kind: "text" as const, node };
    }

    if (part.type === "reasoning") {
      return { kind: "reasoning" as const, node: null };
    }

    // File part (user attachments + generated images)
    if (part.type === "file") {
      const filePart = part as { type: "file"; mediaType: string; url: string; filename?: string };
      if (filePart.mediaType.startsWith("image/")) {
        return {
          kind: "file" as const,
          node: (
            <div key={i} className="rounded-xl overflow-hidden border border-quill-border max-w-70">
              <Image
                src={filePart.url}
                alt={filePart.filename ?? "Attached image"}
                width={280}
                height={280}
                className="object-contain w-full"
                unoptimized
              />
            </div>
          ),
        };
      }

      return {
        kind: "file" as const,
        node: (
          <a
            key={i}
            href={filePart.url}
            target="_blank"
            rel="noreferrer noopener"
            download={filePart.filename ?? true}
            title="Open attachment"
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-quill-border border border-quill-border-2 text-xs text-[#a8a8c0]"
          >
            <PaperClipIcon className="h-3.25 w-3.25 text-[#EF4444]" aria-hidden="true" />
            <span className="max-w-40 truncate">{filePart.filename ?? "Attached file"}</span>
          </a>
        ),
      };
    }

    if (part.type === "dynamic-tool" || (typeof part.type === "string" && part.type.startsWith("tool-"))) {
      if (!isRenderableMessagePart(part)) {
        return { kind: "tool" as const, node: null };
      }

      const toolPart = part as {
        type: string;
        toolName?: string;
        state: string;
        input?: unknown;
        output?: unknown;
        errorText?: unknown;
        error?: unknown;
        result?: unknown;
      };
      const name =
        normalizeVisibleText(toolPart.toolName) || normalizeVisibleText(part.type.replace(/^tool-/, "")) || "Tool";
      const state = normalizeVisibleText(toolPart.state) || "output-available";
      const output = toolPart.output ?? toolPart.result;
      const errorText = toolPart.errorText ?? toolPart.error;

      return {
        kind: "tool" as const,
        node: (
          <ToolCallBadge
            key={i}
            toolName={name}
            state={state}
            input={toolPart.input}
            output={output}
            errorText={errorText}
          />
        ),
      };
    }

    if (part.type === "step-start") {
      return { kind: "other" as const, node: null };
    }

    return { kind: "other" as const, node: null };
  });

  const reasoningParts = hasRenderableTextValue(reasoningSummaryText)
    ? [<ReasoningBlock key="reasoning-summary" text={reasoningSummaryText} />]
    : [];

  const primaryParts = renderedPartEntries
    .filter((entry) => entry.kind !== "reasoning" && Boolean(entry.node))
    .map((entry) => entry.node)
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const renderedParts = [...reasoningParts, ...primaryParts];

  const hasPrimaryAssistantContent = renderedPartEntries.some(
    (entry) => Boolean(entry.node) && (entry.kind === "text" || entry.kind === "reasoning" || entry.kind === "file"),
  );

  if (renderedParts.length === 0) {
    if (isAssistant) {
      const fallbackText = hasRenderableTextValue(assistantPlainText)
        ? assistantPlainText
        : NON_RENDERABLE_ASSISTANT_FALLBACK_TEXT;

      return (
        <div className="group flex items-start gap-3 animate-fade-in">
          {hideAssistantAvatar ? (
            <div className="w-1 shrink-0" aria-hidden="true" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-quill-surface border border-quill-border flex items-center justify-center shrink-0 mt-0.5">
              <QuillLogo size={16} />
            </div>
          )}
          <div className="flex max-w-[min(100%,52rem)] flex-col gap-2 items-start">
            {showSpeakerLabel && (
              <div className="px-1 text-[10px] font-medium uppercase tracking-[0.18em] text-quill-muted">
                {speakerLabel}
              </div>
            )}
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-quill-surface border border-quill-border text-quill-text w-full">
              <MarkdownText text={fallbackText} />
            </div>
          </div>
        </div>
      );
    }

    return null;
  }

  if (isAssistant && !hasPrimaryAssistantContent) {
    const fallbackText = hasRenderableTextValue(assistantPlainText)
      ? assistantPlainText
      : NON_RENDERABLE_ASSISTANT_FALLBACK_TEXT;

    return (
      <div className="group flex items-start gap-3 animate-fade-in">
        {hideAssistantAvatar ? (
          <div className="w-1 shrink-0" aria-hidden="true" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-quill-surface border border-quill-border flex items-center justify-center shrink-0 mt-0.5">
            <QuillLogo size={16} />
          </div>
        )}
        <div className="flex max-w-[min(100%,52rem)] flex-col gap-2 items-start">
          {showSpeakerLabel && (
            <div className="px-1 text-[10px] font-medium uppercase tracking-[0.18em] text-quill-muted">
              {speakerLabel}
            </div>
          )}
          <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-quill-surface border border-quill-border text-quill-text w-full">
            <MarkdownText text={fallbackText} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`group flex items-start gap-3 animate-fade-in ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      {isUser && !hideUserAvatar ? (
        <div className="w-7 h-7 rounded-full bg-linear-to-br from-[#F87171] to-[#F87171] flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-0.5">
          U
        </div>
      ) : !isUser && !hideAssistantAvatar ? (
        <div className="w-7 h-7 rounded-full bg-quill-surface border border-quill-border flex items-center justify-center shrink-0 mt-0.5">
          <QuillLogo size={16} />
        </div>
      ) : (
        <div className="w-1 shrink-0" aria-hidden="true" />
      )}

      {/* Content */}
      <div
        className={`flex max-w-[min(100%,52rem)] flex-col ${compact ? "gap-1" : "gap-2"} ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        {showSpeakerLabel && (
          <div className="px-1 text-[10px] font-medium uppercase tracking-[0.18em] text-quill-muted">
            {speakerLabel}
          </div>
        )}
        {reasoningParts}
        {primaryParts}
        {showResponseActions && (
          <div
            className={`relative mt-1 flex items-center gap-px rounded-full border border-quill-border bg-[rgba(17,17,24,0.75)] px-1 py-1 transition-opacity sm:gap-0.5 ${
              contextualActions ? "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" : "opacity-100"
            }`}
          >
            {/* Like */}
            <button
              onClick={() => setReaction((r) => (r === "like" ? null : "like"))}
              className={`${actionButtonBaseClass} ${
                reaction === "like"
                  ? "border-[rgba(52,211,153,0.18)] bg-[rgba(52,211,153,0.12)] text-quill-green"
                  : "text-quill-muted hover:border-quill-border hover:text-quill-text hover:bg-white/5"
              }`}
              title="Good response"
              aria-label="Like assistant message"
            >
              <HandThumbUpIcon className={actionIconClass} aria-hidden="true" />
            </button>
            {/* Dislike */}
            <button
              onClick={() => setReaction((r) => (r === "dislike" ? null : "dislike"))}
              className={`${actionButtonBaseClass} ${
                reaction === "dislike"
                  ? "border-[rgba(248,113,113,0.18)] bg-[rgba(248,113,113,0.12)] text-[#f87171]"
                  : "text-quill-muted hover:border-quill-border hover:text-quill-text hover:bg-white/5"
              }`}
              title="Bad response"
              aria-label="Dislike assistant message"
            >
              <HandThumbDownIcon className={actionIconClass} aria-hidden="true" />
            </button>
            {/* Regenerate */}
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className={`${actionButtonBaseClass} text-quill-muted hover:border-quill-border hover:text-quill-text hover:bg-white/5`}
                title="Regenerate response"
                aria-label="Regenerate response"
              >
                <ArrowPathIcon className={actionIconClass} aria-hidden="true" />
              </button>
            )}
            {/* Copy */}
            <button
              onClick={handleCopy}
              className={`${actionButtonBaseClass} ${
                copied
                  ? "border-[rgba(52,211,153,0.18)] bg-[rgba(52,211,153,0.12)] text-quill-green"
                  : "text-quill-muted hover:border-quill-border hover:text-quill-text hover:bg-white/5"
              }`}
              title={copied ? "Copied!" : "Copy"}
              aria-label="Copy assistant message"
            >
              {copied ? (
                <CheckIcon className={actionIconClass} aria-hidden="true" />
              ) : (
                <ClipboardDocumentIcon className={actionIconClass} aria-hidden="true" />
              )}
            </button>
            {copied && (
              <span
                className="absolute -top-7 right-2 rounded-md border border-[rgba(52,211,153,0.25)] bg-[rgba(52,211,153,0.1)] px-2 py-0.5 text-[10px] font-medium text-quill-green whitespace-nowrap pointer-events-none"
                aria-live="polite"
              >
                Copied!
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

RealMessageBubble.displayName = "RealMessageBubble";
