"use client";

import { useState, useCallback, useEffect, type ComponentType, type SVGProps } from "react";
import { authClient } from "@/lib/auth/client";
import {
  ArchiveBoxIcon,
  BookOpenIcon,
  ClockIcon,
  CpuChipIcon,
  EllipsisHorizontalIcon,
  InboxStackIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  RectangleGroupIcon,
  ShareIcon,
  StarIcon as StarIconOutline,
  TrashIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/20/solid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuillLogo } from "@/components/ui/QuillLogo";
import { SettingsModal } from "@/components/ui/SettingsModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type SessionData = {
  user: { id: string; name: string; email: string; image?: string | null } | null;
} | null;

type Chat = { id: string; title: string };
type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

interface CommandLink {
  id: string;
  label: string;
  href: string;
  icon: IconComponent;
}

interface HealthPayload {
  readinessStatus?: "ok" | "degraded" | "down";
}

const PINNED_KEY = "quill-pinned-chats";
const sidebarHistoryActionClass = "h-7 w-7 rounded-md text-quill-muted hover:bg-quill-border hover:text-quill-muted";

interface SidebarProps {
  onClose?: () => void;
  mobileCompact?: boolean;
}

// MiniMax-style minimal nav: a couple of direct top-level links, everything else
// (Missions, Autopilot, Artifacts, MCP, Google Workspace, Pricing) lives in "More".
const TOP_LEVEL_LINKS: CommandLink[] = [
  { id: "workspace", label: "Workspace", href: "/agent", icon: RectangleGroupIcon },
  { id: "docs", label: "Docs", href: "/docs", icon: BookOpenIcon },
];

const MORE_LINKS: CommandLink[] = [
  { id: "missions", label: "Mission Inbox", href: "/missions", icon: InboxStackIcon },
  { id: "autopilot", label: "Autopilot", href: "/autopilot", icon: ClockIcon },
  { id: "artifacts", label: "Artifact History", href: "/artifacts", icon: ArchiveBoxIcon },
  { id: "mcp", label: "MCP Catalog", href: "/mcp", icon: WrenchScrewdriverIcon },
  { id: "skills", label: "Skills", href: "/skills", icon: CpuChipIcon },
  { id: "pricing", label: "Pricing", href: "/pricing", icon: RectangleGroupIcon },
];

function matchesQuery(query: string, ...values: Array<string | undefined>) {
  if (!query) return true;
  return values.some((value) => value?.toLowerCase().includes(query));
}

