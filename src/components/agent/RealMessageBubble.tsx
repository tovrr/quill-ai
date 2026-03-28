"use client";

import type { UIMessage } from "ai";
import { QuillLogo } from "@/components/ui/QuillLogo";

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
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-[#1e1e2e] text-xs animate-fade-in"
      style={{
        background: isRunning
          ? "rgba(124,106,247,0.08)"
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
          stroke="#7c6af7"
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
        <span className="w-2 h-2 rounded-full bg-[#6b6b8a] shrink-0" />
      )}

      <span
        className="font-semibold"
        style={{ color: isRunning ? "#a78bfa" : isDone ? "#34d399" : "#6b6b8a" }}
      >
        {toolName}
      </span>
      <span className="text-[#6b6b8a]">
        {isRunning ? "Running..." : isDone ? "Done" : "Pending"}
      </span>
    </div>
  );
}

function MarkdownText({ text }: { text: string }) {
  // Very simple inline markdown: bold, code, line breaks
  const lines = text.split("\n");
  return (
    <div className="text-sm leading-relaxed space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("# ")) {
          return (
            <h1 key={i} className="text-base font-bold text-[#e8e8f0] mt-2">
              {line.slice(2)}
            </h1>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h2 key={i} className="text-sm font-bold text-[#e8e8f0] mt-2">
              {line.slice(3)}
            </h2>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h3 key={i} className="text-sm font-semibold text-[#c8c8e0] mt-1.5">
              {line.slice(4)}
            </h3>
          );
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <div key={i} className="flex gap-2 pl-2">
              <span className="text-[#7c6af7] mt-0.5 shrink-0">•</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          );
        }
        if (/^\d+\. /.test(line)) {
          const [num, ...rest] = line.split(". ");
          return (
            <div key={i} className="flex gap-2 pl-2">
              <span className="text-[#7c6af7] shrink-0 tabular-nums">{num}.</span>
              <span>{renderInline(rest.join(". "))}</span>
            </div>
          );
        }
        if (line.startsWith("```")) {
          return null; // handled below
        }
        if (line === "") {
          return <div key={i} className="h-1" />;
        }
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string) {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[#e8e8f0]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="px-1 py-0.5 rounded bg-[#1e1e2e] text-[#a78bfa] text-[12px] font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export function RealMessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex items-start gap-3 animate-fade-in ${
        isUser ? "flex-row-reverse" : ""
      }`}
    >
      {/* Avatar */}
      {isUser ? (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#a78bfa] to-[#60a5fa] flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-0.5">
          U
        </div>
      ) : (
        <div className="w-7 h-7 rounded-full bg-[#111118] border border-[#1e1e2e] flex items-center justify-center shrink-0 mt-0.5">
          <QuillLogo size={16} />
        </div>
      )}

      {/* Content */}
      <div
        className={`flex flex-col gap-2 max-w-[80%] ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text" && part.text) {
            return isUser ? (
              <div
                key={i}
                className="px-4 py-3 rounded-2xl rounded-tr-sm bg-[#7c6af7] text-white text-sm leading-relaxed"
              >
                {part.text}
              </div>
            ) : (
              <div
                key={i}
                className="px-4 py-3 rounded-2xl rounded-tl-sm bg-[#111118] border border-[#1e1e2e] text-[#e8e8f0] w-full"
              >
                <MarkdownText text={part.text} />
              </div>
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
              toolPart.toolName ??
              part.type.replace(/^tool-/, "");
            return (
              <ToolCallBadge key={i} toolName={name} state={toolPart.state} />
            );
          }

          if (part.type === "step-start") {
            return (
              <div key={i} className="text-[10px] text-[#3a3a5e] px-1">
                — step start —
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
