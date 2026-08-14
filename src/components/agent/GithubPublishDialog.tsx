"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SelectedRepo = {
  repoId: string;
  repoFullName: string;
  defaultBranch: string | null;
};

type Stage = "loading" | "no-connection" | "no-repos" | "form" | "publishing" | "success" | "error";

interface GithubPublishDialogProps {
  open: boolean;
  onClose: () => void;
  files: Record<string, string>;
  defaultTitle: string;
}

/**
 * Publish-to-GitHub dialog (Track C.3 PR 4/4, ROADMAP.md -- final piece).
 *
 * Lets the user pick one of their already-selected repos (Settings ->
 * GitHub App, PR 2/#39) and open the Canvas artifact's files as a PR
 * against it. Always creates a new branch + PR -- there is no "push
 * directly" option in this UI, matching the backend's own hard guarantee
 * (publishFilesAsPullRequest in github-app.ts never touches the default
 * branch ref).
 */
export function GithubPublishDialog({ open, onClose, files, defaultTitle }: GithubPublishDialogProps) {
  const [stage, setStage] = useState<Stage>("loading");
  const [repos, setRepos] = useState<SelectedRepo[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [title, setTitle] = useState(defaultTitle);
  const [error, setError] = useState<string | null>(null);
  const [prUrl, setPrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setStage("loading");
    setError(null);
    setPrUrl(null);
    setTitle(defaultTitle);

    async function load() {
      try {
        const statusRes = await fetch("/api/github/status");
        const statusData = await statusRes.json();
        if (cancelled) return;
        if (!statusData.configured || !statusData.connected) {
          setStage("no-connection");
          return;
        }

        const reposRes = await fetch("/api/github/repos");
        const reposData = await reposRes.json();
        if (cancelled) return;

        const selected = (reposData.repos ?? []).filter((r: { selected: boolean }) => r.selected);
        if (selected.length === 0) {
          setStage("no-repos");
          return;
        }

        setRepos(
          selected.map((r: { id: number; fullName: string; defaultBranch: string }) => ({
            repoId: String(r.id),
            repoFullName: r.fullName,
            defaultBranch: r.defaultBranch,
          })),
        );
        setSelectedRepoId(String(selected[0].id));
        setStage("form");
      } catch {
        if (!cancelled) {
          setError("Failed to load GitHub connection");
          setStage("error");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open, defaultTitle]);

  async function handlePublish() {
    if (!selectedRepoId || !title.trim()) return;
    setStage("publishing");
    setError(null);

    try {
      const res = await fetch("/api/github/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId: selectedRepoId, files, title: title.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `Publish failed (${res.status})`);
      }
      setPrUrl(data.prUrl);
      setStage("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
      setStage("error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Publish to GitHub</DialogTitle>
          <DialogDescription>
            Opens a new branch and pull request in a repo you&apos;ve connected. Quill never pushes directly to a
            default branch.
          </DialogDescription>
        </DialogHeader>

        {stage === "loading" && <p className="text-sm text-quill-muted py-4">Loading GitHub connection…</p>}

        {stage === "no-connection" && (
          <div className="py-4 space-y-3">
            <p className="text-sm text-quill-muted">
              Connect GitHub first from Settings before publishing.
            </p>
            <Button asChild variant="outline" size="sm">
              <a href="/settings">Open Settings</a>
            </Button>
          </div>
        )}

        {stage === "no-repos" && (
          <div className="py-4 space-y-3">
            <p className="text-sm text-quill-muted">
              No repos selected yet. Select at least one repo in Settings before publishing.
            </p>
            <Button asChild variant="outline" size="sm">
              <a href="/settings">Open Settings</a>
            </Button>
          </div>
        )}

        {(stage === "form" || stage === "publishing") && (
          <div className="py-2 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-quill-muted">Repository</label>
              <Select value={selectedRepoId} onValueChange={setSelectedRepoId} disabled={stage === "publishing"}>
                <SelectTrigger className="w-full h-9 rounded-lg border-quill-border bg-quill-surface text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {repos.map((r) => (
                    <SelectItem key={r.repoId} value={r.repoId}>
                      {r.repoFullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-quill-muted">PR title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={stage === "publishing"} />
            </div>
            <p className="text-xs text-quill-muted">
              {Object.keys(files).length} file{Object.keys(files).length === 1 ? "" : "s"} will be committed to a new
              branch.
            </p>
          </div>
        )}

        {stage === "success" && prUrl && (
          <div className="py-4 space-y-3">
            <p className="text-sm text-quill-green">Pull request opened successfully.</p>
            <Button asChild variant="outline" size="sm">
              <a href={prUrl} target="_blank" rel="noopener noreferrer">
                View PR on GitHub
              </a>
            </Button>
          </div>
        )}

        {stage === "error" && <p className="text-sm text-quill-accent-2 py-4">{error ?? "Something went wrong."}</p>}

        <DialogFooter>
          {stage === "form" && (
            <>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handlePublish} disabled={!selectedRepoId || !title.trim()}>
                Publish
              </Button>
            </>
          )}
          {stage === "publishing" && (
            <Button disabled>
              Publishing…
            </Button>
          )}
          {(stage === "success" || stage === "error" || stage === "no-connection" || stage === "no-repos") && (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
