import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { getGithubConnectionByUserId, getGithubRepoSelectionsByUserId } from "@/lib/data/db-helpers";
import { pullRepoFiles } from "@/lib/integrations/github-app";
import { inferBundleTypeFromFiles, inferEntryFromFiles, type FileBundleArtifact } from "@/lib/builder/artifacts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/github/pull -- fetch a selected repo's files and return them as
// a FileBundleArtifact-shaped payload, ready to hand to Canvas.
//
// Track C.3 PR 3/4 (ROADMAP.md). Only repos the user has already selected
// (via /api/github/repos POST, PR 2) can be pulled -- this endpoint doesn't
// accept an arbitrary repoFullName from the client, it looks up the
// selection by repoId so a request can't target a repo outside what's
// already been explicitly picked in Quill's UI.
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { repoId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.repoId) {
    return NextResponse.json({ error: "repoId is required" }, { status: 400 });
  }

  const connection = await getGithubConnectionByUserId(session.user.id);
  if (!connection || !connection.accessToken) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 404 });
  }

  const selections = await getGithubRepoSelectionsByUserId(session.user.id);
  const selection = selections.find((s) => s.repoId === body.repoId);
  if (!selection) {
    return NextResponse.json({ error: "Repo not selected. Select it in Settings first." }, { status: 403 });
  }

  const branch = selection.defaultBranch ?? "main";
  const result = await pullRepoFiles(connection.accessToken, selection.repoFullName, branch);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  if (Object.keys(result.files).length === 0) {
    return NextResponse.json(
      { error: "No text files found in this repo (or all files were too large/binary)." },
      { status: 422 }
    );
  }

  const artifact: FileBundleArtifact = {
    artifactVersion: 1,
    type: inferBundleTypeFromFiles(result.files),
    title: selection.repoFullName,
    metadata: { source: "github-pull", repoFullName: selection.repoFullName, branch },
    payload: {
      files: result.files,
      entry: inferEntryFromFiles(result.files),
    },
  };

  return NextResponse.json({
    artifact,
    skipped: result.skipped,
    truncated: result.truncated,
    fileCount: Object.keys(result.files).length,
  });
}
