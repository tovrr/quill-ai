"use client";

import { useState } from "react";

export type ToolStatus = "pending" | "running" | "done" | "error";

export interface ToolCall {
  id: string;
  tool: string;
  description: string;
  status: ToolStatus;
  result?: string;
  icon: React.ReactNode;
}

const statusConfig: Record<ToolStatus, { color: string; bg: string; label: string }> = {
  pending: { color: "#6b6b8a", bg: "#1e1e2e", label: "Pending" },
  running: { color: "#EF4444", bg: "rgba(239,68,68,0.1)", label: "Running" },
  done: { color: "#34d399", bg: "rgba(52,211,153,0.1)", label: "Done" },
  error: { color: "#f87171", bg: "rgba(248,113,113,0.1)", label: "Error" },
};

export function ToolCallCard({ call }: { call: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const { color, bg, label } = statusConfig[call.status];

  return (
    <div
      className="rounded-xl border border-[#1e1e2e] overflow-hidden transition-all duration-200 animate-fade-in"
      style={{ background: bg }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        {/* Tool icon */}
        <span className="text-[#6b6b8a]">{call.icon}</span>

        {/* Tool name + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[#e8e8f0]">{call.tool}</span>
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ color, background: `${color}20` }}
            >
              {label}
            </span>
          </div>
          <p className="text-xs text-[#6b6b8a] truncate mt-0.5">{call.description}</p>
        </div>

        {/* Spinner or check */}
        <span className="shrink-0">
          {call.status === "running" ? (
            <svg
              className="animate-spin-slow"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#EF4444"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M21 12a9 9 0 1 1-6.22-8.56" />
            </svg>
          ) : call.status === "done" ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : call.status === "error" ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b6b8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
            </svg>
          )}
        </span>

        {/* Expand toggle */}
        {call.result && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6b6b8a"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {expanded && call.result && (
        <div className="px-4 pb-3 border-t border-[#1e1e2e]">
          <pre className="text-xs text-[#a8a8c0] mt-3 whitespace-pre-wrap leading-relaxed font-mono bg-[#0a0a0f] rounded-lg p-3 overflow-x-auto">
            {call.result}
          </pre>
        </div>
      )}
    </div>
  );
}
