"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractHTML(content: string): string {
  const trimmed = content.trim();
  // Strip markdown code fences if the model wrapped the output
  const fenceMatch = trimmed.match(/^```(?:html)?\n([\s\S]*?)```\s*$/i);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}

export function isHTMLContent(content: string): boolean {
  const src = extractHTML(content).toLowerCase();
  return (
    src.startsWith("<!doctype html") ||
    src.startsWith("<html") ||
    (src.includes("<html") && src.includes("</html>"))
  );
}

// ---------------------------------------------------------------------------
// Markdown document renderer (for non-HTML responses)
// ---------------------------------------------------------------------------

function renderInlineCanvas(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[#1a1a2e]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded bg-[#f0f0ff] text-[#5b4dd4] text-[12px] font-mono border border-[#ddd9ff]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function MarkdownDocument({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <div key={i} className="my-4 rounded-xl overflow-hidden border border-[#e0deff]">
          {lang && (
            <div className="px-3 py-1.5 bg-[#f5f3ff] border-b border-[#e0deff] text-[10px] text-[#EF4444] font-mono uppercase tracking-wide">
              {lang}
            </div>
          )}
          <pre className="p-4 bg-[#faf9ff] overflow-x-auto text-[12px] font-mono text-[#3a3a60] leading-relaxed">
            <code>{codeLines.join("\n")}</code>
          </pre>
        </div>
      );
      i++;
      continue;
    }

    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-2xl font-bold text-[#1a1a2e] mt-6 mb-2 leading-tight">
          {renderInlineCanvas(line.slice(2))}
        </h1>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-lg font-bold text-[#1a1a2e] mt-5 mb-1.5">
          {renderInlineCanvas(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-base font-semibold text-[#2a2a4e] mt-4 mb-1">
          {renderInlineCanvas(line.slice(4))}
        </h3>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={i} className="flex gap-2.5 pl-2 py-0.5">
          <span className="text-[#EF4444] mt-1 shrink-0 text-xs">●</span>
          <span className="text-[#3a3a60] text-sm leading-relaxed">
            {renderInlineCanvas(line.slice(2))}
          </span>
        </div>
      );
    } else if (/^\d+\. /.test(line)) {
      const match = line.match(/^(\d+)\. (.*)/);
      if (match) {
        elements.push(
          <div key={i} className="flex gap-2.5 pl-2 py-0.5">
            <span className="text-[#EF4444] shrink-0 tabular-nums text-sm font-medium">{match[1]}.</span>
            <span className="text-[#3a3a60] text-sm leading-relaxed">
              {renderInlineCanvas(match[2])}
            </span>
          </div>
        );
      }
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={i} className="pl-4 border-l-4 border-[#EF4444] text-[#5a5a8a] italic my-2 py-1">
          {renderInlineCanvas(line.slice(2))}
        </blockquote>
      );
    } else if (line === "" || line === "---") {
      elements.push(<div key={i} className="h-3" />);
    } else {
      elements.push(
        <p key={i} className="text-[#3a3a60] text-sm leading-relaxed">
          {renderInlineCanvas(line)}
        </p>
      );
    }

    i++;
  }

  return <div className="space-y-1">{elements}</div>;
}

// ---------------------------------------------------------------------------
// Main CanvasPanel
// ---------------------------------------------------------------------------

interface CanvasPanelProps {
  content: string;
  onClose: () => void;
}

type Tab = "preview" | "code";

