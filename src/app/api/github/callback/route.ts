import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { logAuditEvent } from "@/lib/data/audit-log";
import { createApiRequestContext, logApiCompletion, logApiStart, withRequestHeaders } from "@/lib/observability/logging";
import { isGithubAppConfigured, fetchInstallationAccessToken } from "@/lib/integrations/github-app";
import { upsertGithubConnection } from "@/lib/data/db-helpers";

export const dynamic = "force-dynamic";

// GET /api/github/callback -- GitHub redirects here after the user installs
// (or is redirected back from) the GitHub App, with `installation_id`,
// `setup_action`, and our `state` param.
//
// Safe skeleton (Track C.3, ROADMAP.md): with no GitHub App configured this
// always 302s to an error page before touching the network. Once a real App
// is registered, this exchanges the installation ID for an access token
// (see fetchInstallationAccessToken in github-app.ts) and stores it
// encrypted via upsertGithubConnection.
export async function GET(req: NextRequest) {
  const context = createApiRequestContext(req, "/api/github/callback");
  const url = new URL(req.url);
  const installationId = url.searchParams.get("installation_id");
  const setupAction = url.searchParams.get("setup_action");
  const state = url.searchParams.get("state");

  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session?.user?.id) {
    logApiStart(context);
    logApiCompletion(context, { status: 401, error: "unauthorized" });
    return withRequestHeaders(NextResponse.redirect(new URL("/workspace?error=github_unauthorized", req.url)), context.requestId);
  }

  context.userId = session.user.id;
  logApiStart(context);

  if (!isGithubAppConfigured()) {
    logApiCompletion(context, { status: 302, error: "github_app_not_configured" });
    return withRequestHeaders(NextResponse.redirect(new URL("/workspace?error=github_misconfigured", req.url)), context.requestId);
  }

  const cookieState = req.cookies.get("quill_github_oauth_state")?.value;
  if (!state || !cookieState || state !== cookieState) {
    logApiCompletion(context, { status: 400, error: "oauth_state_mismatch" });
    return withRequestHeaders(NextResponse.redirect(new URL("/workspace?error=github_state", req.url)), context.requestId);
  }

  if (setupAction === "request") {
    // User requested installation on an org where they aren't an admin --
    // GitHub queues it for org-admin approval; there's no installation_id yet.
    logApiCompletion(context, { status: 302, error: "github_install_pending" });
    return withRequestHeaders(NextResponse.redirect(new URL("/workspace?github=pending", req.url)), context.requestId);
  }

  if (!installationId) {
    logApiCompletion(context, { status: 302, error: "github_invalid" });
    return withRequestHeaders(NextResponse.redirect(new URL("/workspace?error=github_invalid", req.url)), context.requestId);
  }

  try {
    const tokenResult = await fetchInstallationAccessToken(installationId);
    if (!tokenResult.ok) {
      logApiCompletion(context, { status: 302, error: tokenResult.error });
      return withRequestHeaders(NextResponse.redirect(new URL("/workspace?error=github_token_failed", req.url)), context.requestId);
    }

    // GitHub's installation access-token response doesn't include account
    // login/type directly -- a real implementation fetches
    // GET /app/installations/{id} for that metadata. Left as a follow-up:
    // this callback is unreachable today (isGithubAppConfigured() gates
    // above), so there's no live installation to fetch metadata for yet.
    await upsertGithubConnection({
      userId: session.user.id,
      installationId,
      accountLogin: "unknown",
      accountType: "User",
      accessToken: tokenResult.token,
      accessTokenExpiresAt: tokenResult.expiresAt,
    });

    logAuditEvent({
      action: "github.connection.created",
      userId: session.user.id,
      requestId: context.requestId,
      metadata: { installationId },
    });

    const response = NextResponse.redirect(new URL("/workspace?connected=github", req.url));
    response.cookies.delete("quill_github_oauth_state");
    logApiCompletion(context, { status: 302 });
    return withRequestHeaders(response, context.requestId);
  } catch {
    logApiCompletion(context, { status: 302, error: "github_unknown" });
    return withRequestHeaders(NextResponse.redirect(new URL("/workspace?error=github_unknown", req.url)), context.requestId);
  }
}
