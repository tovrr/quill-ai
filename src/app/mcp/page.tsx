"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  Bars3Icon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExclamationCircleIcon,
  MinusCircleIcon,
  PlusIcon,
  TrashIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Sidebar } from "@/components/layout/Sidebar";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { authClient } from "@/lib/auth/client";

export const dynamic = "force-dynamic";

interface McpTool {
  id: string;
  toolName: string;
  toolDescription: string | null;
}

interface McpServer {
  id: string;
  name: string;
  url: string;
  description: string | null;
  authType: "none" | "bearer" | "basic";
  status: "connected" | "error" | "disconnected";
  toolCount: number;
  lastConnectedAt: string | null;
  createdAt: string;
  tools?: McpTool[];
}

interface RegistryItem {
  id: string;
  name: string;
  url: string;
  description: string;
  category: "development" | "productivity" | "communication" | "data";
  authType: "none" | "bearer" | "basic";
  trust: "official" | "community";
  tags: string[];
}

const STATUS_ICONS = {
  connected: <CheckCircleIcon className="h-4 w-4 text-quill-green" />,
  error: <ExclamationCircleIcon className="h-4 w-4 text-red-400" />,
  disconnected: <MinusCircleIcon className="h-4 w-4 text-quill-muted" />,
};

const STATUS_LABEL = {
  connected: "Connected",
  error: "Error",
  disconnected: "Disconnected",
};

const EXAMPLE_SERVERS = [
  { name: "Filesystem", url: "http://localhost:8811", description: "Read and write local files" },
  { name: "GitHub", url: "https://mcp.github.com", description: "Search repos, issues, and PRs" },
  { name: "Slack", url: "https://mcp.slack.com", description: "Send and read Slack messages" },
];

