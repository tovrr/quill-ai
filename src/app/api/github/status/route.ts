import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { getGithubConnectionByUserId, deleteGithubConnectionByUserId } from "@/lib/data/db-helpers";
import { logAuditEvent } from "@/lib/data/audit-log";
import { isGithubAppConfigured } from "@/lib/integrations/github-app";

export const dynamic = "force-dynamic";

// GET /api/github/status -- current GitHub App connection state for this user.
export async function GET() {
  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGithubAppConfigured()) {
    return NextResponse.json({ connected: false, configured: false });
  }

  const conn = await getGithubConnectionByUserId(session.user.id);
  if (!conn) {
    return NextResponse.json({ connected: false, configured: true });
  }

  return NextResponse.json({
    connected: true,
    configured: true,
    accountLogin: conn.accountLogin,
    accountType: conn.accountType,
    connectedAt: conn.createdAt,
  });
}

// DELETE /api/github/status -- disconnect this user's GitHub App connection.
//
// Note: this only removes Quill's local record. It does not uninstall the
// GitHub App itself -- the user must do that from github.com/settings/installations
// if they want to fully revoke it (matches how /api/google/docs DELETE behaves
// for the Google connection, which also only clears the local row).
export async function DELETE() {
  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteGithubConnectionByUserId(session.user.id);
  logAuditEvent({ action: "github.connection.deleted", userId: session.user.id });

  return NextResponse.json({ ok: true });
}
