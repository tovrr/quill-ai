"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import Link from "next/link";
import { QuillLogo } from "@/components/ui/QuillLogo";
import { KillerSvgIcon } from "@/components/ui/KillerIcon";
import { KILLERS } from "@/lib/killers";
import { SettingsModal } from "@/components/ui/SettingsModal";

type SessionData = {
  user: { id: string; name: string; email: string; image?: string | null } | null;
} | null;

type Chat = { id: string; title: string };

const PINNED_KEY = "quill-pinned-chats";

function KillerIcon({ accent, iconKey }: { accent: string; iconKey: import("@/lib/killers").KillerIconKey }) {
  return (
    <div
      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
      style={{ background: `${accent}18`, border: `1px solid ${accent}35`, color: accent }}
    >
      <KillerSvgIcon iconKey={iconKey} size={16} />
    </div>
  );
}

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps = {}) {
  const router = useRouter();
  const [session, setSession] = useState<SessionData>(null);
  const [sessionStatus, setSessionStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const [planLabel, setPlanLabel] = useState("Free");
  const [messagesUsedToday, setMessagesUsedToday] = useState<number>(0);
  const [recommendedDailyLimit, setRecommendedDailyLimit] = useState<number>(60);
  const [usagePercent, setUsagePercent] = useState<number>(0);
  const [recentChats, setRecentChats] = useState<Chat[]>([]);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [pendingDeleteChat, setPendingDeleteChat] = useState<Chat | null>(null);

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (data?.user) {
        setSession({ user: data.user });
        setSessionStatus("authenticated");
        fetch("/api/me/entitlements", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((entitlements: { planLabel?: string } | null) => {
            if (entitlements?.planLabel) setPlanLabel(entitlements.planLabel);
          })
          .catch(() => {});
        fetch("/api/me/usage", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((usage: { messagesUsedToday?: number; recommendedDailyLimit?: number; usagePercent?: number } | null) => {
            if (!usage) return;
            setMessagesUsedToday(usage.messagesUsedToday ?? 0);
            setRecommendedDailyLimit(usage.recommendedDailyLimit ?? 60);
            setUsagePercent(usage.usagePercent ?? 0);
          })
          .catch(() => {});
        // Load chat history now that we know the user is authenticated
        fetch("/api/chats")
          .then((r) => r.ok ? r.json() : [])
          .then((chats: Chat[]) => setRecentChats(chats))
          .catch(() => {});
      } else {
        setSessionStatus("unauthenticated");
      }
    }).catch(() => setSessionStatus("unauthenticated"));
  }, []);
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

  const requestDeleteChat = useCallback((chat: Chat) => {
    setPendingDeleteChat(chat);
  }, []);

  const deleteChatFromHistory = useCallback(async (chatId: string) => {
    if (deletingChatId === chatId) return;

    setDeletingChatId(chatId);
    try {
      const res = await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
      if (!res.ok) return;

      setRecentChats((prev) => prev.filter((chat) => chat.id !== chatId));
      setPinned((prev) => {
        const next = prev.filter((id) => id !== chatId);
        try {
          localStorage.setItem(PINNED_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    } finally {
      setDeletingChatId(null);
    }
  }, [deletingChatId]);

  const confirmDeleteChat = useCallback(async () => {
    if (!pendingDeleteChat) return;
    await deleteChatFromHistory(pendingDeleteChat.id);
    setPendingDeleteChat(null);
  }, [pendingDeleteChat, deleteChatFromHistory]);

  const sortedChats = [
    ...recentChats.filter((c) => pinned.includes(c.id)),
    ...recentChats.filter((c) => !pinned.includes(c.id)),
  ];

  return (
    <aside className="flex flex-col w-64 h-full bg-[#0d0d15] border-r border-quill-border shrink-0 overflow-y-auto">
      {/* Logo + close button (mobile) */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-quill-border shrink-0">
        <div className="flex items-center gap-3">
          <QuillLogo size={24} />
          <span className="text-sm font-semibold gradient-text tracking-tight">
            Quill AI
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 text-quill-muted hover:text-quill-text hover:bg-quill-surface-2 rounded-lg transition-all"
            title="Close sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
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
          className="flex items-center justify-between w-full px-3 py-1.5 rounded-lg text-[11px] font-semibold text-quill-muted hover:text-[#a8a8c0] uppercase tracking-wider transition-all"
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
                className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl hover:bg-quill-surface-2 transition-all duration-150 text-left group"
              >
                <KillerIcon accent={killer.accent} iconKey={killer.iconKey} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#c8c8e0] group-hover:text-quill-text truncate transition-colors">
                    {killer.name}
                  </p>
                  <p className="text-[11px] text-quill-muted truncate">{killer.tagline}</p>
                </div>
              </button>
            ))}
            {KILLERS.length > 3 && (
              <button
                onClick={(e) => { e.stopPropagation(); setKillersExpanded((v) => !v); }}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-xl text-[11px] text-quill-muted hover:text-[#a8a8c0] hover:bg-quill-surface-2 transition-all duration-150 text-left"
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
      <div className="mx-4 my-1 border-t border-quill-border" />

      {/* ── History section ────────────────────────────────────────────── */}
      <div className="px-3 flex-1 min-h-0 overflow-y-auto">
        <button
          onClick={(e) => { e.stopPropagation(); setHistoryOpen((v) => !v); }}
          className="flex items-center justify-between w-full px-3 py-1.5 rounded-lg text-[11px] font-semibold text-quill-muted hover:text-[#a8a8c0] uppercase tracking-wider transition-all"
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
              sessionStatus === "unauthenticated" ? (
                <div className="px-2 py-2 flex flex-col gap-2">
                  <p className="text-xs text-quill-muted leading-relaxed">Sign in to save and access your conversation history.</p>
                  <Link
                    href="/login"
                    className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.22)] text-xs font-medium text-[#F87171] hover:bg-[rgba(239,68,68,0.14)] transition-all"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <polyline points="10 17 15 12 10 7" />
                      <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                    Sign in
                  </Link>
                </div>
              ) : (
                <p className="px-3 py-2 text-xs text-quill-muted italic">
                  No conversations yet
                </p>
              )
            )}
            {sortedChats.map((chat) => {
              const isPinned = pinned.includes(chat.id);
              const isHovered = hoveredChat === chat.id;
              return (
                <div
                  key={chat.id}
                  className="group relative flex items-start rounded-lg hover:bg-quill-surface-2 transition-all duration-150"
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
                    <span className="text-[13px] text-quill-muted group-hover:text-[#b8b8d0] leading-snug line-clamp-2 transition-colors pr-5">
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
                      className="p-1 rounded-md hover:bg-quill-border transition-all"
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
                          setShareToast(chat.id);
                          setTimeout(() => setShareToast(null), 1500);
                        }).catch(() => {
                          setShareToast(`error-${chat.id}`);
                          setTimeout(() => setShareToast(null), 1500);
                        });
                      }}
                      title={shareToast === chat.id ? "Copied!" : "Copy share link"}
                      className={`p-1 rounded-md transition-all ${shareToast === chat.id ? "text-[#4ade80] bg-[#22c55e]/10" : "text-quill-muted hover:text-[#a8a8c0] hover:bg-quill-border"}`}
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

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        requestDeleteChat(chat);
                      }}
                      disabled={deletingChatId === chat.id}
                      title="Delete chat"
                      className="p-1 rounded-md text-quill-muted hover:text-[#f87171] hover:bg-quill-border transition-all disabled:opacity-50"
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
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4h6v2" />
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
      <div className="px-3 py-3 border-t border-quill-border shrink-0 space-y-2">
        {sessionStatus === "authenticated" && session?.user ? (
          <>
            {/* Profile row */}
            <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
              <div className="w-7 h-7 rounded-full bg-linear-to-br from-[#F87171] to-[#F87171] flex items-center justify-center text-xs font-bold text-white shrink-0 uppercase">
                {(session.user.name ?? session.user.email ?? "U")[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-quill-text truncate leading-tight">
                  {session.user.name ?? session.user.email?.split("@")[0] ?? "User"}
                </p>
                <p className="text-[11px] text-quill-muted truncate leading-tight">{planLabel}</p>
              </div>
              {/* Settings button */}
              <button
                onClick={() => setSettingsOpen(true)}
                title="Settings"
                className="p-1.5 rounded-lg text-quill-muted hover:text-quill-text hover:bg-quill-surface-2 transition-all shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
                </svg>
              </button>
              {/* Sign out */}
              <button
                onClick={async () => {
                  await authClient.signOut();
                  router.push("/login");
                }}
                title="Sign out"
                className="p-1.5 rounded-lg text-quill-muted hover:text-[#f87171] hover:bg-quill-surface-2 transition-all shrink-0"
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
                <span className="text-[11px] text-quill-muted">{messagesUsedToday} / {recommendedDailyLimit} messages today</span>
                <span className="text-[11px] font-medium text-[#F87171]">{usagePercent}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-quill-border overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${usagePercent}%`, background: "linear-gradient(to right, #EF4444, #F87171)" }}
                />
              </div>
              {planLabel === "Free" && (
                <button className="mt-1.5 text-[11px] text-[#EF4444] hover:text-[#F87171] transition-colors">
                  Upgrade for unlimited
                </button>
              )}
            </div>
          </>
        ) : (
          /* Not signed in */
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-quill-border hover:border-[rgba(239,68,68,0.4)] hover:bg-quill-surface text-sm font-medium text-quill-muted hover:text-quill-text transition-all"
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

      {/* Delete confirmation modal */}
      {pendingDeleteChat && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-sm rounded-2xl border border-quill-border bg-[#0d0d15] p-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-quill-text">Delete this chat?</h3>
            <p className="mt-2 text-xs text-quill-muted leading-relaxed">
              This action cannot be undone. The conversation will be removed from your history.
            </p>
            <p className="mt-2 text-xs text-[#a8a8c0] line-clamp-2">
              {pendingDeleteChat.title}
            </p>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setPendingDeleteChat(null)}
                className="px-3 py-1.5 rounded-lg border border-quill-border text-xs text-[#a8a8c0] hover:text-quill-text hover:border-quill-border-2 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => { void confirmDeleteChat(); }}
                disabled={deletingChatId === pendingDeleteChat.id}
                className="px-3 py-1.5 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-medium transition-all disabled:opacity-60"
              >
                {deletingChatId === pendingDeleteChat.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
