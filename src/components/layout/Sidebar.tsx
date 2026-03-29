"use client";

import { useState, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { QuillLogo } from "@/components/ui/QuillLogo";
import { KILLERS } from "@/lib/killers";
import { SettingsModal } from "@/components/ui/SettingsModal";

// Chat history is loaded from the DB via the API in production.
// For now this is empty — real data will populate once auth + DB are wired to the sidebar.
const recentChats: { id: string; title: string }[] = [];

const PINNED_KEY = "quill-pinned-chats";

function KillerIcon({ accent, icon }: { accent: string; icon: string }) {
  return (
    <div
      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[15px] leading-none"
      style={{ background: `${accent}18`, border: `1px solid ${accent}35` }}
    >
      {icon}
    </div>
  );
}

export function Sidebar() {
  const { data: session, status } = useSession();
  const [killersOpen, setKillersOpen] = useState(true);
  const [killersExpanded, setKillersExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
          className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white text-sm font-medium transition-all duration-150 shadow-lg shadow-[rgba(239,68,68,0.25)]"
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
          onClick={(e) => { e.stopPropagation(); setKillersOpen((v) => !v); }}
          className="flex items-center justify-between w-full px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#6b6b8a] hover:text-[#a8a8c0] uppercase tracking-wider transition-all"
        >
          <span className="flex items-center gap-1.5">
            {/* Diamond icon */}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#F87171" }}>
              <path d="M12 2L22 12L12 22L2 12Z" />
            </svg>
            Killers
          </span>
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
          style={{ maxHeight: killersOpen ? "600px" : "0px", opacity: killersOpen ? 1 : 0 }}
        >
          <div className="flex flex-col gap-0.5 pt-1 pb-2">
            {(killersExpanded ? KILLERS : KILLERS.slice(0, 3)).map((killer) => (
              <button
                key={killer.id}
                onClick={() => window.location.assign(`/agent?killer=${killer.id}`)}
                className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl hover:bg-[#16161f] transition-all duration-150 text-left group"
              >
                <KillerIcon accent={killer.accent} icon={killer.icon} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#c8c8e0] group-hover:text-[#e8e8f0] truncate transition-colors">
                    {killer.name}
                  </p>
                  <p className="text-[11px] text-[#6b6b8a] truncate">{killer.tagline}</p>
                </div>
              </button>
            ))}
            {KILLERS.length > 3 && (
              <button
                onClick={(e) => { e.stopPropagation(); setKillersExpanded((v) => !v); }}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-xl text-[11px] text-[#6b6b8a] hover:text-[#a8a8c0] hover:bg-[#16161f] transition-all duration-150 text-left"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: killersExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                {killersExpanded ? "Show less" : `See all ${KILLERS.length}`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 my-1 border-t border-[#1e1e2e]" />

      {/* ── History section ────────────────────────────────────────────── */}
      <div className="px-3 flex-1 min-h-0 overflow-y-auto">
        <button
          onClick={(e) => { e.stopPropagation(); setHistoryOpen((v) => !v); }}
          className="flex items-center justify-between w-full px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#6b6b8a] hover:text-[#a8a8c0] uppercase tracking-wider transition-all"
        >
          <span className="flex items-center gap-1.5">
            {/* History clock icon */}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            History
          </span>
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
            {sortedChats.length === 0 && (
              <p className="px-3 py-2 text-xs text-[#6b6b8a] italic">
                No conversations yet
              </p>
            )}
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
                      style={{ background: isPinned ? "#EF4444" : "#2a2a3e" }}
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
                      style={{ color: isPinned ? "#EF4444" : "#6b6b8a" }}
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

      {/* User profile + usage + settings */}
      <div className="px-3 py-3 border-t border-[#1e1e2e] shrink-0 space-y-2">
        {status === "authenticated" && session?.user ? (
          <>
            {/* Profile row */}
            <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#F87171] to-[#F87171] flex items-center justify-center text-xs font-bold text-white shrink-0 uppercase">
                {(session.user.name ?? session.user.email ?? "U")[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#e8e8f0] truncate leading-tight">
                  {session.user.name ?? session.user.email?.split("@")[0] ?? "User"}
                </p>
                <p className="text-[11px] text-[#6b6b8a] truncate leading-tight">Free plan</p>
              </div>
              {/* Settings button */}
              <button
                onClick={() => setSettingsOpen(true)}
                title="Settings"
                className="p-1.5 rounded-lg text-[#6b6b8a] hover:text-[#e8e8f0] hover:bg-[#16161f] transition-all shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
                </svg>
              </button>
              {/* Sign out */}
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                title="Sign out"
                className="p-1.5 rounded-lg text-[#6b6b8a] hover:text-[#f87171] hover:bg-[#16161f] transition-all shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>

            {/* Usage bar */}
            <div className="px-2 pb-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-[#6b6b8a]">2,340 / 10,000 messages</span>
                <span className="text-[11px] font-medium text-[#F87171]">23%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#1e1e2e] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: "23%", background: "linear-gradient(to right, #EF4444, #F87171)" }}
                />
              </div>
              <button className="mt-1.5 text-[11px] text-[#EF4444] hover:text-[#F87171] transition-colors">
                Upgrade for unlimited
              </button>
            </div>
          </>
        ) : (
          /* Not signed in */
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-[#1e1e2e] hover:border-[rgba(239,68,68,0.4)] hover:bg-[#111118] text-sm font-medium text-[#6b6b8a] hover:text-[#e8e8f0] transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Sign in
          </Link>
        )}
      </div>

      {/* Settings modal */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </aside>
  );
}
