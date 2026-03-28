"use client";

import { useState, useEffect, useCallback } from "react";
import { QuillLogo } from "@/components/ui/QuillLogo";
import { KILLERS } from "@/lib/killers";

const recentChats = [
  { id: "1", title: "Research competitors for SaaS product" },
  { id: "2", title: "Write blog post about AI trends 2026" },
  { id: "3", title: "Build a full landing page mockup" },
  { id: "4", title: "Analyze sales data from Q1 CSV" },
  { id: "5", title: "Draft cold email campaign" },
];

const PINNED_KEY = "quill-pinned-chats";

function KillerIcon({ accent }: { accent: string }) {
  return (
    <div
      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
      style={{ background: `${accent}20`, border: `1px solid ${accent}40` }}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ background: accent }}
      />
    </div>
  );
}

export function Sidebar() {
  const [killersOpen, setKillersOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [pinned, setPinned] = useState<string[]>(() => {
    // Read from localStorage on initial render (client only)
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(PINNED_KEY);
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [hoveredChat, setHoveredChat] = useState<string | null>(null);

  const togglePin = useCallback((id: string) => {
    setPinned((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      try {
        localStorage.setItem(PINNED_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const sortedChats = [
    ...recentChats.filter((c) => pinned.includes(c.id)),
    ...recentChats.filter((c) => !pinned.includes(c.id)),
  ];

  return (
    <aside className="flex flex-col w-64 h-full bg-[#0d0d15] border-r border-[#1e1e2e] shrink-0 overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#1e1e2e] shrink-0">
        <QuillLogo size={24} />
        <span className="text-sm font-semibold gradient-text tracking-tight">
          Quill AI
        </span>
      </div>

      {/* New chat button */}
      <div className="px-3 pt-3 shrink-0">
        <button
          onClick={() => window.location.assign("/agent")}
          className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl bg-[#7c6af7] hover:bg-[#6b58e8] text-white text-sm font-medium transition-all duration-150 shadow-lg shadow-[rgba(124,106,247,0.25)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New chat
        </button>
      </div>

      {/* ── Killers section ────────────────────────────────────────────── */}
      <div className="px-3 pt-4 shrink-0">
        <button
          onClick={() => setKillersOpen((v) => !v)}
          className="flex items-center justify-between w-full px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#6b6b8a] hover:text-[#a8a8c0] uppercase tracking-wider transition-all"
        >
          <span>Killers</span>
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: killersOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <div
          className="overflow-hidden transition-all duration-200"
          style={{ maxHeight: killersOpen ? "400px" : "0px", opacity: killersOpen ? 1 : 0 }}
        >
          <div className="flex flex-col gap-0.5 pt-1 pb-2">
            {KILLERS.map((killer) => (
              <button
                key={killer.id}
                onClick={() => window.location.assign(`/agent?killer=${killer.id}`)}
                className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl hover:bg-[#16161f] transition-all duration-150 text-left group"
              >
                <KillerIcon accent={killer.accent} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#c8c8e0] group-hover:text-[#e8e8f0] truncate transition-colors">
                    {killer.name}
                  </p>
                  <p className="text-[11px] text-[#6b6b8a] truncate">{killer.tagline}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 my-1 border-t border-[#1e1e2e]" />

      {/* ── History section ────────────────────────────────────────────── */}
      <div className="px-3 flex-1 min-h-0 overflow-y-auto">
        <button
          onClick={() => setHistoryOpen((v) => !v)}
          className="flex items-center justify-between w-full px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#6b6b8a] hover:text-[#a8a8c0] uppercase tracking-wider transition-all"
        >
          <span>History</span>
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: historyOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <div
          className="overflow-hidden transition-all duration-200"
          style={{ maxHeight: historyOpen ? "600px" : "0px", opacity: historyOpen ? 1 : 0 }}
        >
          <div className="flex flex-col gap-0.5 pt-1 pb-3">
            {sortedChats.map((chat) => {
              const isPinned = pinned.includes(chat.id);
              const isHovered = hoveredChat === chat.id;
              return (
                <div
                  key={chat.id}
                  className="group relative flex items-start rounded-lg hover:bg-[#16161f] transition-all duration-150"
                  onMouseEnter={() => setHoveredChat(chat.id)}
                  onMouseLeave={() => setHoveredChat(null)}
                >
                  <button
                    onClick={() => window.location.assign(`/agent?chat=${chat.id}`)}
                    className="flex items-start gap-2 flex-1 min-w-0 px-3 py-2 text-left"
                  >
                    {/* Pin indicator dot */}
                    <span
                      className="mt-1.5 shrink-0 w-1 h-1 rounded-full transition-colors"
                      style={{ background: isPinned ? "#7c6af7" : "#2a2a3e" }}
                    />
                    <span className="text-[13px] text-[#6b6b8a] group-hover:text-[#b8b8d0] leading-snug line-clamp-2 transition-colors pr-5">
                      {chat.title}
                    </span>
                  </button>

                  {/* Pin / share action buttons — show on hover */}
                  <div
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 transition-opacity duration-150"
                    style={{ opacity: isHovered ? 1 : 0 }}
                  >
                    {/* Pin button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePin(chat.id);
                      }}
                      title={isPinned ? "Unpin" : "Pin to top"}
                      className="p-1 rounded-md hover:bg-[#1e1e2e] transition-all"
                      style={{ color: isPinned ? "#7c6af7" : "#6b6b8a" }}
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill={isPinned ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                      </svg>
                    </button>

                    {/* Share button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = `${window.location.origin}/share/${chat.id}`;
                        navigator.clipboard.writeText(url).then(() => {
                          // Brief visual feedback
                        });
                      }}
                      title="Copy share link"
                      className="p-1 rounded-md text-[#6b6b8a] hover:text-[#a8a8c0] hover:bg-[#1e1e2e] transition-all"
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* User profile */}
      <div className="px-3 py-3 border-t border-[#1e1e2e] shrink-0">
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
