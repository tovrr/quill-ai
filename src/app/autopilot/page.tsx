"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  Bars3Icon,
  BoltIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  ExclamationCircleIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Sidebar } from "@/components/layout/Sidebar";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { authClient } from "@/lib/auth/client";

export const dynamic = "force-dynamic";

interface Workflow {
  id: string;
  name: string;
  prompt: string;
  cronExpression: string;
  timezone: string;
  status: "active" | "paused";
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastRunStatus: "success" | "failed" | null;
  createdAt: string;
}

interface Run {
  id: string;
  workflowId: string;
  status: "success" | "failed";
  summary: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

const CRON_TEMPLATES = [
  { label: "Every day at 8am", value: "0 8 * * *" },
  { label: "Every Monday at 9am", value: "0 9 * * 1" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every weekday at 7am", value: "0 7 * * 1-5" },
];

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return "Never";
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function formatUpcomingTime(dateString: string | null): string {
  if (!dateString) return "—";
  const diff = new Date(dateString).getTime() - Date.now();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (diff < 0) return "Overdue";
  if (minutes < 60) return `in ${minutes}m`;
  if (hours < 24) return `in ${hours}h`;
  return `in ${days}d`;
}

type FormState = {
  name: string;
  prompt: string;
  cronExpression: string;
  timezone: string;
};

const DEFAULT_FORM: FormState = {
  name: "",
  prompt: "",
  cronExpression: "0 8 * * *",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
};

export default function AutopilotPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Session gate
  useEffect(() => {
    authClient.getSession().then((result) => {
      if (result?.data?.user) {
        setSessionStatus("authenticated");
      } else {
        setSessionStatus("unauthenticated");
        router.push("/login");
      }
    }).catch(() => {
      setSessionStatus("unauthenticated");
      router.push("/login");
    });
  }, [router]);

  const loadData = useCallback(async () => {
    setLoadingWorkflows(true);
    try {
      const [wRes, rRes] = await Promise.all([
        fetch("/api/autopilot/workflows", { cache: "no-store" }),
        fetch("/api/autopilot/runs?limit=20", { cache: "no-store" }),
      ]);
      if (wRes.ok) {
        const { workflows: w } = await wRes.json() as { workflows: Workflow[] };
        setWorkflows(w);
      }
      if (rRes.ok) {
        const { runs: r } = await rRes.json() as { runs: Run[] };
        setRuns(r);
      }
    } finally {
      setLoadingWorkflows(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      void loadData();
    }
  }, [sessionStatus, loadData]);

  function showToast(message: string) {
    setSuccessToast(message);
    setTimeout(() => setSuccessToast(null), 2500);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSaving(true);
    try {
      const res = await fetch("/api/autopilot/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { workflow?: Workflow; error?: string };
      if (!res.ok) {
        setFormError(data.error ?? "Failed to create workflow");
        return;
      }
      if (data.workflow) {
        setWorkflows((prev) => [data.workflow!, ...prev]);
      }
      setForm(DEFAULT_FORM);
      setShowNewForm(false);
      showToast(`"${form.name}" created`);
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setFormSaving(false);
    }
  }

  async function handleTogglePause(workflow: Workflow) {
    setActioningId(workflow.id);
    try {
      const nextStatus = workflow.status === "active" ? "paused" : "active";
      const res = await fetch(`/api/autopilot/workflows/${workflow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setWorkflows((prev) =>
          prev.map((w) => (w.id === workflow.id ? { ...w, status: nextStatus } : w))
        );
      }
    } finally {
      setActioningId(null);
    }
  }

  async function handleRunNow(workflow: Workflow) {
    setActioningId(workflow.id);
    try {
      const res = await fetch(`/api/autopilot/workflows/${workflow.id}/run`, {
        method: "POST",
      });
      const data = await res.json() as { run?: Run; error?: string };
      if (res.ok && data.run) {
        setRuns((prev) => [data.run!, ...prev.slice(0, 19)]);
        setWorkflows((prev) =>
          prev.map((w) =>
            w.id === workflow.id
              ? { ...w, lastRunAt: data.run!.startedAt, lastRunStatus: "success" }
              : w
          )
        );
        showToast(`"${workflow.name}" run complete`);
      }
    } finally {
      setActioningId(null);
    }
  }

  async function handleDelete(workflow: Workflow) {
    if (!window.confirm(`Delete "${workflow.name}"?`)) return;
    setActioningId(workflow.id);
    try {
      const res = await fetch(`/api/autopilot/workflows/${workflow.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setWorkflows((prev) => prev.filter((w) => w.id !== workflow.id));
        showToast(`"${workflow.name}" deleted`);
      }
    } finally {
      setActioningId(null);
    }
  }

  if (sessionStatus === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-quill-bg">
        <div className="text-sm text-quill-muted">Loading…</div>
      </div>
    );
  }

  const recentRunsByWorkflow = new Map<string, Run>();
  for (const run of runs) {
    if (!recentRunsByWorkflow.has(run.workflowId)) {
      recentRunsByWorkflow.set(run.workflowId, run);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-quill-bg text-quill-text">
      {/* Sidebar — mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-50 w-72 flex-shrink-0 overflow-hidden border-r border-quill-border bg-quill-surface">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Sidebar — desktop permanent */}
      <div className="hidden md:flex md:w-64 md:flex-shrink-0 md:flex-col md:border-r md:border-quill-border md:bg-quill-surface">
        <Sidebar />
      </div>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-12 items-center gap-3 border-b border-quill-border bg-quill-surface px-4">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-quill-muted transition-colors hover:bg-quill-surface-2 hover:text-quill-text md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-5 w-5" />
          </button>

          <Link
            href="/agent"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-quill-muted transition-colors hover:bg-quill-surface-2 hover:text-quill-text"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>

          <div className="flex flex-1 items-center gap-2 min-w-0">
            <ClockIcon className="h-4 w-4 flex-shrink-0 text-quill-accent" />
            <span className="truncate text-sm font-medium text-quill-text">Autopilot</span>
            <span className="text-xs text-quill-muted">Recurring AI workflows</span>
          </div>

          <button
            type="button"
            className="flex h-8 items-center gap-1.5 rounded-lg bg-quill-accent px-3 text-xs font-medium text-white transition-opacity hover:opacity-90"
            onClick={() => {
              setShowNewForm(true);
              setFormError(null);
            }}
          >
            <PlusIcon className="h-3.5 w-3.5" />
            New workflow
          </button>

          <AccountMenu compact />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* New workflow form */}
          {showNewForm && (
            <div className="mb-6 rounded-xl border border-quill-border bg-quill-surface p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-quill-text">New workflow</h2>
                <button
                  type="button"
                  className="text-quill-muted hover:text-quill-text transition-colors"
                  onClick={() => { setShowNewForm(false); setFormError(null); }}
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={(e) => { void handleCreate(e); }} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-quill-muted">Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Weekly research digest"
                    className="w-full rounded-lg border border-quill-border bg-quill-bg px-3 py-2 text-sm text-quill-text placeholder-quill-muted outline-none focus:border-quill-accent focus:ring-1 focus:ring-quill-accent"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-quill-muted">Prompt</label>
                  <textarea
                    required
                    rows={3}
                    value={form.prompt}
                    onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
                    placeholder="Summarize the latest news about AI models and write a 200-word digest."
                    className="w-full resize-none rounded-lg border border-quill-border bg-quill-bg px-3 py-2 text-sm text-quill-text placeholder-quill-muted outline-none focus:border-quill-accent focus:ring-1 focus:ring-quill-accent"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-quill-muted">Schedule (cron)</label>
                    <input
                      type="text"
                      required
                      value={form.cronExpression}
                      onChange={(e) => setForm((f) => ({ ...f, cronExpression: e.target.value }))}
                      placeholder="0 8 * * *"
                      className="w-full rounded-lg border border-quill-border bg-quill-bg px-3 py-2 font-mono text-sm text-quill-text placeholder-quill-muted outline-none focus:border-quill-accent focus:ring-1 focus:ring-quill-accent"
                    />
                    <div className="mt-1 flex flex-wrap gap-1">
                      {CRON_TEMPLATES.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          className="rounded px-1.5 py-0.5 text-xs text-quill-muted transition-colors hover:bg-quill-surface-2 hover:text-quill-text"
                          onClick={() => setForm((f) => ({ ...f, cronExpression: t.value }))}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-quill-muted">Timezone</label>
                    <input
                      type="text"
                      value={form.timezone}
                      onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                      placeholder="America/New_York"
                      className="w-full rounded-lg border border-quill-border bg-quill-bg px-3 py-2 text-sm text-quill-text placeholder-quill-muted outline-none focus:border-quill-accent focus:ring-1 focus:ring-quill-accent"
                    />
                  </div>
                </div>
                {formError && (
                  <p className="text-xs text-quill-accent">{formError}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={formSaving}
                    className="flex items-center gap-1.5 rounded-lg bg-quill-accent px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {formSaving ? "Saving…" : "Create workflow"}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-quill-border px-4 py-2 text-xs font-medium text-quill-muted transition-colors hover:bg-quill-surface-2 hover:text-quill-text"
                    onClick={() => { setShowNewForm(false); setFormError(null); }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Workflow list */}
          {loadingWorkflows && workflows.length === 0 ? (
            <div className="flex flex-col gap-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl border border-quill-border bg-quill-surface" />
              ))}
            </div>
          ) : workflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
              <ClockIcon className="h-10 w-10 text-quill-muted" />
              <p className="text-sm font-medium text-quill-text">No workflows yet</p>
              <p className="max-w-xs text-xs text-quill-muted">
                Create recurring AI workflows that run on a schedule and produce automatic digests, reports, or actions.
              </p>
              <button
                type="button"
                className="mt-2 flex items-center gap-1.5 rounded-lg bg-quill-accent px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
                onClick={() => { setShowNewForm(true); setFormError(null); }}
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Create your first workflow
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {workflows.map((workflow) => {
                const lastRun = recentRunsByWorkflow.get(workflow.id);
                const isActioning = actioningId === workflow.id;

                return (
                  <div
                    key={workflow.id}
                    className="group flex flex-col gap-3 rounded-xl border border-quill-border bg-quill-surface p-4 transition-colors hover:border-quill-border-2 sm:flex-row sm:items-start"
                  >
                    {/* Status dot */}
                    <div className="flex-shrink-0 pt-0.5">
                      <span
                        className={`block h-2 w-2 rounded-full ${
                          workflow.status === "active" ? "bg-quill-green" : "bg-quill-muted"
                        }`}
                      />
                    </div>

                    {/* Workflow details */}
                    <div className="flex flex-1 flex-col gap-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-quill-text truncate">{workflow.name}</span>
                        <span className="font-mono text-xs text-quill-muted">{workflow.cronExpression}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            workflow.status === "active"
                              ? "bg-quill-green/10 text-quill-green"
                              : "bg-quill-muted/10 text-quill-muted"
                          }`}
                        >
                          {workflow.status}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-xs text-quill-muted">{workflow.prompt}</p>
                      <div className="flex flex-wrap gap-3 pt-1 text-xs text-quill-muted">
                        <span className="flex items-center gap-1">
                          <ClockIcon className="h-3 w-3" />
                          Last run: {formatRelativeTime(workflow.lastRunAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <ChevronRightIcon className="h-3 w-3" />
                          Next: {formatUpcomingTime(workflow.nextRunAt)}
                        </span>
                        {workflow.lastRunStatus && (
                          <span
                            className={`flex items-center gap-1 ${
                              workflow.lastRunStatus === "success" ? "text-quill-green" : "text-quill-accent"
                            }`}
                          >
                            {workflow.lastRunStatus === "success" ? (
                              <CheckCircleIcon className="h-3 w-3" />
                            ) : (
                              <ExclamationCircleIcon className="h-3 w-3" />
                            )}
                            {workflow.lastRunStatus}
                          </span>
                        )}
                      </div>

                      {/* Last run summary inline */}
                      {lastRun?.summary && (
                        <p className="mt-1 rounded-lg border border-quill-border bg-quill-bg px-2 py-1.5 text-xs text-quill-muted line-clamp-2">
                          {lastRun.summary}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <button
                        type="button"
                        disabled={isActioning}
                        title={workflow.status === "active" ? "Pause" : "Resume"}
                        onClick={() => { void handleTogglePause(workflow); }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-quill-border text-quill-muted transition-colors hover:bg-quill-surface-2 hover:text-quill-text disabled:opacity-40"
                      >
                        {workflow.status === "active" ? (
                          <PauseIcon className="h-3.5 w-3.5" />
                        ) : (
                          <PlayIcon className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={isActioning || workflow.status !== "active"}
                        title="Run now"
                        onClick={() => { void handleRunNow(workflow); }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-quill-border text-quill-muted transition-colors hover:bg-quill-surface-2 hover:text-quill-text disabled:opacity-40"
                      >
                        <BoltIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isActioning}
                        title="Delete"
                        onClick={() => { void handleDelete(workflow); }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-quill-border text-quill-muted transition-colors hover:bg-quill-surface-2 hover:text-quill-accent disabled:opacity-40"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Run history */}
          {runs.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-quill-muted">Run history</h2>
              <div className="flex flex-col gap-2">
                {runs.slice(0, 10).map((run) => {
                  const workflow = workflows.find((w) => w.id === run.workflowId);
                  return (
                    <div
                      key={run.id}
                      className="flex items-start gap-3 rounded-lg border border-quill-border bg-quill-surface px-3 py-2.5"
                    >
                      <span className={`mt-0.5 flex-shrink-0 ${run.status === "success" ? "text-quill-green" : "text-quill-accent"}`}>
                        {run.status === "success" ? (
                          <CheckCircleIcon className="h-4 w-4" />
                        ) : (
                          <ExclamationCircleIcon className="h-4 w-4" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-quill-text">
                            {workflow?.name ?? "Unknown workflow"}
                          </span>
                          <span className="text-xs text-quill-muted">{formatRelativeTime(run.startedAt)}</span>
                        </div>
                        {run.summary && (
                          <p className="mt-0.5 text-xs text-quill-muted line-clamp-2">{run.summary}</p>
                        )}
                        {run.errorMessage && (
                          <p className="mt-0.5 text-xs text-quill-accent line-clamp-1">{run.errorMessage}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Success toast */}
      {successToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-quill-green/30 bg-quill-surface px-4 py-2 text-xs font-medium text-quill-green shadow-lg">
          {successToast}
        </div>
      )}
    </div>
  );
}
