"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  Bars3Icon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Sidebar } from "@/components/layout/Sidebar";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import type { Skill, SkillConfigField } from "@/lib/extensions/skills";

export const dynamic = "force-dynamic";

export default function SkillsPage() {
  return (
    <Suspense fallback={<div className="flex h-screen bg-quill-bg text-quill-muted items-center justify-center text-sm">Loadingâ€¦</div>}>
      <SkillsContent />
    </Suspense>
  );
}

type SkillWithStatus = Skill & {
  installed: boolean;
  enabled: boolean;
  config: Record<string, unknown> | null;
  installedAt: string | null;
};

type ConfigDrawerState = { skill: SkillWithStatus; values: Record<string, string> } | null;

const CATEGORY_LABELS: Record<string, string> = {
  productivity: "Productivity",
  search: "Search & Research",
  code: "Code & Execution",
  communication: "Communication",
  data: "Data",
};

function SkillIcon({ skill }: { skill: Skill }) {
  const colorClass = skill.color ?? "text-quill-muted";

  const icons: Record<string, string> = {
    "web-search": "M21 21l-4.35-4.35m0 0A7.5 7.5 0 1 0 6.65 6.65a7.5 7.5 0 0 0 10 10z",
    "code-execution": "M6.75 7.5 3 12l3.75 4.5m6.75-9 3.75 4.5-3.75 4.5m-3 1.5 2.25-10.5",
    "image-generation": "M2.25 15.75 7.5 10.5l3 3 4.5-4.5 5.25 5.25M3 3h18v13.5H3z",
    "google-workspace": "M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 1.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z",
    github: "M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.165 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.014-1.703-2.782.603-3.369-1.34-3.369-1.34-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.026A9.578 9.578 0 0 1 12 6.836a9.58 9.58 0 0 1 2.504.337c1.909-1.295 2.747-1.026 2.747-1.026.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.742 0 .267.18.578.688.48A10.002 10.002 0 0 0 22 12C22 6.477 17.523 2 12 2z",
    notion: "M4.5 5.5h15v13h-15zM9 9h6M9 12h6M9 15h4",
    slack: "M14.5 10a1.5 1.5 0 0 0 0-3H9.5a1.5 1.5 0 0 0 0 3h5zm-5 4a1.5 1.5 0 0 0 0 3h5a1.5 1.5 0 0 0 0-3h-5zM10 9.5a1.5 1.5 0 0 0-3 0v5a1.5 1.5 0 0 0 3 0v-5zm7 0a1.5 1.5 0 0 0-3 0v5a1.5 1.5 0 0 0 3 0v-5z",
    linear: "M3 12L12 3l9 9-9 9-9-9z",
  };

  const path = icons[skill.id] ?? "M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z";

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`h-6 w-6 ${colorClass} shrink-0`}>
      <path d={path} />
    </svg>
  );
}