export function Sidebar({ onClose, mobileCompact = false }: SidebarProps = {}) {
  const [, setSession] = useState<SessionData>(null);
  const [sessionStatus, setSessionStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const [recentChats, setRecentChats] = useState<Chat[]>([]);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [pendingDeleteChat, setPendingDeleteChat] = useState<Chat | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchPlaceholder = "Search chats";
  const [engineStatus, setEngineStatus] = useState<"loading" | "ok" | "degraded" | "down">("loading");
  const [engineDetail, setEngineDetail] = useState("Checking runtime health");
  const [pinned, setPinned] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(PINNED_KEY);
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [hoveredChat, setHoveredChat] = useState<string | null>(null);
  const [openChatMenuId, setOpenChatMenuId] = useState<string | null>(null);

  useEffect(() => {
    authClient
      .getSession()
      .then(({ data }) => {
        if (data?.user) {
          setSession({ user: data.user });
          setSessionStatus("authenticated");
          fetch("/api/chats")
            .then((r) => (r.ok ? r.json() : []))
            .then((chats: Chat[]) => setRecentChats(chats))
            .catch(() => {});
        } else {
          setSessionStatus("unauthenticated");
        }
      })
      .catch(() => setSessionStatus("unauthenticated"));
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/health?readiness=1", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as HealthPayload | null;
        if (cancelled) return;
        const readinessStatus = body?.readinessStatus ?? (response.ok ? "ok" : "down");
        setEngineStatus(readinessStatus);
        setEngineDetail(
          readinessStatus === "ok"
            ? "Core APIs reachable"
            : readinessStatus === "degraded"
              ? "Running with fallback or partial degradation"
              : "Runtime needs attention",
        );
      })
      .catch(() => {
        if (cancelled) return;
        setEngineStatus("down");
        setEngineDetail("Unable to reach health endpoint");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const navigateTo = useCallback(
    (href: string) => {
      onClose?.();
      window.location.assign(href);
    },
    [onClose],
  );

  const openChat = useCallback(
    (chatId: string) => {
      const url = new URL("/agent", window.location.origin);
      url.searchParams.set("chat", chatId);
      onClose?.();
      window.location.assign(url.toString());
    },
    [onClose],
  );

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

  const deleteChatFromHistory = useCallback(
    async (chatId: string) => {
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
    },
    [deletingChatId],
  );

  const confirmDeleteChat = useCallback(async () => {
    if (!pendingDeleteChat) return;
    await deleteChatFromHistory(pendingDeleteChat.id);
    setPendingDeleteChat(null);
  }, [pendingDeleteChat, deleteChatFromHistory]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const sortedChats = [
    ...recentChats.filter((c) => pinned.includes(c.id)),
    ...recentChats.filter((c) => !pinned.includes(c.id)),
  ];
  const filteredChats = sortedChats.filter((chat) => matchesQuery(normalizedQuery, chat.title));

  const engineTone =
    engineStatus === "ok"
      ? "text-quill-green bg-quill-glow-green-10 border-quill-glow-green-20"
      : engineStatus === "degraded"
        ? "text-quill-yellow bg-quill-glow-yellow-10 border-quill-glow-yellow-20"
        : engineStatus === "down"
          ? "text-quill-accent-2 bg-quill-glow-10 border-quill-glow-20"
          : "text-quill-muted bg-quill-surface-2 border-quill-border";
  const engineLabel =
    engineStatus === "ok"
      ? "Online"
      : engineStatus === "degraded"
        ? "Degraded"
        : engineStatus === "down"
          ? "Offline"
          : "Checking";

  return (
    <TooltipProvider delayDuration={500}>
      <aside
        className="flex h-full w-full shrink-0 flex-col overflow-y-auto border-r border-quill-border bg-quill-surface-2 scroll-smooth overscroll-contain"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="shrink-0 border-b border-quill-border px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <QuillLogo size={22} />
              <span className="text-sm font-semibold gradient-text tracking-tight">Quill AI</span>
            </div>
            {onClose && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onClose}
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Close sidebar"
                    className="size-8 rounded-lg text-quill-muted hover:bg-quill-surface-2 hover:text-quill-text md:hidden"
                  >
                    <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Close sidebar</TooltipContent>
              </Tooltip>
            )}
          </div>

          <div className="mt-3 space-y-2.5">
            <Button
              onClick={() => navigateTo("/agent")}
              type="button"
              className="flex h-auto w-full items-center justify-center gap-2 rounded-xl bg-quill-accent px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-quill-glow-22 transition-all duration-150 hover:bg-quill-accent-2"
            >
              <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
              New chat
            </Button>

            <div className="flex items-center gap-2 rounded-xl border border-quill-border bg-quill-surface px-3 py-2">
              <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-quill-muted" aria-hidden="true" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-auto w-full border-0 bg-transparent px-0 py-0 text-sm text-quill-text shadow-none focus-visible:ring-0 placeholder:text-quill-muted"
                aria-label="Search chats"
              />
            </div>
          </div>

          {!mobileCompact && (
            <div className="mt-3 flex items-center gap-1">
              {TOP_LEVEL_LINKS.map((item) => {
                const Icon = item.icon;
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => navigateTo(item.href)}
                        aria-label={item.label}
                        className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium text-quill-muted hover:bg-quill-surface hover:text-quill-text"
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="truncate">{item.label}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{item.label}</TooltipContent>
                  </Tooltip>
                );
              })}

              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label="More"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-quill-muted hover:bg-quill-surface hover:text-quill-text"
                      >
                        <EllipsisHorizontalIcon className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">More</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="start" className="w-52 bg-quill-surface-2 border-quill-border">
                  {MORE_LINKS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem
                        key={item.id}
                        onClick={() => navigateTo(item.href)}
                        className="gap-2.5 py-2 px-2.5 text-xs cursor-pointer"
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0 text-quill-muted" aria-hidden="true" />
                        {item.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        <div className="flex-1 px-3 py-3">
          <div className="flex flex-col gap-0.5 pb-3">
            {filteredChats.length === 0 &&
              (sessionStatus === "unauthenticated" ? (
                <div className="px-2 py-2">
                  <p className="text-xs leading-relaxed text-quill-muted">
                    Sign in to save and search conversation history.
                  </p>
                </div>
              ) : normalizedQuery ? (
                <p className="px-3 py-2 text-xs italic text-quill-muted">No chats match your search</p>
              ) : (
                <p className="px-3 py-2 text-xs italic text-quill-muted">No conversations yet</p>
              ))}

            {filteredChats.map((chat) => {
              const isPinned = pinned.includes(chat.id);
              const isHovered = hoveredChat === chat.id;
              return (
                <div
                  key={chat.id}
                  className="group relative flex items-start rounded-lg transition-all duration-150 hover:bg-quill-surface-2"
                  onMouseEnter={() => setHoveredChat(chat.id)}
                  onMouseLeave={() => setHoveredChat(null)}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => openChat(chat.id)}
                    className="flex h-auto min-w-0 flex-1 items-start justify-start gap-2 px-3 py-2 pr-11 text-left md:pr-3"
                  >
                    <span
                      className="mt-1.5 h-1 w-1 shrink-0 rounded-full transition-colors"
                      style={{ background: isPinned ? "#EF4444" : "#343944" }}
                    />
                    <span className="line-clamp-2 pr-5 text-[13px] leading-snug text-quill-muted transition-colors group-hover:text-quill-muted">
                      {chat.title}
                    </span>
                  </Button>

                  <div
                    className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 transition-opacity duration-150 md:flex"
                    style={{ opacity: isHovered ? 1 : 0 }}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={(event) => {
                            event.stopPropagation();
                            togglePin(chat.id);
                          }}
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={isPinned ? "Unpin chat" : "Pin chat to top"}
                          className={sidebarHistoryActionClass}
                          style={{ color: isPinned ? "#EF4444" : "#838387" }}
                        >
                          {isPinned ? (
                            <StarIconSolid className="h-2.75 w-2.75" aria-hidden="true" />
                          ) : (
                            <StarIconOutline className="h-2.75 w-2.75" aria-hidden="true" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">{isPinned ? "Unpin" : "Pin to top"}</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={(event) => {
                            event.stopPropagation();
                            const url = `${window.location.origin}/share/${chat.id}`;
                            navigator.clipboard
                              .writeText(url)
                              .then(() => {
                                setShareToast(chat.id);
                                setTimeout(() => setShareToast(null), 1500);
                              })
                              .catch(() => {
                                setShareToast(`error-${chat.id}`);
                                setTimeout(() => setShareToast(null), 1500);
                              });
                          }}
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={shareToast === chat.id ? "Share link copied" : "Copy share link"}
                          className={`${sidebarHistoryActionClass} ${shareToast === chat.id ? "bg-quill-glow-green-10 text-quill-green" : "text-quill-muted hover:bg-quill-border hover:text-quill-muted"}`}
                        >
                          <ShareIcon className="h-2.75 w-2.75" aria-hidden="true" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        {shareToast === chat.id ? "Copied!" : "Copy share link"}
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={(event) => {
                            event.stopPropagation();
                            requestDeleteChat(chat);
                          }}
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={deletingChatId === chat.id}
                          aria-label="Delete chat"
                          className="h-7 w-7 rounded-md text-quill-muted transition-all hover:bg-quill-border hover:text-quill-accent-2 disabled:opacity-50"
                        >
                          <TrashIcon className="h-2.75 w-2.75" aria-hidden="true" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">Delete chat</TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="absolute right-2 top-2 md:hidden">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenChatMenuId((prev) => (prev === chat.id ? null : chat.id));
                          }}
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="More chat actions"
                          className="h-8 w-8 rounded-md text-quill-muted hover:bg-quill-border hover:text-quill-muted"
                        >
                          <EllipsisHorizontalIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">More actions</TooltipContent>
                    </Tooltip>

                    {openChatMenuId === chat.id && (
                      <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-quill-border bg-quill-surface-2 p-1.5 shadow-xl">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            togglePin(chat.id);
                            setOpenChatMenuId(null);
                          }}
                          className="h-auto w-full justify-start rounded-md px-2 py-1.5 text-left text-xs text-quill-muted hover:bg-quill-border"
                        >
                          {isPinned ? "Unpin" : "Pin to top"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            const url = `${window.location.origin}/share/${chat.id}`;
                            navigator.clipboard
                              .writeText(url)
                              .then(() => {
                                setShareToast(chat.id);
                                setTimeout(() => setShareToast(null), 1500);
                              })
                              .catch(() => {
                                setShareToast(`error-${chat.id}`);
                                setTimeout(() => setShareToast(null), 1500);
                              });
                            setOpenChatMenuId(null);
                          }}
                          className="h-auto w-full justify-start rounded-md px-2 py-1.5 text-left text-xs text-quill-muted hover:bg-quill-border"
                        >
                          Copy share link
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            requestDeleteChat(chat);
                            setOpenChatMenuId(null);
                          }}
                          disabled={deletingChatId === chat.id}
                          className="h-auto w-full justify-start rounded-md px-2 py-1.5 text-left text-xs text-quill-accent-2 hover:bg-quill-border disabled:opacity-50"
                        >
                          Delete chat
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 space-y-2 border-t border-quill-border px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSettingsOpen(true)}
              className="flex h-auto items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-quill-muted hover:bg-quill-surface hover:text-quill-text"
            >
              Settings
            </Button>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-medium ${engineTone}`}
              title={engineDetail}
            >
              <CpuChipIcon className="h-3 w-3" aria-hidden="true" />
              {engineLabel}
            </span>
          </div>
        </div>

        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

        {pendingDeleteChat && (
          <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-quill-border bg-quill-surface-2 p-4 shadow-2xl">
              <h3 className="text-sm font-semibold text-quill-text">Delete this chat?</h3>
              <p className="mt-2 text-xs leading-relaxed text-quill-muted">
                This action cannot be undone. The conversation will be removed from your history.
              </p>
              <p className="mt-2 line-clamp-2 text-xs text-quill-muted">{pendingDeleteChat.title}</p>

              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPendingDeleteChat(null)}
                  className="h-auto rounded-lg px-3 py-1.5 text-xs text-quill-muted hover:border-quill-border-2 hover:text-quill-text"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    void confirmDeleteChat();
                  }}
                  disabled={deletingChatId === pendingDeleteChat.id}
                  className="h-auto rounded-lg bg-quill-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-quill-accent-2 disabled:opacity-60"
                >
                  {deletingChatId === pendingDeleteChat.id ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
