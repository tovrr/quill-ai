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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  oauthAuthorizeUrl: string | null;
  oauthTokenUrl: string | null;
  oauthClientId: string | null;
  oauthConnectedAt: string | null;
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
  const [oauthPendingId, setOauthPendingId] = useState<string | null>(null);
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
        showToast(`Connected â€” ${json.tools?.length ?? 0} tools discovered`);
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

  function handleOAuthStart(id: string) {
    setOauthPendingId(id);
    window.location.assign(`/api/mcp/servers/${id}/oauth/start`);
  }

  async function handleOAuthRevoke(id: string) {
    setOauthPendingId(id);
    try {
      const res = await fetch(`/api/mcp/servers/${id}/oauth/revoke`, { method: "POST" });
      if (res.ok) {
        setServers((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  oauthConnectedAt: null,
                  status: "disconnected",
                }
              : s
          )
        );
        showToast("OAuth revoked");
      } else {
        showToast("Failed to revoke OAuth");
      }
    } finally {
      setOauthPendingId(null);
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
            <h1 className="text-sm font-semibold truncate">MCP Catalog</h1>
            <p className="text-xs text-quill-muted truncate">Connect Model Context Protocol servers</p>
          </div>
          <Button
            onClick={() => setShowAdd(true)}
            type="button"
            className="h-auto items-center gap-1.5 rounded-lg bg-quill-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add Server
          </Button>
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
                <Input
                  value={registryQuery}
                  onChange={(e) => setRegistryQuery(e.target.value)}
                  placeholder="Search registry"
                  className="h-auto w-44 rounded-lg border-quill-border bg-quill-bg px-3 py-1.5 text-xs"
                />
                <Button
                  type="submit"
                  variant="outline"
                  className="h-auto rounded-lg px-2.5 py-1.5 text-xs hover:bg-quill-surface-2"
                >
                  Search
                </Button>
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
                      <Button
                        onClick={() => installFromRegistry(item)}
                        type="button"
                        variant="outline"
                        className="h-auto shrink-0 rounded-md px-2 py-1 text-[11px] hover:bg-quill-surface-2"
                      >
                        Install
                      </Button>
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
                <Button type="button" variant="ghost" size="icon" onClick={() => setShowAdd(false)} className="h-7 w-7 rounded-md text-quill-muted hover:text-quill-text">
                  <XMarkIcon className="h-4 w-4" />
                </Button>
              </div>

              {/* Example shortcuts */}
              <div className="mb-3">
                <p className="text-xs text-quill-muted mb-2">Quick add:</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_SERVERS.map((ex) => (
                    <Button
                      key={ex.name}
                      type="button"
                      variant="outline"
                      onClick={() => setForm((f) => ({ ...f, name: ex.name, url: ex.url, description: ex.description }))}
                      className="h-auto rounded px-2 py-1 text-xs hover:bg-quill-surface-2"
                    >
                      {ex.name}
                    </Button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleAdd} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-quill-muted mb-1">Name *</label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full rounded-lg border-quill-border bg-quill-bg px-3 py-2 text-sm"
                      placeholder="e.g. Filesystem"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-quill-muted mb-1">URL *</label>
                    <Input
                      value={form.url}
                      onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                      className="w-full rounded-lg border-quill-border bg-quill-bg px-3 py-2 text-sm"
                      placeholder="http://localhost:8811"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-quill-muted mb-1">Description</label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full rounded-lg border-quill-border bg-quill-bg px-3 py-2 text-sm"
                    placeholder="Optional description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-quill-muted mb-1">Auth type</label>
                    <Select
                      value={form.authType}
                      onValueChange={(value) =>
                        setForm((f) => ({ ...f, authType: value as "none" | "bearer" | "basic" }))
                      }
                    >
                      <SelectTrigger className="w-full rounded-lg border-quill-border bg-quill-bg px-3 py-2 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="bearer">Bearer token</SelectItem>
                        <SelectItem value="basic">Basic (user:pass)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.authType !== "none" && (
                    <div>
                      <label className="block text-xs text-quill-muted mb-1">
                        {form.authType === "bearer" ? "Token" : "user:password"}
                      </label>
                      <Input
                        type="password"
                        value={form.authToken}
                        onChange={(e) => setForm((f) => ({ ...f, authToken: e.target.value }))}
                        className="w-full rounded-lg border-quill-border bg-quill-bg px-3 py-2 text-sm"
                        placeholder={form.authType === "bearer" ? "sk-..." : "user:pass"}
                      />
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    onClick={() => setShowAdd(false)}
                    variant="outline"
                    className="h-auto rounded-lg px-3 py-1.5 text-sm hover:bg-quill-surface"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={adding}
                    className="h-auto rounded-lg bg-quill-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {adding ? "Addingâ€¦" : "Add Server"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-quill-muted text-sm">Loadingâ€¦</div>
          ) : servers.length === 0 && !showAdd ? (
            <div className="p-12 text-center">
              <WrenchScrewdriverIcon className="mx-auto h-10 w-10 text-quill-muted mb-4" />
              <p className="text-sm font-medium">No MCP servers yet</p>
              <p className="text-xs text-quill-muted mt-1 mb-4">
                Connect any Model Context Protocol server to give Quill access to new tools.
              </p>
              <Button
                onClick={() => setShowAdd(true)}
                type="button"
                className="inline-flex h-auto items-center gap-1.5 rounded-lg bg-quill-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                <PlusIcon className="h-4 w-4" /> Add your first server
              </Button>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {servers.map((server) => (
                <div key={server.id} className="rounded-xl border border-quill-border bg-quill-surface overflow-hidden">
                  {/* Server header */}
                  <div className="flex items-center gap-3 p-4">
                    <div className="shrink-0">{STATUS_ICONS[server.status]}</div>
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
                    <div className="flex items-center gap-2 shrink-0">
                      {server.authType === "bearer" && server.oauthAuthorizeUrl && server.oauthTokenUrl && server.oauthClientId && (
                        server.oauthConnectedAt ? (
                          <Button
                            onClick={() => handleOAuthRevoke(server.id)}
                            type="button"
                            variant="outline"
                            disabled={oauthPendingId === server.id}
                            className="h-auto rounded-lg px-2.5 py-1.5 text-xs hover:bg-quill-surface-2 disabled:opacity-50"
                          >
                            {oauthPendingId === server.id ? "Working..." : "Revoke OAuth"}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleOAuthStart(server.id)}
                            type="button"
                            variant="outline"
                            disabled={oauthPendingId === server.id}
                            className="h-auto rounded-lg px-2.5 py-1.5 text-xs hover:bg-quill-surface-2 disabled:opacity-50"
                          >
                            {oauthPendingId === server.id ? "Redirecting..." : "Connect OAuth"}
                          </Button>
                        )
                      )}
                      <Button
                        onClick={() => handleConnect(server.id)}
                        type="button"
                        variant="outline"
                        disabled={connecting === server.id}
                        className="h-auto rounded-lg px-2.5 py-1.5 text-xs hover:bg-quill-surface-2 disabled:opacity-50"
                      >
                        {connecting === server.id ? "Connectingâ€¦" : "Connect"}
                      </Button>
                      {server.toolCount > 0 && (
                        <Button
                          onClick={() => toggleExpand(server.id)}
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg p-0 text-quill-muted hover:bg-quill-surface-2"
                        >
                          {expanded.has(server.id) ? (
                            <ChevronDownIcon className="h-4 w-4" />
                          ) : (
                            <ChevronRightIcon className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        onClick={() => handleDelete(server.id)}
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={deleting === server.id}
                        className="h-7 w-7 rounded-lg p-0 text-quill-muted hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Tools list */}
                  {expanded.has(server.id) && (
                    <div className="border-t border-quill-border bg-quill-bg">
                      {server.tools === undefined ? (
                        <p className="px-4 py-3 text-xs text-quill-muted">Loading toolsâ€¦</p>
                      ) : server.tools.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-quill-muted">No tools discovered</p>
                      ) : (
                        <ul className="divide-y divide-quill-border">
                          {server.tools.map((tool) => (
                            <li key={tool.id} className="flex items-start gap-3 px-4 py-2.5">
                              <WrenchScrewdriverIcon className="h-3.5 w-3.5 text-quill-muted mt-0.5 shrink-0" />
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

