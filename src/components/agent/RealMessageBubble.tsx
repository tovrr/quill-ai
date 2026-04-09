"use client";

import { useState } from "react";
import {
  ArrowPathIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  ExclamationCircleIcon,
  HandThumbDownIcon,
  HandThumbUpIcon,
  PaperClipIcon,
} from "@heroicons/react/24/outline";
import type { UIMessage } from "ai";
import { QuillLogo } from "@/components/ui/QuillLogo";
import Image from "next/image";
import {
  extractTextFromMessageParts,
  hasRenderableTextValue,
  isRenderableMessagePart,
  getMessageParts,
  hasRenderableAssistantContent,
  NON_RENDERABLE_ASSISTANT_FALLBACK_TEXT,
  normalizeVisibleText,
} from "@/lib/assistant-message-utils";
import { parseBuilderArtifact } from "@/lib/builder-artifacts";

function ToolCallBadge({
  toolName,
  state,
}: {
  toolName: string;
  state: string;
}) {
  const isRunning = state === "input-streaming" || state === "input-available" || state === "call";
  const isDone = state === "result" || state === "output-available";
  const isError = state === "output-error";

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-quill-border text-xs animate-fade-in"
      style={{
        background: isRunning
          ? "rgba(239,68,68,0.08)"
          : isDone
          ? "rgba(52,211,153,0.06)"
          : isError
          ? "rgba(248,113,113,0.1)"
          : "rgba(17,17,24,0.8)",
      }}
    >
      {isRunning ? (
        <ArrowPathIcon className="h-3.25 w-3.25 animate-spin-slow shrink-0 text-[#EF4444]" aria-hidden="true" />
      ) : isDone ? (
        <CheckIcon className="h-3.25 w-3.25 shrink-0 text-quill-green" aria-hidden="true" />
      ) : (
        <span className="w-2 h-2 rounded-full bg-quill-muted shrink-0" />
      )}

      <span
        className="font-semibold"
        style={{ color: isRunning ? "#F87171" : isDone ? "#34d399" : isError ? "#fca5a5" : "#838387" }}
      >
        {toolName}
      </span>
      <span className="text-quill-muted">
        {isRunning ? "Running..." : isDone ? "Done" : isError ? "Failed" : "Pending"}
      </span>
    </div>
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
        <code
          key={i}
          className="px-1 py-0.5 rounded bg-quill-border text-[#F87171] text-[12px] font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={i} className="italic text-[#C1C7D0]">
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
          <pre className="p-4 bg-[#0d0d15] overflow-x-auto text-[12px] font-mono text-[#C1C7D0] leading-relaxed">
            <code>{codeLines.join("\n")}</code>
          </pre>
        </div>
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
          {alt && (
            <p className="text-[11px] text-quill-muted mt-1.5 italic">{alt}</p>
          )}
        </div>
      );
      i++;
      continue;
    }

    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-base font-bold text-quill-text mt-3 mb-1">
          {renderInline(line.slice(2))}
        </h1>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-sm font-bold text-quill-text mt-2.5 mb-0.5">
          {renderInline(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-sm font-semibold text-[#C1C7D0] mt-2 mb-0.5">
          {renderInline(line.slice(4))}
        </h3>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={i} className="flex gap-2 pl-2">
          <span className="text-[#EF4444] mt-0.5 shrink-0">•</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\. /.test(line)) {
      const match = line.match(/^(\d+)\. (.*)/);
      if (match) {
        elements.push(
          <div key={i} className="flex gap-2 pl-2">
            <span className="text-[#EF4444] shrink-0 tabular-nums">{match[1]}.</span>
            <span>{renderInline(match[2])}</span>
          </div>
        );
      }
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={i}
          className="pl-3 border-l-2 border-[#EF4444] text-[#A1A7B0] italic my-1"
        >
          {renderInline(line.slice(2))}
        </blockquote>
      );
    } else if (line === "" || line === "---" || line === "***") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i}>{renderInline(line)}</p>);
    }

    i++;
  }

  return (
    <div className="text-sm leading-relaxed space-y-1">{elements}</div>
  );
}

