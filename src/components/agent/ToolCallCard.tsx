"use client";

import { useState } from "react";
import {
  ArrowPathIcon,
  CheckIcon,
  ChevronDownIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";

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
            <ArrowPathIcon className="h-3.5 w-3.5 animate-spin-slow text-[#EF4444]" aria-hidden="true" />
          ) : call.status === "done" ? (
            <CheckIcon className="h-3.5 w-3.5 text-[#34d399]" aria-hidden="true" />
          ) : call.status === "error" ? (
            <ExclamationCircleIcon className="h-3.5 w-3.5 text-[#f87171]" aria-hidden="true" />
          ) : (
            <span className="h-3.5 w-3.5 rounded-full border border-[#6b6b8a]" aria-hidden="true" />
          )}
        </span>

        {/* Expand toggle */}
        {call.result && (
          <ChevronDownIcon className={`h-3 w-3 shrink-0 text-[#6b6b8a] transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
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
