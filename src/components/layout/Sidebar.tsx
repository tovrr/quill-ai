"use client";

import { useState, useCallback, useEffect, type ComponentType, type SVGProps } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import Link from "next/link";
import {
  ArrowRightStartOnRectangleIcon,
  BookOpenIcon,
  ChartBarSquareIcon,
  ChevronDownIcon,
  ClockIcon,
  CodeBracketIcon,
  Cog6ToothIcon,
  CpuChipIcon,
  DocumentTextIcon,
  EllipsisVerticalIcon,
  FolderIcon,
  GlobeAltIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  RectangleGroupIcon,
  ShareIcon,
  Squares2X2Icon,
  StarIcon as StarIconOutline,
  TrashIcon,
  UserCircleIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { SparklesIcon, StarIcon as StarIconSolid } from "@heroicons/react/20/solid";
import { QuillLogo } from "@/components/ui/QuillLogo";
import { SettingsModal } from "@/components/ui/SettingsModal";
import { KILLERS } from "@/lib/killers";

type SessionData = {
  user: { id: string; name: string; email: string; image?: string | null } | null;
} | null;

type Chat = { id: string; title: string };
type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

interface CommandLink {
  id: string;
  label: string;
  subtitle: string;
  href: string;
  icon: IconComponent;
}

interface PromptShortcut {
  id: string;
  label: string;
  subtitle: string;
  prompt: string;
  launchMode?: "q" | "draft";
}

interface MemoryShortcut {
  id: string;
  label: string;
  subtitle: string;
  icon: IconComponent;
  action: "settings" | "prompt";
  prompt?: string;
  launchMode?: "q" | "draft";
}

interface ArtifactGroup {
  id: string;
  label: string;
  subtitle: string;
  icon: IconComponent;
  items: PromptShortcut[];
}

interface HealthPayload {
  readinessStatus?: "ok" | "degraded" | "down";
}

const PINNED_KEY = "quill-pinned-chats";

interface SidebarProps {
  onClose?: () => void;
}

const COMMAND_CENTER_LINKS: CommandLink[] = [
  {
    id: "overview",
    label: "Overview",
    subtitle: "Home, docs, and product context",
    href: "/",
    icon: HomeIcon,
  },
  {
    id: "workspace",
    label: "Workspace",
    subtitle: "Open the main agent console",
    href: "/agent",
    icon: Squares2X2Icon,
  },
  {
    id: "docs",
    label: "Docs",
    subtitle: "Patterns, canvas rules, and builder guides",
    href: "/docs",
    icon: BookOpenIcon,
  },
  {
    id: "pricing",
    label: "Pricing",
    subtitle: "Plans, limits, and upgrade path",
    href: "/pricing",
    icon: RectangleGroupIcon,
  },
];

const DOCUMENT_SHORTCUTS: PromptShortcut[] = [
  {
    id: "docs",
    label: "Docs",
    subtitle: "Write clear documents and specs",
    prompt: "Create a polished project document with summary, goals, scope, timeline, and next steps.",
  },
  {
    id: "slides",
    label: "Slides",
    subtitle: "Build a presentation outline fast",
    prompt: "Create a 10-slide presentation outline with title, key points, visuals, and speaker notes.",
  },
  {
    id: "sheets",
    label: "Sheets",
    subtitle: "Plan data tables and formulas",
    prompt: "Create a spreadsheet structure for weekly KPI tracking with columns, formulas, and a summary view.",
  },
];

const WEBSITE_SHORTCUTS: PromptShortcut[] = [
  {
    id: "landing-page",
    label: "Landing Page",
    subtitle: "High-converting marketing page",
    prompt: "Create a modern landing page for my business with hero, benefits, pricing, testimonials, and contact CTA.",
  },
  {
    id: "waitlist-page",
    label: "Waitlist Page",
    subtitle: "Capture emails before launch",
    prompt: "Create a waitlist page with value proposition, launch timeline, FAQ, and email signup CTA.",
  },
  {
    id: "product-page",
    label: "Product Page",
    subtitle: "Show features and pricing",
    prompt: "Create a product page with feature highlights, pricing tiers, social proof, and a strong buy CTA.",
  },
];

const APP_SHORTCUTS: PromptShortcut[] = [
  {
    id: "internal-tool",
    label: "Internal Tool",
    subtitle: "Simple operations workflow UI",
    prompt: "Design an internal tool interface for operations with tasks table, status filters, and action panel.",
  },
  {
    id: "client-portal",
    label: "Client Portal",
    subtitle: "Secure customer workspace",
    prompt: "Design a client portal with login, project status, file area, and support request flow.",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    subtitle: "Visualize key business metrics",
    prompt: "Create a business KPI dashboard app with summary cards, trends, and action recommendations.",
  },
];

const WORKSPACE_SHORTCUTS: PromptShortcut[] = [
  {
    id: "open-workspace",
    label: "Connect my files",
    subtitle: "Point Quill at your project folder",
    prompt: "I want to connect my project folder so Quill can read and update files. Walk me through the steps and confirm what it will touch before making changes.",
    launchMode: "draft",
  },
  {
    id: "import-project",
    label: "Review my project",
    subtitle: "Get a plain-language summary",
    prompt: "Look at my project files and give me a plain-language summary: what it does, how it is structured, and what might need attention.",
    launchMode: "draft",
  },
  {
    id: "run-task",
    label: "Plan before execution",
    subtitle: "Draft a task and require approval first",
    prompt: "I need you to handle a task in my project. Before starting, show me a step-by-step plan and ask for my approval. Only proceed once I confirm.",
    launchMode: "draft",
  },
];

const MEMORY_SHORTCUTS: MemoryShortcut[] = [
  {
    id: "profile",
    label: "My profile",
    subtitle: "Tune Quill's memory and working style",
    icon: UserCircleIcon,
    action: "settings",
  },
  {
    id: "project-memory",
    label: "Project memory",
    subtitle: "Summarize what Quill knows about this repo",
    icon: FolderIcon,
    action: "prompt",
    prompt: "Review the current project and summarize what you know so far: goals, architecture, active risks, and likely next priorities.",
    launchMode: "draft",
  },
  {
    id: "mistake-journal",
    label: "Mistake journal",
    subtitle: "Turn recent errors into reusable lessons",
    icon: WrenchScrewdriverIcon,
    action: "prompt",
    prompt: "Review our recent work, identify mistakes or near-misses, and convert them into a concise operating journal with lessons and safeguards.",
    launchMode: "draft",
  },
];

const SKILL_SHORTCUTS: PromptShortcut[] = [
  {
    id: "research",
    label: "Research",
    subtitle: "Find and summarize information",
    prompt: "Help me with research for my business goals. Show a clear plan, then execute it step by step.",
  },
  {
    id: "writing",
    label: "Writing",
    subtitle: "Draft and improve content",
    prompt: "Help me write polished content for my business goals. Start by clarifying audience, goal, and deliverable.",
  },
  {
    id: "design",
    label: "Design",
    subtitle: "Plan UI and UX structure",
    prompt: "Help me design a UI flow for my business goals. Prioritize structure, hierarchy, and interaction clarity.",
  },
  {
    id: "automation",
    label: "Automation",
    subtitle: "Build repeatable workflows",
    prompt: "Help me design an automation workflow for my business goals, including triggers, steps, fallback handling, and review points.",
  },
];

const ARTIFACT_GROUPS: ArtifactGroup[] = [
  {
    id: "documents",
    label: "Documents",
    subtitle: "Reports, decks, and structured deliverables",
    icon: DocumentTextIcon,
    items: DOCUMENT_SHORTCUTS,
  },
  {
    id: "websites",
    label: "Web pages",
    subtitle: "Landing, waitlist, and product pages",
    icon: GlobeAltIcon,
    items: WEBSITE_SHORTCUTS,
  },
  {
    id: "apps",
    label: "Apps",
    subtitle: "Dashboards, portals, and internal tools",
    icon: ChartBarSquareIcon,
    items: APP_SHORTCUTS,
  },
  {
    id: "workspace",
    label: "Workspace flows",
    subtitle: "Repo-aware prompts and guarded execution",
    icon: CodeBracketIcon,
    items: WORKSPACE_SHORTCUTS,
  },
];

function matchesQuery(query: string, ...values: Array<string | undefined>) {
  if (!query) return true;
  return values.some((value) => value?.toLowerCase().includes(query));
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
  const [commandOpen, setCommandOpen] = useState(true);
  const [agentsOpen, setAgentsOpen] = useState(true);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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
        fetch("/api/chats")
          .then((r) => (r.ok ? r.json() : []))
          .then((chats: Chat[]) => setRecentChats(chats))
          .catch(() => {});
      } else {
        setSessionStatus("unauthenticated");
      }
    }).catch(() => setSessionStatus("unauthenticated"));
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
              : "Runtime needs attention"
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

  const navigateTo = useCallback((href: string) => {
    onClose?.();
    window.location.assign(href);
  }, [onClose]);

  const openAgentPrompt = useCallback((prompt: string, mode: "q" | "draft" = "q") => {
    const url = new URL("/agent", window.location.origin);
    url.searchParams.set(mode, prompt);
    onClose?.();
    window.location.assign(url.toString());
  }, [onClose]);

  const openAgentForKiller = useCallback((killerId: string) => {
    const url = new URL("/agent", window.location.origin);
    url.searchParams.set("killer", killerId);
    onClose?.();
    window.location.assign(url.toString());
  }, [onClose]);

  const openChat = useCallback((chatId: string) => {
    const url = new URL("/agent", window.location.origin);
    url.searchParams.set("chat", chatId);
    onClose?.();
    window.location.assign(url.toString());
  }, [onClose]);

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

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const sortedChats = [
    ...recentChats.filter((c) => pinned.includes(c.id)),
    ...recentChats.filter((c) => !pinned.includes(c.id)),
  ];
  const filteredCommandLinks = COMMAND_CENTER_LINKS.filter((item) => matchesQuery(normalizedQuery, item.label, item.subtitle));
  const filteredAgents = KILLERS.filter((killer) => matchesQuery(normalizedQuery, killer.name, killer.shortName, killer.tagline, killer.description));
  const filteredMemoryShortcuts = MEMORY_SHORTCUTS.filter((item) => matchesQuery(normalizedQuery, item.label, item.subtitle));
  const filteredSkillShortcuts = SKILL_SHORTCUTS.filter((item) => matchesQuery(normalizedQuery, item.label, item.subtitle));
  const filteredArtifactGroups = ARTIFACT_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => matchesQuery(normalizedQuery, group.label, group.subtitle, item.label, item.subtitle)),
  })).filter((group) => group.items.length > 0 || matchesQuery(normalizedQuery, group.label, group.subtitle));
  const filteredChats = sortedChats.filter((chat) => matchesQuery(normalizedQuery, chat.title));
  const hasMatches =
    filteredCommandLinks.length > 0 ||
    filteredAgents.length > 0 ||
    filteredMemoryShortcuts.length > 0 ||
    filteredSkillShortcuts.length > 0 ||
    filteredArtifactGroups.length > 0 ||
    filteredChats.length > 0;

  const engineTone =
    engineStatus === "ok"
      ? "text-[#34d399] bg-[rgba(52,211,153,0.1)] border-[rgba(52,211,153,0.2)]"
      : engineStatus === "degraded"
        ? "text-[#fbbf24] bg-[rgba(251,191,36,0.1)] border-[rgba(251,191,36,0.2)]"
        : engineStatus === "down"
          ? "text-[#f87171] bg-[rgba(248,113,113,0.1)] border-[rgba(248,113,113,0.2)]"
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
    <aside
      className="flex h-full w-full shrink-0 flex-col overflow-y-auto border-r border-quill-border bg-[#0d0d15] scroll-smooth overscroll-contain"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <div className="shrink-0 border-b border-quill-border px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <QuillLogo size={24} />
            <div>
              <span className="block text-sm font-semibold gradient-text tracking-tight">Quill AI</span>
              <span className="block text-[11px] text-quill-muted">Workspace OS for agents and artifacts</span>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-quill-muted transition-all hover:bg-quill-surface-2 hover:text-quill-text md:hidden"
              title="Close sidebar"
            >
              <XMarkIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <button
            onClick={() => navigateTo("/agent")}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#EF4444] px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-[rgba(239,68,68,0.25)] transition-all duration-150 hover:bg-[#DC2626]"
          >
            <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
            New mission
          </button>

          <div className="flex items-center gap-2 rounded-xl border border-quill-border bg-quill-surface px-3 py-2">
            <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-quill-muted" aria-hidden="true" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search chats, agents, shortcuts"
              className="w-full bg-transparent text-sm text-quill-text outline-none placeholder:text-quill-muted"
              aria-label="Search sidebar"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 px-3 py-3">
        {!hasMatches && normalizedQuery && (
          <div className="mb-3 rounded-xl border border-quill-border bg-quill-surface px-3 py-2.5 text-xs text-quill-muted">
            No sidebar matches for &quot;{searchQuery}&quot;.
          </div>
        )}

        <div className="space-y-1">
          <button
            onClick={() => setCommandOpen((value) => !value)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-quill-muted transition-all hover:text-[#A1A7B0]"
          >
            <span className="flex items-center gap-1.5">
              <HomeIcon className="h-2.5 w-2.5" aria-hidden="true" />
              Command Center
            </span>
            <ChevronDownIcon
              className="h-2.75 w-2.75 transition-transform"
              aria-hidden="true"
              style={{ transform: commandOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
            />
          </button>

          <div
            className="overflow-hidden transition-all duration-200"
            style={{ maxHeight: commandOpen ? "420px" : "0px", opacity: commandOpen ? 1 : 0 }}
          >
            <div className="flex flex-col gap-1 pb-2 pt-1">
              {filteredCommandLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigateTo(item.href)}
                    className="flex w-full items-start gap-2.5 rounded-xl border border-transparent px-3 py-2.5 text-left transition-all duration-150 hover:border-[rgba(239,68,68,0.24)] hover:bg-quill-surface-2"
                  >
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-quill-muted" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium leading-tight text-[#C1C7D0]">{item.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-tight text-quill-muted">{item.subtitle}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-1 pt-1">
          <button
            onClick={() => setAgentsOpen((value) => !value)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-quill-muted transition-all hover:text-[#A1A7B0]"
          >
            <span className="flex items-center gap-1.5">
              <SparklesIcon className="h-2.5 w-2.5 text-[#F87171]" aria-hidden="true" />
              Agents
            </span>
            <ChevronDownIcon
              className="h-2.75 w-2.75 transition-transform"
              aria-hidden="true"
              style={{ transform: agentsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
            />
          </button>

          <div
            className="overflow-hidden transition-all duration-200"
            style={{ maxHeight: agentsOpen ? "720px" : "0px", opacity: agentsOpen ? 1 : 0 }}
          >
            <div className="flex flex-col gap-1 pb-2 pt-1">
              {filteredAgents.map((killer) => (
                <button
                  key={killer.id}
                  onClick={() => openAgentForKiller(killer.id)}
                  className="flex w-full items-start gap-2.5 rounded-xl border border-transparent px-3 py-2.5 text-left transition-all duration-150 hover:border-[rgba(239,68,68,0.24)] hover:bg-quill-surface-2"
                >
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: killer.accent }} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium leading-tight text-[#C1C7D0]">{killer.name}</span>
                    <span className="mt-0.5 block text-[11px] leading-tight text-quill-muted">{killer.tagline}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1 pt-1">
          <button
            onClick={() => setMemoryOpen((value) => !value)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-quill-muted transition-all hover:text-[#A1A7B0]"
          >
            <span className="flex items-center gap-1.5">
              <FolderIcon className="h-2.5 w-2.5" aria-hidden="true" />
              Memory & Skills
            </span>
            <ChevronDownIcon
              className="h-2.75 w-2.75 transition-transform"
              aria-hidden="true"
              style={{ transform: memoryOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
            />
          </button>

          <div
            className="overflow-hidden transition-all duration-200"
            style={{ maxHeight: memoryOpen ? "700px" : "0px", opacity: memoryOpen ? 1 : 0 }}
          >
            <div className="flex flex-col gap-1 pb-2 pt-1">
              {filteredMemoryShortcuts.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.action === "settings") {
                        setSettingsOpen(true);
                        return;
                      }

                      if (item.prompt) {
                        openAgentPrompt(item.prompt, item.launchMode ?? "draft");
                      }
                    }}
                    className="flex w-full items-start gap-2.5 rounded-xl border border-transparent px-3 py-2.5 text-left transition-all duration-150 hover:border-[rgba(239,68,68,0.24)] hover:bg-quill-surface-2"
                  >
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-quill-muted" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium leading-tight text-[#C1C7D0]">{item.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-tight text-quill-muted">{item.subtitle}</span>
                    </span>
                  </button>
                );
              })}

              {filteredSkillShortcuts.length > 0 && (
                <div className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-quill-muted">Learned skills</div>
              )}
              {filteredSkillShortcuts.map((item) => (
                <button
                  key={item.id}
                  onClick={() => openAgentPrompt(item.prompt, item.launchMode ?? "q")}
                  className="flex w-full items-start gap-2.5 rounded-xl border border-transparent px-3 py-2.5 text-left transition-all duration-150 hover:border-[rgba(239,68,68,0.24)] hover:bg-quill-surface-2"
                >
                  <SparklesIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F87171]" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium leading-tight text-[#C1C7D0]">{item.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-tight text-quill-muted">{item.subtitle}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1 pt-1">
          <button
            onClick={() => setStudioOpen((value) => !value)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-quill-muted transition-all hover:text-[#A1A7B0]"
          >
            <span className="flex items-center gap-1.5">
              <DocumentTextIcon className="h-2.5 w-2.5" aria-hidden="true" />
              Artifact Studio
            </span>
            <ChevronDownIcon
              className="h-2.75 w-2.75 transition-transform"
              aria-hidden="true"
              style={{ transform: studioOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
            />
          </button>

          <div
            className="overflow-hidden transition-all duration-200"
            style={{ maxHeight: studioOpen ? "1200px" : "0px", opacity: studioOpen ? 1 : 0 }}
          >
            <div className="space-y-3 pb-2 pt-1">
              {filteredArtifactGroups.map((group) => {
                const Icon = group.icon;
                return (
                  <div key={group.id} className="rounded-xl border border-quill-border bg-quill-surface/40 px-2.5 py-2.5">
                    <div className="flex items-start gap-2.5 px-1 pb-2">
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-quill-muted" aria-hidden="true" />
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium text-quill-text">{group.label}</div>
                        <div className="mt-0.5 text-[11px] leading-tight text-quill-muted">{group.subtitle}</div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => openAgentPrompt(item.prompt, item.launchMode ?? "q")}
                          className="flex w-full items-start gap-2 rounded-lg border border-transparent px-2 py-2 text-left transition-all duration-150 hover:border-[rgba(239,68,68,0.2)] hover:bg-quill-surface-2"
                        >
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#EF4444]" />
                          <span className="min-w-0">
                            <span className="block text-[12px] font-medium leading-tight text-[#C1C7D0]">{item.label}</span>
                            <span className="mt-0.5 block text-[11px] leading-tight text-quill-muted">{item.subtitle}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mx-4 my-2 border-t border-quill-border" />

        <div className="space-y-1">
          <button
            onClick={() => setHistoryOpen((value) => !value)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-quill-muted transition-all hover:text-[#A1A7B0]"
          >
            <span className="flex items-center gap-1.5">
              <ClockIcon className="h-2.5 w-2.5" aria-hidden="true" />
              History
            </span>
            <ChevronDownIcon
              className="h-2.75 w-2.75 transition-transform"
              aria-hidden="true"
              style={{ transform: historyOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
            />
          </button>

          <div
            className="overflow-hidden transition-all duration-200"
            style={{ maxHeight: historyOpen ? "2000px" : "0px", opacity: historyOpen ? 1 : 0 }}
          >
            <div className="flex flex-col gap-0.5 pb-3 pt-1">
              {filteredChats.length === 0 && (
                sessionStatus === "unauthenticated" ? (
                  <div className="px-2 py-2">
                    <p className="text-xs leading-relaxed text-quill-muted">Sign in to save and search conversation history.</p>
                  </div>
                ) : normalizedQuery ? (
                  <p className="px-3 py-2 text-xs italic text-quill-muted">No chats match your search</p>
                ) : (
                  <p className="px-3 py-2 text-xs italic text-quill-muted">No conversations yet</p>
                )
              )}

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
                    <button
                      onClick={() => openChat(chat.id)}
                      className="flex min-w-0 flex-1 items-start gap-2 px-3 py-2 pr-11 text-left md:pr-3"
                    >
                      <span
                        className="mt-1.5 h-1 w-1 shrink-0 rounded-full transition-colors"
                        style={{ background: isPinned ? "#EF4444" : "#343944" }}
                      />
                      <span className="line-clamp-2 pr-5 text-[13px] leading-snug text-quill-muted transition-colors group-hover:text-[#b8b8d0]">
                        {chat.title}
                      </span>
                    </button>

                    <div
                      className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 transition-opacity duration-150 md:flex"
                      style={{ opacity: isHovered ? 1 : 0 }}
                    >
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          togglePin(chat.id);
                        }}
                        title={isPinned ? "Unpin" : "Pin to top"}
                        className="rounded-md p-1 transition-all hover:bg-quill-border"
                        style={{ color: isPinned ? "#EF4444" : "#838387" }}
                      >
                        {isPinned ? <StarIconSolid className="h-2.75 w-2.75" aria-hidden="true" /> : <StarIconOutline className="h-2.75 w-2.75" aria-hidden="true" />}
                      </button>

                      <button
                        onClick={(event) => {
                          event.stopPropagation();
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
                        className={`rounded-md p-1 transition-all ${shareToast === chat.id ? "bg-[#22c55e]/10 text-[#4ade80]" : "text-quill-muted hover:bg-quill-border hover:text-[#A1A7B0]"}`}
                      >
                        <ShareIcon className="h-2.75 w-2.75" aria-hidden="true" />
                      </button>

                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          requestDeleteChat(chat);
                        }}
                        disabled={deletingChatId === chat.id}
                        title="Delete chat"
                        className="rounded-md p-1 text-quill-muted transition-all hover:bg-quill-border hover:text-[#f87171] disabled:opacity-50"
                      >
                        <TrashIcon className="h-2.75 w-2.75" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="absolute right-2 top-2 md:hidden">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenChatMenuId((prev) => (prev === chat.id ? null : chat.id));
                        }}
                        title="More actions"
                        className="rounded-md p-1 text-quill-muted transition-all hover:bg-quill-border hover:text-[#b8b8d0]"
                      >
                        <EllipsisVerticalIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>

                      {openChatMenuId === chat.id && (
                        <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-quill-border bg-[#11111a] p-1.5 shadow-xl">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              togglePin(chat.id);
                              setOpenChatMenuId(null);
                            }}
                            className="w-full rounded-md px-2 py-1.5 text-left text-xs text-[#C1C7D0] transition-all hover:bg-quill-border"
                          >
                            {isPinned ? "Unpin" : "Pin to top"}
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              const url = `${window.location.origin}/share/${chat.id}`;
                              navigator.clipboard.writeText(url).then(() => {
                                setShareToast(chat.id);
                                setTimeout(() => setShareToast(null), 1500);
                              }).catch(() => {
                                setShareToast(`error-${chat.id}`);
                                setTimeout(() => setShareToast(null), 1500);
                              });
                              setOpenChatMenuId(null);
                            }}
                            className="w-full rounded-md px-2 py-1.5 text-left text-xs text-[#C1C7D0] transition-all hover:bg-quill-border"
                          >
                            Copy share link
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              requestDeleteChat(chat);
                              setOpenChatMenuId(null);
                            }}
                            disabled={deletingChatId === chat.id}
                            className="w-full rounded-md px-2 py-1.5 text-left text-xs text-[#f7b0b0] transition-all hover:bg-quill-border disabled:opacity-50"
                          >
                            Delete chat
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 space-y-2 border-t border-quill-border px-3 py-3">
        <div className="rounded-xl border border-quill-border bg-quill-surface/60 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-quill-muted">Engine Status</p>
              <p className="mt-0.5 text-[12px] font-medium text-quill-text">Apex runtime</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-medium ${engineTone}`}>
              <CpuChipIcon className="h-3 w-3" aria-hidden="true" />
              {engineLabel}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-quill-muted">{engineDetail}</p>
        </div>

        {sessionStatus === "authenticated" && session?.user ? (
          <>
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#F87171] to-[#F87171] text-xs font-bold uppercase text-white">
                {(session.user.name ?? session.user.email ?? "U")[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight text-quill-text">
                  {session.user.name ?? session.user.email?.split("@")[0] ?? "User"}
                </p>
                <p className="truncate text-[11px] leading-tight text-quill-muted">{planLabel}</p>
              </div>
              <button
                onClick={() => setSettingsOpen(true)}
                title="Settings"
                className="shrink-0 rounded-lg p-1.5 text-quill-muted transition-all hover:bg-quill-surface-2 hover:text-quill-text"
              >
                <Cog6ToothIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                onClick={async () => {
                  await authClient.signOut();
                  router.push("/login");
                }}
                title="Sign out"
                className="shrink-0 rounded-lg p-1.5 text-quill-muted transition-all hover:bg-quill-surface-2 hover:text-[#f87171]"
              >
                <ArrowRightStartOnRectangleIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-1.5 px-2 pb-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-quill-muted">{messagesUsedToday}/{recommendedDailyLimit} today</span>
                <span className="text-[11px] text-quill-muted">{planLabel}</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-quill-border">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${usagePercent}%`, background: "linear-gradient(to right, #EF4444, #F87171)" }}
                />
              </div>
              {planLabel === "Free" && (
                <button
                  onClick={() => navigateTo("/pricing")}
                  className="text-[11px] text-quill-muted transition-colors hover:text-quill-text"
                >
                  Upgrade
                </button>
              )}
            </div>
          </>
        ) : (
          <Link
            href="/login"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-quill-border px-3 py-2 text-xs font-medium text-quill-muted transition-all hover:border-[rgba(239,68,68,0.4)] hover:bg-quill-surface hover:text-quill-text"
          >
            <ArrowRightStartOnRectangleIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Sign in to sync
          </Link>
        )}
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {pendingDeleteChat && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-quill-border bg-[#0d0d15] p-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-quill-text">Delete this chat?</h3>
            <p className="mt-2 text-xs leading-relaxed text-quill-muted">
              This action cannot be undone. The conversation will be removed from your history.
            </p>
            <p className="mt-2 line-clamp-2 text-xs text-[#A1A7B0]">{pendingDeleteChat.title}</p>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setPendingDeleteChat(null)}
                className="rounded-lg border border-quill-border px-3 py-1.5 text-xs text-[#A1A7B0] transition-all hover:border-quill-border-2 hover:text-quill-text"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  void confirmDeleteChat();
                }}
                disabled={deletingChatId === pendingDeleteChat.id}
                className="rounded-lg bg-[#EF4444] px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-[#DC2626] disabled:opacity-60"
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