function hasMarkdownSyntax(text: string): boolean {
  return /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s)|```|`[^`]|!\[[^\]]*\]\([^)]*\)|\*\*|__/.test(text);
}

function ArtifactSummary({ text, onOpenCanvas }: { text: string; onOpenCanvas?: (content: string) => void }) {
  const artifact = parseBuilderArtifact(text);
  if (!artifact) return null;

  const action = onOpenCanvas ? (
    <button
      onClick={() => onOpenCanvas(text)}
      className="shrink-0 px-2 py-1 rounded-md border border-quill-border text-[10px] font-medium text-quill-muted hover:text-quill-text hover:border-quill-border-2 hover:bg-quill-surface-2 transition-all"
      title="Open this artifact in Canvas"
      aria-label="Open this artifact in Canvas"
    >
      Show Canvas
    </button>
  ) : null;

  if (artifact.type === "page") {
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm text-quill-text">
          Built page artifact ready in Canvas preview.
        </div>
        {action}
      </div>
    );
  }

  if (artifact.type === "react-app" || artifact.type === "nextjs-bundle") {
    const fileCount = Object.keys(artifact.payload.files ?? {}).length;
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm text-quill-text">
          Built {artifact.type === "react-app" ? "React app" : "Next.js bundle"} artifact with {fileCount} files. Open Canvas to inspect code.
        </div>
        {action}
      </div>
    );
  }

  if (artifact.type === "document") {
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm text-quill-text">
          Built document artifact. Open Canvas to read and export.
        </div>
        {action}
      </div>
    );
  }

  return null;
}

export function RealMessageBubble({ message, onOpenCanvasFromMessage }: { message: UIMessage; onOpenCanvasFromMessage?: (content: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [reaction, setReaction] = useState<"like" | "dislike" | null>(null);
  const isUser = message.role === "user";
  const parts = getMessageParts(message);
  const isAssistant = !isUser && message.role === "assistant";
  const assistantPlainText = isAssistant ? extractTextFromMessageParts(parts as unknown[]) : "";
  const canReact = isAssistant && hasRenderableTextValue(assistantPlainText);

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

  const renderedPartEntries = parts
    .map((part, i) => {
      // Text part
      if (part.type === "text") {
        const text = normalizeVisibleText(part.text);
        if (!hasRenderableTextValue(text)) return { kind: "text" as const, node: null };

        const hasArtifact = !isUser && Boolean(parseBuilderArtifact(text));

        const node = isUser ? (
          <div
            key={i}
            className="px-4 py-3 rounded-2xl rounded-tr-sm bg-[#EF4444] text-white text-sm leading-relaxed"
          >
            {text}
          </div>
        ) : (
          <div
            key={i}
            className="px-4 py-3 rounded-2xl rounded-tl-sm bg-quill-surface border border-quill-border text-quill-text w-full"
          >
            {hasArtifact ? (
              <ArtifactSummary text={text} onOpenCanvas={onOpenCanvasFromMessage} />
            ) : hasMarkdownSyntax(text) ? (
              <MarkdownText text={text} />
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">{text}</p>
            )}
          </div>
        );

        return { kind: "text" as const, node };
      }

      if (part.type === "reasoning") {
        const text = normalizeVisibleText(part.text);
        if (!hasRenderableTextValue(text)) return { kind: "reasoning" as const, node: null };

        return {
          kind: "reasoning" as const,
          node: (
          <details
            key={i}
            className="w-full rounded-2xl rounded-tl-sm bg-[#131321] border border-quill-border text-[#B1B7C0]"
          >
            <summary className="cursor-pointer list-none px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-quill-muted">
              Reasoning summary
            </summary>
            <div className="border-t border-quill-border px-4 py-3">
              <MarkdownText text={text} />
            </div>
          </details>
          ),
        };
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
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-quill-border border border-quill-border-2 text-xs text-[#A1A7B0]"
          >
            <PaperClipIcon className="h-3.25 w-3.25 text-[#EF4444]" aria-hidden="true" />
            <span className="max-w-40 truncate">
              {filePart.filename ?? "Attached file"}
            </span>
          </a>
          ),
        };
      }

      if (
        part.type === "dynamic-tool" ||
        (typeof part.type === "string" && part.type.startsWith("tool-"))
      ) {
        if (!isRenderableMessagePart(part)) {
          return { kind: "tool" as const, node: null };
        }

        const toolPart = part as {
          type: string;
          toolName?: string;
          state: string;
        };
        const name =
          normalizeVisibleText(toolPart.toolName) || normalizeVisibleText(part.type.replace(/^tool-/, "")) || "Tool";
        const state = normalizeVisibleText(toolPart.state) || "output-available";

        return {
          kind: "tool" as const,
          node: <ToolCallBadge key={i} toolName={name} state={state} />,
        };
      }

      if (part.type === "step-start") {
        return { kind: "other" as const, node: null };
      }

      return { kind: "other" as const, node: null };
    });

  const renderedParts = renderedPartEntries
    .map((entry) => entry.node)
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const hasPrimaryAssistantContent = renderedPartEntries.some(
    (entry) =>
      Boolean(entry.node) &&
      (entry.kind === "text" || entry.kind === "reasoning" || entry.kind === "file"),
  );

  if (renderedParts.length === 0) {
    if (isAssistant) {
      const fallbackText = hasRenderableTextValue(assistantPlainText)
        ? assistantPlainText
        : NON_RENDERABLE_ASSISTANT_FALLBACK_TEXT;

      return (
        <div className="flex items-start gap-3 animate-fade-in">
          <div className="w-7 h-7 rounded-full bg-quill-surface border border-quill-border flex items-center justify-center shrink-0 mt-0.5">
            <QuillLogo size={16} />
          </div>
          <div className="flex flex-col gap-2 max-w-[80%] items-start">
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
      <div className="flex items-start gap-3 animate-fade-in">
        <div className="w-7 h-7 rounded-full bg-quill-surface border border-quill-border flex items-center justify-center shrink-0 mt-0.5">
          <QuillLogo size={16} />
        </div>
        <div className="flex flex-col gap-2 max-w-[80%] items-start">
          <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-quill-surface border border-quill-border text-quill-text w-full">
            <MarkdownText text={fallbackText} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-3 animate-fade-in ${
        isUser ? "flex-row-reverse" : ""
      }`}
    >
      {/* Avatar */}
      {isUser ? (
        <div className="w-7 h-7 rounded-full bg-linear-to-br from-[#F87171] to-[#F87171] flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-0.5">
          U
        </div>
      ) : (
        <div className="w-7 h-7 rounded-full bg-quill-surface border border-quill-border flex items-center justify-center shrink-0 mt-0.5">
          <QuillLogo size={16} />
        </div>
      )}

      {/* Content */}
      <div
        className={`flex flex-col gap-2 max-w-[80%] ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        {renderedParts}
        {canReact && (
          <div className="relative flex items-center gap-1.5 px-1">
            <button
              onClick={handleCopy}
              className={`p-1 rounded-md transition-all ${copied ? "text-quill-green bg-[rgba(52,211,153,0.12)]" : "text-quill-muted hover:text-quill-text hover:bg-quill-surface-2"}`}
              title={copied ? "Copied" : "Copy"}
              aria-label="Copy assistant message"
            >
              {copied ? (
                <CheckIcon className="h-3.25 w-3.25" aria-hidden="true" />
              ) : (
                <ClipboardDocumentIcon className="h-3.25 w-3.25" aria-hidden="true" />
              )}
            </button>
            <button
              onClick={() => setReaction((r) => (r === "like" ? null : "like"))}
              className={`p-1 rounded-md transition-all ${reaction === "like" ? "text-quill-green bg-[rgba(52,211,153,0.12)]" : "text-quill-muted hover:text-quill-text hover:bg-quill-surface-2"}`}
              title="Like"
              aria-label="Like assistant message"
            >
              <HandThumbUpIcon className="h-3.25 w-3.25" aria-hidden="true" />
            </button>
            <button
              onClick={() => setReaction((r) => (r === "dislike" ? null : "dislike"))}
              className={`p-1 rounded-md transition-all ${reaction === "dislike" ? "text-[#f87171] bg-[rgba(248,113,113,0.12)]" : "text-quill-muted hover:text-quill-text hover:bg-quill-surface-2"}`}
              title="Dislike"
              aria-label="Dislike assistant message"
            >
              <HandThumbDownIcon className="h-3.25 w-3.25" aria-hidden="true" />
            </button>
            {copied && (
              <span
                className="absolute -bottom-6 left-1 rounded-md border border-[rgba(52,211,153,0.25)] bg-[rgba(52,211,153,0.12)] px-2 py-0.5 text-[10px] font-medium text-quill-green"
                aria-live="polite"
              >
                Copied
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
