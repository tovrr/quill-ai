import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { removeGithubRepoSelection } from "@/lib/data/db-helpers";

export const dynamic = "force-dynamic";

// DELETE /api/github/repos/[repoId] -- un-select a repo (local bookkeeping
// only, does not affect the GitHub App installation itself).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ repoId: string }> }) {
  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { repoId } = await params;
  if (!repoId) {
    return NextResponse.json({ error: "repoId is required" }, { status: 400 });
  }

  await removeGithubRepoSelection(session.user.id, repoId);
  return NextResponse.json({ ok: true });
}
