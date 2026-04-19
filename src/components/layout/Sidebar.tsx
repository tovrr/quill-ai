"use client";

import { useState, useCallback, useEffect, type ComponentType, type SVGProps } from "react";
import { authClient } from "@/lib/auth/client";
import Link from "next/link";
import {
  BookOpenIcon,
  ChartBarSquareIcon,
  ChevronDownIcon,
  ClockIcon,
  CodeBracketIcon,
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
  ArchiveBoxIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { SparklesIcon, StarIcon as StarIconSolid } from "@heroicons/react/20/solid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuillLogo } from "@/components/ui/QuillLogo";
import { SettingsModal } from "@/components/ui/SettingsModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { KILLERS } from "@/lib/ai/killers";

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
const sidebarSectionToggleClass = "flex h-auto w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-quill-muted hover:text-[#A1A7B0]";
const sidebarRowButtonClass = "flex h-auto w-full items-start justify-start gap-2.5 rounded-xl border border-transparent px-3 py-2.5 text-left transition-all duration-150 hover:border-[rgba(239,68,68,0.24)] hover:bg-quill-surface-2";

interface SidebarProps {
  onClose?: () => void;
  mobileCompact?: boolean;
}

const PRIMARY_WORKSPACE_LINKS: CommandLink[] = [
  {
    id: "workspace",
    label: "Workspace",
    subtitle: "Open the main agent console",
    href: "/agent",
    icon: Squares2X2Icon,
  },
  {
    id: "autopilot",
    label: "Autopilot",
    subtitle: "Run recurring workflows",
    href: "/autopilot",
    icon: ClockIcon,
  },
  {
    id: "artifacts",
    label: "Artifact History",
    subtitle: "Browse every builder version",
    href: "/artifacts",
    icon: ArchiveBoxIcon,
  },
];

const EXPLORE_LINKS: CommandLink[] = [
  {
    id: "overview",
    label: "Overview",
    subtitle: "Home, docs, and product context",
    href: "/",
    icon: HomeIcon,
  },
  {
    id: "docs",
    label: "Docs",
    subtitle: "Patterns, canvas rules, and builder guides",
    href: "/docs",
    icon: BookOpenIcon,
  },
  {
    id: "mcp",
    label: "MCP Catalog",
    subtitle: "Connect MCP servers and tools",
    href: "/mcp",
    icon: WrenchScrewdriverIcon,
  },
  {
    id: "google-workspace",
    label: "Google Workspace",
    subtitle: "Docs, Drive, and Calendar",
    href: "/workspace",
    icon: GlobeAltIcon,
  },
  {
    id: "skills",
    label: "Skills",
    subtitle: "Install and manage agent skills",
    href: "/skills",
    icon: CpuChipIcon,
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

export function Sidebar({ onClose, mobileCompact = false }: SidebarProps = {}) {
  const [session, setSession] = useState<SessionData>(null);
  const [sessionStatus, setSessionStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const [recentChats, setRecentChats] = useState<Chat[]>([]);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [pendingDeleteChat, setPendingDeleteChat] = useState<Chat | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [agentsOpen, setAgentsOpen] = useState(true);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchPlaceholder = mobileCompact ? "Search chats, agents..." : "Search chats, agents, shortcuts";
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
  const filteredPrimaryLinks = PRIMARY_WORKSPACE_LINKS.filter((item) =>
    matchesQuery(normalizedQuery, item.label, item.subtitle),
  );
  const filteredExploreLinks = EXPLORE_LINKS.filter((item) => matchesQuery(normalizedQuery, item.label, item.subtitle));
  const filteredAgents = KILLERS.filter((killer) => matchesQuery(normalizedQuery, killer.name, killer.shortName, killer.tagline, killer.description));
  const filteredMemoryShortcuts = MEMORY_SHORTCUTS.filter((item) => matchesQuery(normalizedQuery, item.label, item.subtitle));
  const filteredSkillShortcuts = SKILL_SHORTCUTS.filter((item) => matchesQuery(normalizedQuery, item.label, item.subtitle));
  const filteredArtifactGroups = ARTIFACT_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => matchesQuery(normalizedQuery, group.label, group.subtitle, item.label, item.subtitle)),
  })).filter((group) => group.items.length > 0 || matchesQuery(normalizedQuery, group.label, group.subtitle));
  const filteredChats = sortedChats.filter((chat) => matchesQuery(normalizedQuery, chat.title));
  const hasMatches =
    filteredPrimaryLinks.length > 0 ||
    (!mobileCompact && filteredExploreLinks.length > 0) ||
    filteredAgents.length > 0 ||
    (!mobileCompact && filteredMemoryShortcuts.length > 0) ||
    (!mobileCompact && filteredSkillShortcuts.length > 0) ||
    (!mobileCompact && filteredArtifactGroups.length > 0) ||
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
  const sidebarHistoryActionClass = "h-7 w-7 rounded-md text-quill-muted hover:bg-quill-border hover:text-[#A1A7B0]";

  return (
    <TooltipProvider delayDuration={500}>
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

        <div className="mt-4 space-y-3">
          <Button
            onClick={() => navigateTo("/agent")}
            type="button"
            className="flex h-auto w-full items-center justify-center gap-2.5 rounded-xl bg-[#EF4444] px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-[rgba(239,68,68,0.25)] transition-all duration-150 hover:bg-[#DC2626]"
          >
            <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
            New mission
          </Button>

          <div className="flex items-center gap-2 rounded-xl border border-quill-border bg-quill-surface px-3 py-2">
            <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-quill-muted" aria-hidden="true" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-auto w-full border-0 bg-transparent px-0 py-0 text-sm text-quill-text shadow-none focus-visible:ring-0 placeholder:text-quill-muted"
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
          <Button
            type="button"
            variant="ghost"
            onClick={() => setWorkspaceOpen((value) => !value)}
            className={sidebarSectionToggleClass}
          >
            <span className="flex items-center gap-1.5">
              <Squares2X2Icon className="h-2.5 w-2.5" aria-hidden="true" />
              Workspace
            </span>
            <ChevronDownIcon
              className="h-2.75 w-2.75 transition-transform"
              aria-hidden="true"
              style={{ transform: workspaceOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
            />
          </Button>

          <div
            className="overflow-hidden transition-all duration-200"
            style={{ maxHeight: workspaceOpen ? "320px" : "0px", opacity: workspaceOpen ? 1 : 0 }}
          >
            <div className="flex flex-col gap-1 pb-2 pt-1">
              {filteredPrimaryLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    type="button"
                    variant="ghost"
                    onClick={() => navigateTo(item.href)}
                    className={sidebarRowButtonClass}
                  >
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-quill-muted" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium leading-tight text-[#C1C7D0]">{item.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-tight text-quill-muted">{item.subtitle}</span>
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        {!mobileCompact && (
        <div className="space-y-1 pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setExploreOpen((value) => !value)}
            className={sidebarSectionToggleClass}
          >
            <span className="flex items-center gap-1.5">
              <HomeIcon className="h-2.5 w-2.5" aria-hidden="true" />
              Explore
            </span>
            <ChevronDownIcon
              className="h-2.75 w-2.75 transition-transform"
              aria-hidden="true"
              style={{ transform: exploreOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
            />
          </Button>

          <div
            className="overflow-hidden transition-all duration-200"
            style={{ maxHeight: exploreOpen ? "640px" : "0px", opacity: exploreOpen ? 1 : 0 }}
          >
            <div className="flex flex-col gap-1 pb-2 pt-1">
              {filteredExploreLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    type="button"
                    variant="ghost"
                    onClick={() => navigateTo(item.href)}
                    className={sidebarRowButtonClass}
                  >
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-quill-muted" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium leading-tight text-[#C1C7D0]">{item.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-tight text-quill-muted">{item.subtitle}</span>
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
        )}

        <div className="space-y-1 pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setAgentsOpen((value) => !value)}
            className={sidebarSectionToggleClass}
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
          </Button>

          <div
            className="overflow-hidden transition-all duration-200"
            style={{ maxHeight: agentsOpen ? "720px" : "0px", opacity: agentsOpen ? 1 : 0 }}
          >
            <div className="flex flex-col gap-1 pb-2 pt-1">
              {filteredAgents.map((killer) => (
                <Button
                  key={killer.id}
                  type="button"
                  variant="ghost"
                  onClick={() => openAgentForKiller(killer.id)}
                  className={sidebarRowButtonClass}
                >
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: killer.accent }} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium leading-tight text-[#C1C7D0]">{killer.name}</span>
                    <span className="mt-0.5 block text-[11px] leading-tight text-quill-muted">{killer.tagline}</span>
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </div>

        {!mobileCompact && (
        <div className="space-y-1 pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMemoryOpen((value) => !value)}
            className={sidebarSectionToggleClass}
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
          </Button>

          <div
            className="overflow-hidden transition-all duration-200"
            style={{ maxHeight: memoryOpen ? "700px" : "0px", opacity: memoryOpen ? 1 : 0 }}
          >
            <div className="flex flex-col gap-1 pb-2 pt-1">
              {filteredMemoryShortcuts.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (item.action === "settings") {
                        setSettingsOpen(true);
                        return;
                      }

                      if (item.prompt) {
                        openAgentPrompt(item.prompt, item.launchMode ?? "draft");
                      }
                    }}
                    className={sidebarRowButtonClass}
                  >
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-quill-muted" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium leading-tight text-[#C1C7D0]">{item.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-tight text-quill-muted">{item.subtitle}</span>
                    </span>
                  </Button>
                );
              })}

              {filteredSkillShortcuts.length > 0 && (
                <div className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-quill-muted">Learned skills</div>
              )}
              {filteredSkillShortcuts.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  variant="ghost"
                  onClick={() => openAgentPrompt(item.prompt, item.launchMode ?? "q")}
                  className={sidebarRowButtonClass}
                >
                  <SparklesIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F87171]" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium leading-tight text-[#C1C7D0]">{item.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-tight text-quill-muted">{item.subtitle}</span>
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </div>
        )}

        {!mobileCompact && (
        <div className="space-y-1 pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStudioOpen((value) => !value)}
            className={sidebarSectionToggleClass}
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
          </Button>

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
                        <Button
                          key={item.id}
                          type="button"
                          variant="ghost"
                          onClick={() => openAgentPrompt(item.prompt, item.launchMode ?? "q")}
                          className="flex h-auto w-full items-start justify-start gap-2 rounded-lg border border-transparent px-2 py-2 text-left transition-all duration-150 hover:border-[rgba(239,68,68,0.2)] hover:bg-quill-surface-2"
                        >
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#EF4444]" />
                          <span className="min-w-0">
                            <span className="block text-[12px] font-medium leading-tight text-[#C1C7D0]">{item.label}</span>
                            <span className="mt-0.5 block text-[11px] leading-tight text-quill-muted">{item.subtitle}</span>
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        )}

        <div className="mx-4 my-2 border-t border-quill-border" />

        <div className="space-y-1">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setHistoryOpen((value) => !value)}
            className={sidebarSectionToggleClass}
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
          </Button>

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
                      <span className="line-clamp-2 pr-5 text-[13px] leading-snug text-quill-muted transition-colors group-hover:text-[#b8b8d0]">
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
                            {isPinned ? <StarIconSolid className="h-2.75 w-2.75" aria-hidden="true" /> : <StarIconOutline className="h-2.75 w-2.75" aria-hidden="true" />}
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
                              navigator.clipboard.writeText(url).then(() => {
                                setShareToast(chat.id);
                                setTimeout(() => setShareToast(null), 1500);
                              }).catch(() => {
                                setShareToast(`error-${chat.id}`);
                                setTimeout(() => setShareToast(null), 1500);
                              });
                            }}
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={shareToast === chat.id ? "Share link copied" : "Copy share link"}
                            className={`${sidebarHistoryActionClass} ${shareToast === chat.id ? "bg-[#22c55e]/10 text-[#4ade80]" : "text-quill-muted hover:bg-quill-border hover:text-[#A1A7B0]"}`}
                          >
                            <ShareIcon className="h-2.75 w-2.75" aria-hidden="true" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">{shareToast === chat.id ? "Copied!" : "Copy share link"}</TooltipContent>
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
                            className="h-7 w-7 rounded-md text-quill-muted transition-all hover:bg-quill-border hover:text-[#f87171] disabled:opacity-50"
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
                            className="h-8 w-8 rounded-md text-quill-muted hover:bg-quill-border hover:text-[#b8b8d0]"
                          >
                            <EllipsisVerticalIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">More actions</TooltipContent>
                      </Tooltip>

                      {openChatMenuId === chat.id && (
                        <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-quill-border bg-[#11111a] p-1.5 shadow-xl">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              togglePin(chat.id);
                              setOpenChatMenuId(null);
                            }}
                            className="h-auto w-full justify-start rounded-md px-2 py-1.5 text-left text-xs text-[#C1C7D0] hover:bg-quill-border"
                          >
                            {isPinned ? "Unpin" : "Pin to top"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
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
                            className="h-auto w-full justify-start rounded-md px-2 py-1.5 text-left text-xs text-[#C1C7D0] hover:bg-quill-border"
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
                            className="h-auto w-full justify-start rounded-md px-2 py-1.5 text-left text-xs text-[#f7b0b0] hover:bg-quill-border disabled:opacity-50"
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

        {/* Account and usage moved to header account dropdown to reduce duplicate controls. */}
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setPendingDeleteChat(null)}
                className="h-auto rounded-lg px-3 py-1.5 text-xs text-[#A1A7B0] hover:border-quill-border-2 hover:text-quill-text"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  void confirmDeleteChat();
                }}
                disabled={deletingChatId === pendingDeleteChat.id}
                className="h-auto rounded-lg bg-[#EF4444] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#DC2626] disabled:opacity-60"
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
