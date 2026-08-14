import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { getGithubConnectionByUserId, getGithubRepoSelectionsByUserId, addGithubRepoSelection } from "@/lib/data/db-helpers";
import { fetchInstallationRepos } from "@/lib/integrations/github-app";

export const dynamic = "force-dynamic";

// GET /api/github/repos -- list repos the user's GitHub App installation can
// access, merged with which ones are already selected in Quill.
export async function GET() {
  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await getGithubConnectionByUserId(session.user.id);
  if (!connection || !connection.accessToken) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 404 });
  }

  const result = await fetchInstallationRepos(connection.accessToken);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const selections = await getGithubRepoSelectionsByUserId(session.user.id);
  const selectedIds = new Set(selections.map((s) => s.repoId));

  return NextResponse.json({
    repos: result.repos.map((r) => ({
      ...r,
      selected: selectedIds.has(String(r.id)),
    })),
  });
}

// POST /api/github/repos -- mark a repo as selected for use in Quill.
//
// Note: this is a local bookkeeping operation only. The GitHub App
// installation itself already scopes which repos Quill *can* access (the
// user chose those during installation on github.com) -- this endpoint just
// records which of those the user wants surfaced in Quill's UI. It cannot
// grant access to a repo the installation doesn't already cover.
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { repoId?: number; repoFullName?: string; defaultBranch?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.repoId || !body.repoFullName) {
    return NextResponse.json({ error: "repoId and repoFullName are required" }, { status: 400 });
  }

  // Verify the repo is actually in this user's installation before
  // recording the selection -- prevents a user from marking an arbitrary
  // repoId as "selected" that their installation doesn't cover.
  const connection = await getGithubConnectionByUserId(session.user.id);
  if (!connection || !connection.accessToken) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 404 });
  }

  const reposResult = await fetchInstallationRepos(connection.accessToken);
  if (!reposResult.ok) {
    return NextResponse.json({ error: reposResult.error }, { status: 502 });
  }

  const matchingRepo = reposResult.repos.find((r) => r.id === body.repoId);
  if (!matchingRepo) {
    return NextResponse.json({ error: "Repo not accessible to this installation" }, { status: 403 });
  }

  const row = await addGithubRepoSelection({
    userId: session.user.id,
    repoId: String(matchingRepo.id),
    repoFullName: matchingRepo.fullName,
    defaultBranch: matchingRepo.defaultBranch,
  });

  return NextResponse.json({ ok: true, selection: row });
}
