"use client";

import { useEffect, useState } from "react";
import { CheckIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";

type GithubRepo = {
  id: number;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  selected: boolean;
};

type LoadState = "idle" | "loading" | "ready" | "error";

/**
 * GitHub repo picker (Track C.3 PR 2, ROADMAP.md).
 *
 * Fetches the list of repos the user's GitHub App installation can access
 * (via /api/github/repos) and lets them mark which ones they want surfaced
 * elsewhere in Quill (Canvas publish target picker, pull/clone source --
 * PRs 3 and 4). This component only handles selection bookkeeping; it does
 * not grant repo access itself -- that's controlled entirely by which repos
 * the user picked when installing the GitHub App on github.com.
 */
export function GithubRepoPicker() {
  const [state, setState] = useState<LoadState>("idle");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [connected, setConnected] = useState(false);
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const statusRes = await fetch("/api/github/status");
        const statusData = await statusRes.json();
        if (cancelled) return;

        setConfigured(Boolean(statusData.configured));
        setConnected(Boolean(statusData.connected));

        if (!statusData.configured || !statusData.connected) {
          setState("ready");
          return;
        }

        const reposRes = await fetch("/api/github/repos");
        if (!reposRes.ok) {
          const data = await reposRes.json().catch(() => ({}));
          throw new Error(data.error ?? `Failed to load repos (${reposRes.status})`);
        }
        const reposData = await reposRes.json();
        if (cancelled) return;
        setRepos(reposData.repos ?? []);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load GitHub repos");
        setState("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleRepo(repo: GithubRepo) {
    setPendingId(repo.id);
    try {
      if (repo.selected) {
        const res = await fetch(`/api/github/repos/${repo.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to remove selection");
      } else {
        const res = await fetch("/api/github/repos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repoId: repo.id,
            repoFullName: repo.fullName,
            defaultBranch: repo.defaultBranch,
          }),
        });
        if (!res.ok) throw new Error("Failed to save selection");
      }
      setRepos((prev) => prev.map((r) => (r.id === repo.id ? { ...r, selected: !r.selected } : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update repo selection");
    } finally {
      setPendingId(null);
    }
  }

  if (state === "loading" || state === "idle") {
    return (
      <div className="flex items-center gap-2 text-xs text-quill-muted">
        <ArrowPathIcon className="h-3.5 w-3.5 animate-spin-slow" aria-hidden="true" />
        Loading GitHub connection…
      </div>
    );
  }

  if (configured === false) {
    return <p className="text-xs text-quill-muted">GitHub integration is not configured on this deployment yet.</p>;
  }

  if (!connected) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-xs text-quill-muted">Connect GitHub to publish generated code and pull existing repos.</p>
        <Button asChild variant="outline" size="sm">
          <a href="/api/github/auth">Connect GitHub</a>
        </Button>
      </div>
    );
  }

  if (state === "error") {
    return <p className="text-xs text-quill-accent-2">{error ?? "Failed to load GitHub repos."}</p>;
  }

  if (repos.length === 0) {
    return (
      <p className="text-xs text-quill-muted">
        No repos found for this installation. Manage repo access from GitHub&apos;s installation settings.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {repos.map((repo) => (
        <div
          key={repo.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-quill-border bg-quill-surface px-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{repo.fullName}</p>
            <p className="text-xs text-quill-muted">
              {repo.private ? "Private" : "Public"} · {repo.defaultBranch}
            </p>
          </div>
          <Button
            variant={repo.selected ? "secondary" : "outline"}
            size="sm"
            disabled={pendingId === repo.id}
            onClick={() => toggleRepo(repo)}
          >
            {repo.selected ? (
              <>
                <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Selected
              </>
            ) : (
              "Select"
            )}
          </Button>
        </div>
      ))}
    </div>
  );
}
