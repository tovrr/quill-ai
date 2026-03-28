"use client";

import { useState } from "react";
import Link from "next/link";
import { QuillLogo } from "@/components/ui/QuillLogo";

const recentChats = [
  { id: "1", title: "Research competitors for SaaS product" },
  { id: "2", title: "Write blog post about AI trends 2026" },
  { id: "3", title: "Build a full landing page mockup" },
  { id: "4", title: "Analyze sales data from Q1 CSV" },
  { id: "5", title: "Draft cold email campaign" },
];

export function Sidebar() {
  const [historyOpen, setHistoryOpen] = useState(true);

  return (
    <aside className="flex flex-col w-64 h-full bg-[#0d0d15] border-r border-[#1e1e2e] shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[#1e1e2e]">
        <QuillLogo size={26} />
        <span className="text-base font-semibold gradient-text tracking-tight">
          Quill AI
        </span>
      </div>

      {/* New task button */}
      <div className="px-3 pt-4">
        <Link
          href="/agent"
          onClick={() => window.location.assign("/agent")}
          className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl bg-[#7c6af7] hover:bg-[#6b58e8] text-white text-sm font-medium transition-all duration-150 shadow-lg shadow-[rgba(124,106,247,0.25)]"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New chat
        </Link>
      </div>

      {/* History expandable */}
      <div className="flex-1 overflow-y-auto px-3 pt-3 min-h-0">
        <button
          onClick={() => setHistoryOpen((v) => !v)}
          className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm text-[#6b6b8a] hover:text-[#e8e8f0] hover:bg-[#16161f] transition-all duration-150 group"
        >
          <div className="flex items-center gap-2.5">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="12 8 12 12 14 14" />
              <path d="M3.05 11a9 9 0 1 1 .5 4" />
              <polyline points="3 16 3 11 8 11" />
            </svg>
            <span className="font-medium">History</span>
          </div>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-150"
            style={{ transform: historyOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Chat list */}
        <div
          className="overflow-hidden transition-all duration-200"
          style={{ maxHeight: historyOpen ? "600px" : "0px", opacity: historyOpen ? 1 : 0 }}
        >
          <div className="flex flex-col gap-0.5 pt-1 pb-2">
            {recentChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => window.location.assign(`/agent?chat=${chat.id}`)}
                className="group flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-[#16161f] transition-all duration-150 text-left w-full"
              >
                <span className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-[#2a2a3e] group-hover:bg-[#7c6af7] transition-colors" />
                <span className="text-[13px] text-[#6b6b8a] group-hover:text-[#b8b8d0] leading-snug line-clamp-2 transition-colors">
                  {chat.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* User profile */}
      <div className="px-3 py-3 border-t border-[#1e1e2e]">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#16161f] transition-all cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#a78bfa] to-[#60a5fa] flex items-center justify-center text-xs font-bold text-white shrink-0">
            U
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#e8e8f0] truncate">User</p>
            <p className="text-xs text-[#6b6b8a] truncate">Free plan</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