function SkillsContent() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [skills, setSkills] = useState<SkillWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [configDrawer, setConfigDrawer] = useState<ConfigDrawerState>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(Object.keys(CATEGORY_LABELS)));

  useEffect(() => {
    authClient.getSession().then((s) => {
      if (!s?.data?.user) router.push("/login");
    });
  }, [router]);

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d: { skills?: SkillWithStatus[] }) => {
        if (d.skills) setSkills(d.skills);
      })
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleInstall(skill: SkillWithStatus) {
    if (skill.configFields?.length) {
      setConfigDrawer({ skill, values: {} });
      return;
    }
    setActionLoading(skill.id);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId: skill.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        showToast(`Failed: ${err.error ?? res.status}`);
        return;
      }
      setSkills((prev) => prev.map((s) => s.id === skill.id ? { ...s, installed: true, enabled: true } : s));
      showToast(`${skill.name} installed`);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUninstall(skill: SkillWithStatus) {
    if (!confirm(`Uninstall "${skill.name}"?`)) return;
    setActionLoading(skill.id);
    try {
      const res = await fetch(`/api/skills/${skill.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        showToast(`Failed: ${err.error ?? res.status}`);
        return;
      }
      setSkills((prev) => prev.map((s) => s.id === skill.id ? { ...s, installed: false, enabled: false } : s));
      showToast(`${skill.name} uninstalled`);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSaveConfig() {
    if (!configDrawer) return;
    const { skill, values } = configDrawer;

    const required = skill.configFields?.filter((f) => f.required) ?? [];
    const missing = required.filter((f) => !values[f.key]?.trim());
    if (missing.length) {
      showToast(`Required: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }

    setActionLoading(skill.id);
    try {
      if (!skill.installed) {
        const res = await fetch("/api/skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skillId: skill.id, config: values }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string };
          showToast(`Failed: ${err.error ?? res.status}`);
          return;
        }
        setSkills((prev) => prev.map((s) => s.id === skill.id ? { ...s, installed: true, enabled: true, config: values } : s));
      } else {
        const res = await fetch(`/api/skills/${skill.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: values }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string };
          showToast(`Failed: ${err.error ?? res.status}`);
          return;
        }
        setSkills((prev) => prev.map((s) => s.id === skill.id ? { ...s, config: values } : s));
      }
      showToast(`${skill.name} ${skill.installed ? "updated" : "installed"}`);
      setConfigDrawer(null);
    } finally {
      setActionLoading(null);
    }
  }

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  const grouped = Object.entries(CATEGORY_LABELS).map(([cat, label]) => ({
    cat,
    label,
    skills: skills.filter((s) => s.category === cat),
  })).filter((g) => g.skills.length > 0);

  const installedCount = skills.filter((s) => s.installed).length;

  return (
    <div className="flex h-screen overflow-hidden bg-quill-bg text-quill-text">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50 flex w-72 flex-col">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}
      <div className="hidden lg:flex lg:w-72 lg:flex-col lg:shrink-0">
        <Sidebar />
      </div>

      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-quill-border px-4 py-3">
          <Button type="button" variant="ghost" size="icon" className="lg:hidden rounded-lg" onClick={() => setSidebarOpen(true)}>
            <Bars3Icon className="h-5 w-5" />
          </Button>
          <Link href="/agent" className="rounded-lg p-2 hover:bg-quill-surface text-quill-muted hover:text-quill-text transition-colors">
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold truncate">Skills</h1>
            <p className="text-xs text-quill-muted truncate">
              {loading ? "Loadingâ€¦" : `${installedCount} installed Â· ${skills.length} available`}
            </p>
          </div>
          <AccountMenu />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl w-full mx-auto">
          {loading ? (
            <p className="text-sm text-quill-muted py-8 text-center">Loading skillsâ€¦</p>
          ) : (
            <div className="space-y-4">
              {grouped.map(({ cat, label, skills: catSkills }) => (
                <div key={cat} className="rounded-xl border border-quill-border overflow-hidden">
                  <Button
                    onClick={() => toggleCategory(cat)}
                    type="button"
                    variant="ghost"
                    className="h-auto w-full items-center justify-between bg-quill-surface px-4 py-3 text-left hover:bg-quill-border"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-quill-muted">{label}</span>
                    {expandedCategories.has(cat) ? (
                      <ChevronDownIcon className="h-3.5 w-3.5 text-quill-muted" />
                    ) : (
                      <ChevronRightIcon className="h-3.5 w-3.5 text-quill-muted" />
                    )}
                  </Button>
                  {expandedCategories.has(cat) && (
                    <div className="divide-y divide-quill-border">
                      {catSkills.map((skill) => (
                        <SkillCard
                          key={skill.id}
                          skill={skill}
                          actionLoading={actionLoading === skill.id}
                          onInstall={() => handleInstall(skill)}
                          onUninstall={() => handleUninstall(skill)}
                          onConfigure={() => setConfigDrawer({ skill, values: (skill.config as Record<string, string> | null) ?? {} })}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Config drawer */}
      {configDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setConfigDrawer(null)}>
          <div
            className="w-full max-w-md rounded-xl border border-quill-border bg-quill-bg p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-5">
              <SkillIcon skill={configDrawer.skill} />
              <div>
                <h2 className="text-sm font-semibold">{configDrawer.skill.name}</h2>
                <p className="text-xs text-quill-muted mt-0.5">{configDrawer.skill.description}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="ml-auto h-7 w-7 rounded-md text-quill-muted hover:text-quill-text" onClick={() => setConfigDrawer(null)}>
                <XMarkIcon className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3">
              {(configDrawer.skill.configFields ?? []).map((field: SkillConfigField) => (
                <div key={field.key}>
                  <label className="block text-xs text-quill-muted mb-1">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  <Input
                    type={field.type === "password" ? "password" : "text"}
                    value={configDrawer.values[field.key] ?? ""}
                    onChange={(e) => setConfigDrawer((d) => d ? { ...d, values: { ...d.values, [field.key]: e.target.value } } : d)}
                    className="w-full rounded-lg border-quill-border bg-quill-surface px-3 py-2 text-sm"
                    placeholder={field.placeholder}
                  />
                  {field.helpText && <p className="text-xs text-quill-muted mt-1">{field.helpText}</p>}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button type="button" variant="ghost" onClick={() => setConfigDrawer(null)} className="h-auto rounded-lg px-4 py-2 text-sm text-quill-muted hover:bg-transparent hover:text-quill-text">Cancel</Button>
              <Button
                onClick={handleSaveConfig}
                type="button"
                disabled={actionLoading === configDrawer.skill.id}
                className="h-auto rounded-lg bg-quill-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {actionLoading === configDrawer.skill.id ? "Savingâ€¦" : configDrawer.skill.installed ? "Save Config" : "Install"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-quill-surface border border-quill-border px-4 py-2 text-sm shadow-lg max-w-sm">
          {toast}
        </div>
      )}
    </div>
  );
}

interface SkillCardProps {
  skill: SkillWithStatus;
  actionLoading: boolean;
  onInstall: () => void;
  onUninstall: () => void;
  onConfigure: () => void;
}

function SkillCard({ skill, actionLoading, onInstall, onUninstall, onConfigure }: SkillCardProps) {
  const isComingSoon = skill.status === "coming-soon";

  return (
    <div className={`flex items-start gap-4 px-4 py-4 bg-quill-bg ${isComingSoon ? "opacity-60" : ""}`}>
      <SkillIcon skill={skill} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{skill.name}</span>
          {isComingSoon && (
            <span className="rounded-full bg-quill-surface border border-quill-border px-2 py-0.5 text-xs text-quill-muted">
              Coming soon
            </span>
          )}
          {skill.installed && !isComingSoon && (
            <CheckCircleIcon className="h-3.5 w-3.5 text-quill-green shrink-0" />
          )}
        </div>
        <p className="text-xs text-quill-muted mt-0.5 leading-relaxed">{skill.description}</p>
        {skill.installed && skill.oauthHref && (
          <Link
            href={skill.oauthHref}
            className="inline-block mt-1.5 text-xs text-quill-accent hover:underline"
          >
            Manage connection â†’
          </Link>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!isComingSoon && skill.installed && skill.configFields?.length ? (
          <Button
            onClick={onConfigure}
            type="button"
            variant="outline"
            className="h-auto rounded-lg px-3 py-1.5 text-xs text-quill-muted hover:bg-quill-surface"
          >
            Config
          </Button>
        ) : null}
        {isComingSoon ? (
          <span className="text-xs text-quill-muted">â€”</span>
        ) : skill.installed && !skill.builtIn ? (
          <Button
            onClick={onUninstall}
            type="button"
            variant="outline"
            disabled={actionLoading}
            className="h-auto rounded-lg px-3 py-1.5 text-xs text-quill-muted hover:border-red-400 hover:text-red-400 disabled:opacity-50"
          >
            {actionLoading ? "â€¦" : "Uninstall"}
          </Button>
        ) : skill.installed && skill.builtIn ? (
          <span className="rounded-lg px-3 py-1.5 text-xs text-quill-green border border-quill-border cursor-default">
            Built-in
          </span>
        ) : (
          <Button
            onClick={onInstall}
            type="button"
            disabled={actionLoading}
            className="h-auto rounded-lg bg-quill-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {actionLoading ? "â€¦" : "Install"}
          </Button>
        )}
      </div>
    </div>
  );
}

