"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUturnLeftIcon,
  Bars3Icon,
  CalendarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  DocumentTextIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Sidebar } from "@/components/layout/Sidebar";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { authClient } from "@/lib/auth/client";

export const dynamic = "force-dynamic";

export default function WorkspacePage() {
  return (
    <Suspense fallback={<div className="flex h-screen bg-quill-bg text-quill-muted items-center justify-center text-sm">Loading…</div>}>
      <WorkspaceContent />
    </Suspense>
  );
}

type Tab = "docs" | "drive" | "calendar";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
  iconLink?: string;
}

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
  location?: string;
}

interface GoogleStatus {
  connected: boolean;
  email?: string;
  displayName?: string;
}

interface Snapshot {
  id: string;
  resourceType: "drive-file" | "google-doc";
  operation: "create" | "update" | "rename" | "move" | "delete";
  resourceId: string;
  createdAt: string;
  beforePayload?: { name?: string; text?: string };
  afterPayload?: { name?: string; text?: string };
}

type ModalState =
  | { type: "new-doc" }
  | { type: "edit-doc"; fileId: string; fileName: string; initialText: string; revisionId?: string }
  | { type: "new-folder" }
  | { type: "rename"; fileId: string; currentName: string }
  | null;

function formatModifiedTime(t: string) {
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatEventTime(event: CalendarEvent) {
  const dt = event.start.dateTime ?? event.start.date;
  if (!dt) return "";
  if (event.start.date && !event.start.dateTime) {
    return new Date(event.start.date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return new Date(dt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function snapshotLabel(s: Snapshot): string {
  const kind = s.resourceType === "google-doc" ? "Doc" : "Folder";
  const name = s.afterPayload?.name ?? s.beforePayload?.name ?? s.resourceId.slice(0, 8);
  switch (s.operation) {
    case "create": return `Created ${kind}: ${name}`;
    case "update": return `Edited ${kind}: ${name}`;
    case "rename": return `Renamed ${kind}: ${s.beforePayload?.name ?? "?"} → ${s.afterPayload?.name ?? "?"}`;
    case "move":   return `Moved ${kind}: ${name}`;
    case "delete": return `Deleted ${kind}: ${name}`;
    default:       return `${s.operation} ${kind}: ${name}`;
  }
}

function WorkspaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [tab, setTab] = useState<Tab>("docs");
  const [docs, setDocs] = useState<DriveFile[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Write / modal state
  const [modal, setModal] = useState<ModalState>(null);
  const [modalTitle, setModalTitle] = useState("");
  const [modalText, setModalText] = useState("");
  const [modalLoading, setModalLoading] = useState(false);

  // Snapshots state
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  useEffect(() => {
    authClient.getSession().then((s) => {
      if (!s?.data?.user) router.push("/login");
    });
  }, [router]);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "1") showToast("Google account connected successfully!");
    if (error) showToast(`Connection failed: ${error.replace(/_/g, " ")}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/google/status");
    if (res.ok) setStatus(await res.json());
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }

  const loadTab = useCallback(async (t: Tab, q = "") => {
    if (!status?.connected) return;
    setLoading(true);
    try {
      let url = "";
      if (t === "docs") url = `/api/google/docs?pageSize=30${q ? `&query=${encodeURIComponent(q)}` : ""}`;
      if (t === "drive") url = `/api/google/drive?pageSize=30${q ? `&query=${encodeURIComponent(q)}` : ""}`;
      if (t === "calendar") url = `/api/google/calendar/events?maxResults=20`;

      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();

      if (t === "docs") setDocs(data.files ?? []);
      if (t === "drive") setDriveFiles(data.files ?? []);
      if (t === "calendar") setEvents(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [status?.connected]);

  useEffect(() => {
    if (status?.connected) loadTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.connected, tab]);

  const loadSnapshots = useCallback(async () => {
    setSnapshotsLoading(true);
    try {
      const res = await fetch("/api/google/workspace/snapshots?limit=20");
      if (res.ok) {
        const data = await res.json();
        setSnapshots(data.snapshots ?? []);
      }
    } finally {
      setSnapshotsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (snapshotsOpen && status?.connected) loadSnapshots();
  }, [snapshotsOpen, status?.connected, loadSnapshots]);

  async function handleDisconnect() {
    if (!confirm("Disconnect your Google account?")) return;
    setDisconnecting(true);
    await fetch("/api/google/docs", { method: "DELETE" });
    setStatus({ connected: false });
    setDisconnecting(false);
    showToast("Google account disconnected");
  }

  // ── Docs write actions ───────────────────────────────────────────────────────

  async function handleCreateDoc() {
    if (!modalTitle.trim()) return;
    setModalLoading(true);
    try {
      const res = await fetch("/api/google/docs/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: modalTitle.trim(), text: modalText || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        showToast(`Failed to create document: ${err.error ?? res.status}`);
        return;
      }
      showToast(`Document "${modalTitle.trim()}" created`);
      setModal(null);
      setModalTitle("");
      setModalText("");
      await loadTab("docs");
      if (snapshotsOpen) await loadSnapshots();
    } finally {
      setModalLoading(false);
    }
  }

  async function handleOpenEditDoc(file: DriveFile) {
    setModalLoading(true);
    setModal({ type: "edit-doc", fileId: file.id, fileName: file.name, initialText: "", revisionId: undefined });
    try {
      const res = await fetch(`/api/google/docs/${file.id}`);
      if (res.ok) {
        const data = await res.json() as { text?: string; revisionId?: string };
        setModal({ type: "edit-doc", fileId: file.id, fileName: file.name, initialText: data.text ?? "", revisionId: data.revisionId });
        setModalText(data.text ?? "");
      } else {
        showToast("Could not load document content");
        setModal(null);
      }
    } finally {
      setModalLoading(false);
    }
  }

  async function handleSaveEditDoc(fileId: string, revisionId?: string) {
    setModalLoading(true);
    try {
      const res = await fetch("/api/google/docs/write", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: fileId, text: modalText, requiredRevisionId: revisionId }),
      });
      if (res.status === 409) {
        const err = await res.json().catch(() => ({})) as { currentRevisionId?: string };
        showToast(`Conflict: document edited elsewhere (revision ${err.currentRevisionId ?? "?"}). Reload to retry.`);
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        showToast(`Failed to save: ${err.error ?? res.status}`);
        return;
      }
      showToast("Document saved");
      setModal(null);
      setModalText("");
      await loadTab("docs");
      if (snapshotsOpen) await loadSnapshots();
    } finally {
      setModalLoading(false);
    }
  }

  async function handleDeleteDoc(file: DriveFile) {
    if (!confirm(`Delete "${file.name}"? This cannot be undone easily.`)) return;
    const res = await fetch(`/api/google/docs/write?documentId=${encodeURIComponent(file.id)}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      showToast(`Failed to delete: ${err.error ?? res.status}`);
      return;
    }
    showToast(`Deleted "${file.name}"`);
    setDocs((prev) => prev.filter((d) => d.id !== file.id));
    if (snapshotsOpen) await loadSnapshots();
  }

  // ── Drive write actions ──────────────────────────────────────────────────────

  async function handleCreateFolder() {
    if (!modalTitle.trim()) return;
    setModalLoading(true);
    try {
      const res = await fetch("/api/google/drive/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modalTitle.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        showToast(`Failed to create folder: ${err.error ?? res.status}`);
        return;
      }
      showToast(`Folder "${modalTitle.trim()}" created`);
      setModal(null);
      setModalTitle("");
      await loadTab("drive");
      if (snapshotsOpen) await loadSnapshots();
    } finally {
      setModalLoading(false);
    }
  }

  async function handleRenameFile(fileId: string, newName: string) {
    if (!newName.trim()) return;
    setModalLoading(true);
    try {
      const res = await fetch("/api/google/drive/write", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, name: newName.trim() }),
      });
      if (res.status === 409) {
        showToast("Conflict: file was modified elsewhere. Refresh and retry.");
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        showToast(`Failed to rename: ${err.error ?? res.status}`);
        return;
      }
      showToast(`Renamed to "${newName.trim()}"`);
      setModal(null);
      setModalTitle("");
      await loadTab("drive");
      if (snapshotsOpen) await loadSnapshots();
    } finally {
      setModalLoading(false);
    }
  }

  async function handleDeleteFile(file: DriveFile) {
    if (!confirm(`Delete "${file.name}"?`)) return;
    const res = await fetch(`/api/google/drive/write?fileId=${encodeURIComponent(file.id)}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      showToast(`Failed to delete: ${err.error ?? res.status}`);
      return;
    }
    showToast(`Deleted "${file.name}"`);
    setDriveFiles((prev) => prev.filter((f) => f.id !== file.id));
    if (snapshotsOpen) await loadSnapshots();
  }

  // ── Rollback ─────────────────────────────────────────────────────────────────

  async function handleRollback(snapshotId: string) {
    if (!confirm("Roll back this change?")) return;
    setRollingBack(snapshotId);
    try {
      const res = await fetch(`/api/google/workspace/snapshots/${snapshotId}/rollback`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        showToast(`Rollback failed: ${err.error ?? res.status}`);
        return;
      }
      showToast("Rollback successful");
      await loadTab(tab);
      await loadSnapshots();
    } finally {
      setRollingBack(null);
    }
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────────

  function openModal(m: ModalState) {
    setModal(m);
    setModalTitle(m?.type === "rename" ? m.currentName : "");
    setModalText(m?.type === "edit-doc" ? m.initialText : "");
  }

  function closeModal() {
    setModal(null);
    setModalTitle("");
    setModalText("");
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "docs", label: "Docs", icon: <DocumentTextIcon className="h-4 w-4" /> },
    { id: "drive", label: "Drive", icon: <FolderIcon className="h-4 w-4" /> },
    { id: "calendar", label: "Calendar", icon: <CalendarIcon className="h-4 w-4" /> },
  ];

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
            <h1 className="text-sm font-semibold truncate">Google Workspace</h1>
            <p className="text-xs text-quill-muted truncate">Docs, Drive, and Calendar</p>
          </div>
          <AccountMenu />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {status === null ? (
            <div className="p-8 text-center text-quill-muted text-sm">Loading…</div>
          ) : !status.connected ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 px-6 py-12 text-center max-w-md mx-auto">
              <div className="rounded-full bg-quill-surface border border-quill-border p-5">
                <svg viewBox="0 0 48 48" className="h-10 w-10" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.2 33.6 29.7 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 6 1.1 8.2 3l6-6C34.3 5.1 29.4 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.8 0 20-7.8 20-21 0-1.4-.1-2.7-.5-4z"/>
                  <path fill="#EA4335" d="M6.3 14.7l7 5.1C15 15.2 19.1 12 24 12c3.1 0 6 1.1 8.2 3l6-6C34.3 5.1 29.4 3 24 3 16.3 3 9.7 7.8 6.3 14.7z"/>
                  <path fill="#FBBC05" d="M24 45c5.3 0 10.1-1.8 13.8-4.9l-6.4-5.3C29.5 36.7 26.9 37.5 24 37.5c-5.6 0-10.4-3.8-12-9l-7 5.4C8.5 41 15.7 45 24 45z"/>
                  <path fill="#34A853" d="M44.5 20H24v8.5h11.8c-1.1 3-3.4 5.5-6.3 7.1l6.4 5.3C40.5 37 44.5 31 44.5 24c0-1.4-.1-2.7-.5-4z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold">Connect Google Workspace</h2>
                <p className="text-sm text-quill-muted mt-2">
                  Give Quill access to your Google Docs, Drive files, and Calendar events.
                  Your data is only used to answer your questions.
                </p>
              </div>
              <a
                href="/api/google/auth"
                className="inline-flex items-center gap-2 rounded-lg bg-quill-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
              >
                Connect Google Account
              </a>
              <p className="text-xs text-quill-muted">You can disconnect at any time from this page.</p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Account bar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-quill-border bg-quill-surface">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-quill-green" />
                  <span className="text-sm">{status.displayName ?? status.email}</span>
                  {status.email && status.displayName && (
                    <span className="text-xs text-quill-muted">({status.email})</span>
                  )}
                </div>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-1 text-xs text-quill-muted hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                  {disconnecting ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>

              {/* Tabs + action button */}
              <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-quill-border">
                <div className="flex gap-1 flex-1">
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-lg transition-colors ${
                        tab === t.id
                          ? "border-b-2 border-quill-accent text-quill-text font-medium"
                          : "text-quill-muted hover:text-quill-text"
                      }`}
                    >
                      {t.icon}
                      {t.label}
                    </button>
                  ))}
                </div>
                {tab === "docs" && (
                  <button
                    onClick={() => openModal({ type: "new-doc" })}
                    className="mb-1 flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium bg-quill-accent text-white hover:opacity-90 transition-opacity"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    New Doc
                  </button>
                )}
                {tab === "drive" && (
                  <button
                    onClick={() => openModal({ type: "new-folder" })}
                    className="mb-1 flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium bg-quill-accent text-white hover:opacity-90 transition-opacity"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    New Folder
                  </button>
                )}
              </div>

              {/* Search (docs + drive only) */}
              {(tab === "docs" || tab === "drive") && (
                <div className="px-4 pt-3 pb-2">
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-quill-muted" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") loadTab(tab, query); }}
                      className="w-full rounded-lg border border-quill-border bg-quill-bg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-quill-accent"
                      placeholder={`Search ${tab === "docs" ? "documents" : "files"}…`}
                    />
                  </div>
                </div>
              )}

              {/* File list */}
              <div className="flex-1 overflow-y-auto px-4 py-2">
                {loading ? (
                  <p className="text-sm text-quill-muted py-4">Loading…</p>
                ) : tab === "calendar" ? (
                  events.length === 0 ? (
                    <p className="text-sm text-quill-muted py-4">No upcoming events</p>
                  ) : (
                    <ul className="space-y-2">
                      {events.map((ev) => (
                        <li key={ev.id} className="flex items-start gap-3 rounded-lg border border-quill-border p-3 hover:bg-quill-surface transition-colors">
                          <CalendarIcon className="h-4 w-4 text-quill-muted mt-0.5 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{ev.summary}</p>
                            <p className="text-xs text-quill-muted mt-0.5">{formatEventTime(ev)}</p>
                            {ev.location && <p className="text-xs text-quill-muted truncate">{ev.location}</p>}
                          </div>
                          {ev.htmlLink && (
                            <a href={ev.htmlLink} target="_blank" rel="noopener noreferrer" className="text-quill-muted hover:text-quill-text flex-shrink-0">
                              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )
                ) : tab === "docs" ? (
                  docs.length === 0 ? (
                    <p className="text-sm text-quill-muted py-4">No documents found</p>
                  ) : (
                    <ul className="space-y-1">
                      {docs.map((f) => (
                        <li key={f.id} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-quill-surface transition-colors">
                          <DocumentTextIcon className="h-4 w-4 text-quill-muted flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">{f.name}</p>
                            <p className="text-xs text-quill-muted">{formatModifiedTime(f.modifiedTime)}</p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              title="Edit content"
                              onClick={() => handleOpenEditDoc(f)}
                              className="rounded p-1 hover:bg-quill-border text-quill-muted hover:text-quill-text"
                            >
                              <PencilIcon className="h-3.5 w-3.5" />
                            </button>
                            <button
                              title="Delete document"
                              onClick={() => handleDeleteDoc(f)}
                              className="rounded p-1 hover:bg-quill-border text-quill-muted hover:text-red-400"
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                            </button>
                            {f.webViewLink && (
                              <a
                                href={f.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded p-1 hover:bg-quill-border text-quill-muted hover:text-quill-text"
                              >
                                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )
                ) : driveFiles.length === 0 ? (
                  <p className="text-sm text-quill-muted py-4">No files found</p>
                ) : (
                  <ul className="space-y-1">
                    {driveFiles.map((f) => (
                      <li key={f.id} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-quill-surface transition-colors">
                        {f.iconLink ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={f.iconLink} alt="" className="h-4 w-4 flex-shrink-0" />
                        ) : (
                          <FolderIcon className="h-4 w-4 text-quill-muted flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm truncate">{f.name}</p>
                          <p className="text-xs text-quill-muted">{formatModifiedTime(f.modifiedTime)}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            title="Rename"
                            onClick={() => openModal({ type: "rename", fileId: f.id, currentName: f.name })}
                            className="rounded p-1 hover:bg-quill-border text-quill-muted hover:text-quill-text"
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            title="Delete"
                            onClick={() => handleDeleteFile(f)}
                            className="rounded p-1 hover:bg-quill-border text-quill-muted hover:text-red-400"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                          {f.webViewLink && (
                            <a
                              href={f.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded p-1 hover:bg-quill-border text-quill-muted hover:text-quill-text"
                            >
                              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Recent Changes / Snapshots panel */}
              <div className="border-t border-quill-border">
                <button
                  onClick={() => setSnapshotsOpen((o) => !o)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-xs text-quill-muted hover:text-quill-text transition-colors"
                >
                  {snapshotsOpen ? (
                    <ChevronDownIcon className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRightIcon className="h-3.5 w-3.5" />
                  )}
                  <ClockIcon className="h-3.5 w-3.5" />
                  Recent Changes
                </button>
                {snapshotsOpen && (
                  <div className="px-4 pb-3 max-h-48 overflow-y-auto">
                    {snapshotsLoading ? (
                      <p className="text-xs text-quill-muted py-2">Loading…</p>
                    ) : snapshots.length === 0 ? (
                      <p className="text-xs text-quill-muted py-2">No recent changes</p>
                    ) : (
                      <ul className="space-y-1">
                        {snapshots.map((s) => (
                          <li key={s.id} className="flex items-center gap-2 text-xs py-1">
                            <span className="flex-1 text-quill-muted truncate">{snapshotLabel(s)}</span>
                            <span className="text-quill-muted flex-shrink-0">
                              {new Date(s.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <button
                              onClick={() => handleRollback(s.id)}
                              disabled={rollingBack === s.id}
                              title="Rollback this change"
                              className="flex items-center gap-0.5 rounded px-1.5 py-0.5 bg-quill-surface hover:bg-quill-border text-quill-muted hover:text-quill-text transition-colors disabled:opacity-50 flex-shrink-0"
                            >
                              <ArrowUturnLeftIcon className="h-3 w-3" />
                              {rollingBack === s.id ? "…" : "Undo"}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={closeModal}>
          <div
            className="w-full max-w-md rounded-xl border border-quill-border bg-quill-bg p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {modal.type === "new-doc" && (
              <>
                <h2 className="text-sm font-semibold mb-4">New Document</h2>
                <label className="block text-xs text-quill-muted mb-1">Title</label>
                <input
                  autoFocus
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleCreateDoc(); }}
                  className="w-full rounded-lg border border-quill-border bg-quill-surface px-3 py-2 text-sm focus:outline-none focus:border-quill-accent mb-3"
                  placeholder="Document title"
                />
                <label className="block text-xs text-quill-muted mb-1">Initial content (optional)</label>
                <textarea
                  value={modalText}
                  onChange={(e) => setModalText(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-quill-border bg-quill-surface px-3 py-2 text-sm focus:outline-none focus:border-quill-accent resize-none"
                  placeholder="Start writing…"
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={closeModal} className="rounded-lg px-4 py-2 text-sm text-quill-muted hover:text-quill-text">Cancel</button>
                  <button
                    onClick={handleCreateDoc}
                    disabled={modalLoading || !modalTitle.trim()}
                    className="rounded-lg px-4 py-2 text-sm font-medium bg-quill-accent text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {modalLoading ? "Creating…" : "Create"}
                  </button>
                </div>
              </>
            )}

            {modal.type === "edit-doc" && (
              <>
                <h2 className="text-sm font-semibold mb-1">Edit Document</h2>
                <p className="text-xs text-quill-muted mb-4 truncate">{modal.fileName}</p>
                {modalLoading && !modalText ? (
                  <p className="text-sm text-quill-muted py-6 text-center">Loading content…</p>
                ) : (
                  <textarea
                    autoFocus
                    value={modalText}
                    onChange={(e) => setModalText(e.target.value)}
                    rows={10}
                    className="w-full rounded-lg border border-quill-border bg-quill-surface px-3 py-2 text-sm focus:outline-none focus:border-quill-accent resize-none font-mono"
                    placeholder="Document content…"
                  />
                )}
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={closeModal} className="rounded-lg px-4 py-2 text-sm text-quill-muted hover:text-quill-text">Cancel</button>
                  <button
                    onClick={() => handleSaveEditDoc(modal.fileId, modal.revisionId)}
                    disabled={modalLoading}
                    className="rounded-lg px-4 py-2 text-sm font-medium bg-quill-accent text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {modalLoading ? "Saving…" : "Save"}
                  </button>
                </div>
              </>
            )}

            {modal.type === "new-folder" && (
              <>
                <h2 className="text-sm font-semibold mb-4">New Folder</h2>
                <label className="block text-xs text-quill-muted mb-1">Folder name</label>
                <input
                  autoFocus
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); }}
                  className="w-full rounded-lg border border-quill-border bg-quill-surface px-3 py-2 text-sm focus:outline-none focus:border-quill-accent"
                  placeholder="Folder name"
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={closeModal} className="rounded-lg px-4 py-2 text-sm text-quill-muted hover:text-quill-text">Cancel</button>
                  <button
                    onClick={handleCreateFolder}
                    disabled={modalLoading || !modalTitle.trim()}
                    className="rounded-lg px-4 py-2 text-sm font-medium bg-quill-accent text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {modalLoading ? "Creating…" : "Create"}
                  </button>
                </div>
              </>
            )}

            {modal.type === "rename" && (
              <>
                <h2 className="text-sm font-semibold mb-4">Rename</h2>
                <label className="block text-xs text-quill-muted mb-1">New name</label>
                <input
                  autoFocus
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleRenameFile(modal.fileId, modalTitle); }}
                  className="w-full rounded-lg border border-quill-border bg-quill-surface px-3 py-2 text-sm focus:outline-none focus:border-quill-accent"
                  placeholder="New name"
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={closeModal} className="rounded-lg px-4 py-2 text-sm text-quill-muted hover:text-quill-text">Cancel</button>
                  <button
                    onClick={() => handleRenameFile(modal.fileId, modalTitle)}
                    disabled={modalLoading || !modalTitle.trim()}
                    className="rounded-lg px-4 py-2 text-sm font-medium bg-quill-accent text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {modalLoading ? "Renaming…" : "Rename"}
                  </button>
                </div>
              </>
            )}
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