export default function McpPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [connecting, setConnecting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "",
    url: "",
    description: "",
    authType: "none" as "none" | "bearer" | "basic",
    authToken: "",
  });
  const [adding, setAdding] = useState(false);
  const [registryItems, setRegistryItems] = useState<RegistryItem[]>([]);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryQuery, setRegistryQuery] = useState("");

  useEffect(() => {
    authClient.getSession().then((s) => {
      if (!s?.data?.user) router.push("/login");
    });
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mcp/servers");
      if (res.ok) {
        const json = await res.json();
        setServers(json.servers ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadRegistry = useCallback(async (query: string = "") => {
    setRegistryLoading(true);
    try {
      const params = new URLSearchParams({ limit: "12" });
      if (query.trim()) {
        params.set("q", query.trim());
      }

      const res = await fetch(`/api/mcp/registry?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setRegistryItems(json.items ?? []);
      }
    } finally {
      setRegistryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRegistry();
  }, [loadRegistry]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleConnect(id: string) {
    setConnecting(id);
    try {
      const res = await fetch(`/api/mcp/servers/${id}/connect`, { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setServers((prev) =>
          prev.map((s) =>
            s.id === id
              ? { ...s, status: "connected", toolCount: json.tools?.length ?? 0, tools: json.tools ?? [] }
              : s
          )
        );
        setExpanded((prev) => new Set([...prev, id]));
        showToast(`Connected — ${json.tools?.length ?? 0} tools discovered`);
      } else {
        setServers((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status: "error" } : s))
        );
        showToast(`Connection failed: ${json.error ?? "unknown error"}`);
      }
    } finally {
      setConnecting(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this MCP server?")) return;
    setDeleting(id);
    await fetch(`/api/mcp/servers/${id}`, { method: "DELETE" });
    setServers((prev) => prev.filter((s) => s.id !== id));
    showToast("Server removed");
    setDeleting(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.url.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/mcp/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          url: form.url.trim(),
          description: form.description.trim() || undefined,
          authType: form.authType,
          authToken: form.authToken.trim() || undefined,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setServers((prev) => [json.server, ...prev]);
        setShowAdd(false);
        setForm({ name: "", url: "", description: "", authType: "none", authToken: "" });
        showToast("Server added");
      }
    } finally {
      setAdding(false);
    }
  }

  function installFromRegistry(item: RegistryItem) {
    setForm({
      name: item.name,
      url: item.url,
      description: item.description,
      authType: item.authType,
      authToken: "",
    });
    setShowAdd(true);
    showToast(`Prepared ${item.name}. Add credentials if needed, then save.`);
  }

  async function loadTools(id: string) {
    const res = await fetch(`/api/mcp/servers/${id}`);
    if (res.ok) {
      const json = await res.json();
      setServers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, tools: json.tools ?? [] } : s))
      );
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        const server = servers.find((s) => s.id === id);
        if (server && !server.tools) loadTools(id);
      }
      return next;
    });
  }

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

      <div className="hidden lg:flex lg:w-72 lg:flex-col lg:flex-shrink-0">
        <Sidebar />
      </div>

      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-quill-border px-4 py-3">
          <button className="lg:hidden rounded-lg p-2 hover:bg-quill-surface" onClick={() => setSidebarOpen(true)}>
            <Bars3Icon className="h-5 w-5" />
          </button>
          <Link href="/agent" className="rounded-lg p-2 hover:bg-quill-surface text-quill-muted hover:text-quill-text transition-colors">
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold truncate">MCP Catalog</h1>
            <p className="text-xs text-quill-muted truncate">Connect Model Context Protocol servers</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-lg bg-quill-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add Server
          </button>
          <AccountMenu />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="m-4 rounded-xl border border-quill-border bg-quill-surface p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold">Registry (Beta)</h2>
                <p className="text-xs text-quill-muted mt-1">Install curated MCP servers in one click.</p>
              </div>
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  loadRegistry(registryQuery);
                }}
              >
                <input
                  value={registryQuery}
                  onChange={(e) => setRegistryQuery(e.target.value)}
                  placeholder="Search registry"
                  className="w-44 rounded-lg border border-quill-border bg-quill-bg px-3 py-1.5 text-xs focus:outline-none focus:border-quill-accent"
                />
                <button
                  type="submit"
                  className="rounded-lg border border-quill-border px-2.5 py-1.5 text-xs hover:bg-quill-surface-2 transition-colors"
                >
                  Search
                </button>
              </form>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
              {registryLoading ? (
                <p className="text-xs text-quill-muted">Loading registry entries...</p>
              ) : registryItems.length === 0 ? (
                <p className="text-xs text-quill-muted">No registry entries found.</p>
              ) : (
                registryItems.map((item) => (
                  <div key={item.id} className="rounded-lg border border-quill-border bg-quill-bg p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{item.name}</p>
                        <p className="text-xs text-quill-muted mt-0.5 line-clamp-2">{item.description}</p>
                        <p className="text-[11px] text-quill-muted mt-1 truncate">{item.url}</p>
                      </div>
                      <button
                        onClick={() => installFromRegistry(item)}
                        className="flex-shrink-0 rounded-md border border-quill-border px-2 py-1 text-[11px] hover:bg-quill-surface-2 transition-colors"
                      >
                        Install
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-quill-muted">
                      <span className="rounded bg-quill-surface-2 px-1.5 py-0.5">{item.category}</span>
                      <span className="rounded bg-quill-surface-2 px-1.5 py-0.5">{item.authType}</span>
                      <span className="rounded bg-quill-surface-2 px-1.5 py-0.5">{item.trust}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Add form */}
          {showAdd && (
            <div className="m-4 rounded-xl border border-quill-border bg-quill-surface p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">Add MCP Server</h2>
                <button onClick={() => setShowAdd(false)} className="text-quill-muted hover:text-quill-text">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Example shortcuts */}
              <div className="mb-3">
                <p className="text-xs text-quill-muted mb-2">Quick add:</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_SERVERS.map((ex) => (
                    <button
                      key={ex.name}
                      onClick={() => setForm((f) => ({ ...f, name: ex.name, url: ex.url, description: ex.description }))}
                      className="text-xs px-2 py-1 rounded border border-quill-border hover:bg-quill-surface-2 transition-colors"
                    >
                      {ex.name}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleAdd} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-quill-muted mb-1">Name *</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full rounded-lg border border-quill-border bg-quill-bg px-3 py-2 text-sm focus:outline-none focus:border-quill-accent"
                      placeholder="e.g. Filesystem"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-quill-muted mb-1">URL *</label>
                    <input
                      value={form.url}
                      onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                      className="w-full rounded-lg border border-quill-border bg-quill-bg px-3 py-2 text-sm focus:outline-none focus:border-quill-accent"
                      placeholder="http://localhost:8811"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-quill-muted mb-1">Description</label>
                  <input
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full rounded-lg border border-quill-border bg-quill-bg px-3 py-2 text-sm focus:outline-none focus:border-quill-accent"
                    placeholder="Optional description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-quill-muted mb-1">Auth type</label>
                    <select
                      value={form.authType}
                      onChange={(e) => setForm((f) => ({ ...f, authType: e.target.value as "none" | "bearer" | "basic" }))}
                      className="w-full rounded-lg border border-quill-border bg-quill-bg px-3 py-2 text-sm focus:outline-none focus:border-quill-accent"
                    >
                      <option value="none">None</option>
                      <option value="bearer">Bearer token</option>
                      <option value="basic">Basic (user:pass)</option>
                    </select>
                  </div>
                  {form.authType !== "none" && (
                    <div>
                      <label className="block text-xs text-quill-muted mb-1">
                        {form.authType === "bearer" ? "Token" : "user:password"}
                      </label>
                      <input
                        type="password"
                        value={form.authToken}
                        onChange={(e) => setForm((f) => ({ ...f, authToken: e.target.value }))}
                        className="w-full rounded-lg border border-quill-border bg-quill-bg px-3 py-2 text-sm focus:outline-none focus:border-quill-accent"
                        placeholder={form.authType === "bearer" ? "sk-..." : "user:pass"}
                      />
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAdd(false)}
                    className="px-3 py-1.5 rounded-lg border border-quill-border text-sm hover:bg-quill-surface transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adding}
                    className="px-3 py-1.5 rounded-lg bg-quill-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {adding ? "Adding…" : "Add Server"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-quill-muted text-sm">Loading…</div>
          ) : servers.length === 0 && !showAdd ? (
            <div className="p-12 text-center">
              <WrenchScrewdriverIcon className="mx-auto h-10 w-10 text-quill-muted mb-4" />
              <p className="text-sm font-medium">No MCP servers yet</p>
              <p className="text-xs text-quill-muted mt-1 mb-4">
                Connect any Model Context Protocol server to give Quill access to new tools.
              </p>
              <button
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-quill-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
              >
                <PlusIcon className="h-4 w-4" /> Add your first server
              </button>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {servers.map((server) => (
                <div key={server.id} className="rounded-xl border border-quill-border bg-quill-surface overflow-hidden">
                  {/* Server header */}
                  <div className="flex items-center gap-3 p-4">
                    <div className="flex-shrink-0">{STATUS_ICONS[server.status]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{server.name}</span>
                        <span className="text-xs text-quill-muted bg-quill-surface-2 px-1.5 py-0.5 rounded">
                          {STATUS_LABEL[server.status]}
                        </span>
                        {server.toolCount > 0 && (
                          <span className="text-xs text-quill-muted">
                            {server.toolCount} tool{server.toolCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-quill-muted truncate mt-0.5">{server.url}</p>
                      {server.description && (
                        <p className="text-xs text-quill-muted truncate">{server.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleConnect(server.id)}
                        disabled={connecting === server.id}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-quill-border hover:bg-quill-surface-2 transition-colors disabled:opacity-50"
                      >
                        {connecting === server.id ? "Connecting…" : "Connect"}
                      </button>
                      {server.toolCount > 0 && (
                        <button
                          onClick={() => toggleExpand(server.id)}
                          className="p-1.5 rounded-lg hover:bg-quill-surface-2 text-quill-muted transition-colors"
                        >
                          {expanded.has(server.id) ? (
                            <ChevronDownIcon className="h-4 w-4" />
                          ) : (
                            <ChevronRightIcon className="h-4 w-4" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(server.id)}
                        disabled={deleting === server.id}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 text-quill-muted transition-colors disabled:opacity-50"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Tools list */}
                  {expanded.has(server.id) && (
                    <div className="border-t border-quill-border bg-quill-bg">
                      {server.tools === undefined ? (
                        <p className="px-4 py-3 text-xs text-quill-muted">Loading tools…</p>
                      ) : server.tools.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-quill-muted">No tools discovered</p>
                      ) : (
                        <ul className="divide-y divide-quill-border">
                          {server.tools.map((tool) => (
                            <li key={tool.id} className="flex items-start gap-3 px-4 py-2.5">
                              <WrenchScrewdriverIcon className="h-3.5 w-3.5 text-quill-muted mt-0.5 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-mono font-medium">{tool.toolName}</p>
                                {tool.toolDescription && (
                                  <p className="text-xs text-quill-muted mt-0.5">{tool.toolDescription}</p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-quill-surface border border-quill-border px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