export function CanvasPanel({ content, onClose }: CanvasPanelProps) {
  const [tab, setTab] = useState<Tab>("preview");
  const [copied, setCopied] = useState(false);

  const isHTML = isHTMLContent(content);
  const htmlSrc = isHTML ? extractHTML(content) : "";

  const handleCopy = () => {
    const text = isHTML ? htmlSrc : content;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const text = isHTML ? htmlSrc : content;
    const mime = isHTML ? "text/html" : "text/markdown";
    const ext = isHTML ? "html" : "md";
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quill-${isHTML ? "page" : "document"}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenInTab = () => {
    const blob = new Blob([htmlSrc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const dark = isHTML;

  return (
    <div
      className="flex flex-col h-full"
      style={{
        width: "520px",
        borderLeft: "1px solid #1e1e2e",
        background: dark ? "#0a0a0f" : "#fafafe",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{
          borderBottom: `1px solid ${dark ? "#1e1e2e" : "#e8e6ff"}`,
          background: dark ? "#0d0d15" : "#fff",
        }}
      >
        {/* Left: icon + title + tabs */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#EF4444] to-[#F87171] flex items-center justify-center shrink-0">
              {isHTML ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              )}
            </div>
            <span className={`text-sm font-semibold ${dark ? "text-[#e8e8f0]" : "text-[#1a1a2e]"}`}>
              Canvas
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${dark ? "bg-[#1e1e2e] text-[#EF4444]" : "bg-[#f0f0ff] text-[#EF4444]"}`}>
              {isHTML ? "page" : "document"}
            </span>
          </div>

          {/* Preview / Code tabs — HTML only */}
          {isHTML && content && (
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#111118] border border-[#1e1e2e]">
              <button
                onClick={() => setTab("preview")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  tab === "preview" ? "bg-[#EF4444] text-white" : "text-[#6b6b8a] hover:text-[#a8a8c0]"
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setTab("code")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  tab === "code" ? "bg-[#EF4444] text-white" : "text-[#6b6b8a] hover:text-[#a8a8c0]"
                }`}
              >
                Code
              </button>
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-0.5">
          {/* Open in new tab — HTML only */}
          {isHTML && content && (
            <button
              onClick={handleOpenInTab}
              title="Open in new tab"
              className="p-1.5 rounded-lg text-[#6b6b8a] hover:text-[#e8e8f0] hover:bg-[#1e1e2e] transition-all"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </button>
          )}

          {/* Copy */}
          <button
            onClick={handleCopy}
            disabled={!content}
            title="Copy source"
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all disabled:opacity-40 ${
              dark
                ? "text-[#6b6b8a] hover:text-[#e8e8f0] hover:bg-[#1e1e2e]"
                : "text-[#5a5a8a] hover:bg-[#f0f0ff] hover:text-[#EF4444]"
            }`}
          >
            {copied ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
            {copied ? "Copied" : "Copy"}
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            disabled={!content}
            title={`Download .${isHTML ? "html" : "md"}`}
            className={`p-1.5 rounded-lg transition-all disabled:opacity-40 ${
              dark
                ? "text-[#6b6b8a] hover:text-[#e8e8f0] hover:bg-[#1e1e2e]"
                : "text-[#5a5a8a] hover:bg-[#f0f0ff] hover:text-[#EF4444]"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            title="Close canvas"
            className={`p-1.5 rounded-lg transition-all ${
              dark
                ? "text-[#6b6b8a] hover:text-[#e8e8f0] hover:bg-[#1e1e2e]"
                : "text-[#9090b0] hover:bg-[#f0f0ff] hover:text-[#5a5a8a]"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {!content ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${dark ? "bg-[#111118]" : "bg-[#f0f0ff]"}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </div>
            <div>
              <p className={`text-sm font-medium ${dark ? "text-[#e8e8f0]" : "text-[#2a2a4e]"}`}>
                Canvas is empty
              </p>
              <p className={`text-xs mt-1 max-w-[220px] ${dark ? "text-[#6b6b8a]" : "text-[#9090b0]"}`}>
                Ask Quill to build a landing page, UI component, or write a document to see it rendered here.
              </p>
            </div>
          </div>
        ) : isHTML ? (
          tab === "preview" ? (
            /* Live iframe */
            <iframe
              key={htmlSrc}
              srcDoc={htmlSrc}
              sandbox="allow-scripts allow-forms allow-popups"
              className="w-full h-full border-0"
              title="Page preview"
            />
          ) : (
            /* Code view */
            <div className="h-full overflow-auto bg-[#0d0d15]">
              <pre className="p-6 text-[12px] font-mono text-[#c8c8e0] leading-relaxed whitespace-pre-wrap break-all">
                {htmlSrc}
              </pre>
            </div>
          )
        ) : (
          /* Markdown document */
          <div className="h-full overflow-y-auto">
            <div className="px-10 py-8">
              <MarkdownDocument text={content} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
