"use client";

import type { UIMessage } from "ai";
import { QuillLogo } from "@/components/ui/QuillLogo";
import Image from "next/image";
import { parseBuilderArtifact } from "@/lib/builder-artifacts";

function ToolCallBadge({
  toolName,
  state,
}: {
  toolName: string;
  state: string;
}) {
  const isRunning = state === "input-streaming" || state === "call";
  const isDone = state === "result";

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-quill-border text-xs animate-fade-in"
      style={{
        background: isRunning
          ? "rgba(239,68,68,0.08)"
          : isDone
          ? "rgba(52,211,153,0.06)"
          : "rgba(17,17,24,0.8)",
      }}
    >
      {isRunning ? (
        <svg
          className="animate-spin-slow shrink-0"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#EF4444"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <path d="M21 12a9 9 0 1 1-6.22-8.56" />
        </svg>
      ) : isDone ? (
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#34d399"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <span className="w-2 h-2 rounded-full bg-quill-muted shrink-0" />
      )}

      <span
        className="font-semibold"
        style={{ color: isRunning ? "#F87171" : isDone ? "#34d399" : "#6b6b8a" }}
      >
        {toolName}
      </span>
      <span className="text-quill-muted">
        {isRunning ? "Running..." : isDone ? "Done" : "Pending"}
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
          <pre className="p-4 bg-[#0d0d15] overflow-x-auto text-[12px] font-mono text-[#c8c8e0] leading-relaxed">
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
        <h3 key={i} className="text-sm font-semibold text-[#c8c8e0] mt-2 mb-0.5">
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
          className="pl-3 border-l-2 border-[#EF4444] text-[#a8a8c0] italic my-1"
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

function ArtifactSummary({ text }: { text: string }) {
  const artifact = parseBuilderArtifact(text);
  if (!artifact) return null;

  if (artifact.type === "page") {
    return (
      <div className="text-sm text-quill-text">
        Built page artifact ready in Canvas preview.
      </div>
    );
  }

  if (artifact.type === "react-app" || artifact.type === "nextjs-bundle") {
    const fileCount = Object.keys(artifact.payload.files ?? {}).length;
    return (
      <div className="text-sm text-quill-text">
        Built {artifact.type === "react-app" ? "React app" : "Next.js bundle"} artifact with {fileCount} files. Open Canvas to inspect code.
      </div>
    );
  }

  if (artifact.type === "document") {
    return (
      <div className="text-sm text-quill-text">
        Built document artifact. Open Canvas to read and export.
      </div>
    );
  }

  return null;
}

export function RealMessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const renderedParts = message.parts
    .map((part, i) => {
      // Text part
      if (part.type === "text") {
        const text = part.text?.trim();
        if (!text) return null;

        const artifactSummary = !isUser ? <ArtifactSummary text={text} /> : null;

        return isUser ? (
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
            {artifactSummary ?? <MarkdownText text={text} />}
          </div>
        );
      }

      // File part (user attachments + generated images)
      if (part.type === "file") {
        const filePart = part as { type: "file"; mediaType: string; url: string; filename?: string };
        if (filePart.mediaType.startsWith("image/")) {
          return (
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
          );
        }

        return (
          <a
            key={i}
            href={filePart.url}
            target="_blank"
            rel="noreferrer noopener"
            download={filePart.filename ?? true}
            title="Open attachment"
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-quill-border border border-quill-border-2 text-xs text-[#a8a8c0]"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            <span className="max-w-40 truncate">
              {filePart.filename ?? "Attached file"}
            </span>
          </a>
        );
      }

      if (
        part.type === "dynamic-tool" ||
        part.type.startsWith("tool-")
      ) {
        const toolPart = part as {
          type: string;
          toolName?: string;
          state: string;
        };
        const name =
          toolPart.toolName ?? part.type.replace(/^tool-/, "");
        return (
          <ToolCallBadge key={i} toolName={name} state={toolPart.state} />
        );
      }

      if (part.type === "step-start") {
        return null;
      }

      return null;
    })
    .filter(Boolean);

  if (renderedParts.length === 0) {
    return null;
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
      </div>
    </div>
  );
}
