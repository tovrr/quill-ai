import { NextRequest, NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth/server";
import { getMcpServerById, updateMcpServerByUserId } from "@/lib/data/db-helpers";
import { exchangeMcpOAuthCode, isMcpOAuthConfigured } from "@/lib/extensions/mcp-oauth";
import { logAuditEvent } from "@/lib/data/audit-log";
import {
  createApiRequestContext,
  logApiCompletion,
  logApiStart,
  withRequestHeaders,
} from "@/lib/observability/logging";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  const context = createApiRequestContext(req, "/api/mcp/servers/[serverId]/oauth/callback");
  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session?.user?.id) {
      logApiStart(context);
      logApiCompletion(context, { status: 401, error: "unauthorized" });
      return withRequestHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), context.requestId);
    }

    context.userId = session.user.id;
    logApiStart(context);

    const { serverId } = await params;
    const server = await getMcpServerById(serverId);
    if (!server || server.userId !== session.user.id) {
      logApiCompletion(context, { status: 404, error: "not_found" });
      return withRequestHeaders(NextResponse.json({ error: "Not found" }, { status: 404 }), context.requestId);
    }

    if (!isMcpOAuthConfigured(server)) {
      logApiCompletion(context, { status: 400, error: "oauth_not_configured" });
      return withRequestHeaders(
        NextResponse.json({ error: "OAuth is not configured for this server" }, { status: 400 }),
        context.requestId
      );
    }

    const error = req.nextUrl.searchParams.get("error");
    if (error) {
      await updateMcpServerByUserId(serverId, session.user.id, {
        oauthState: null,
        status: "error",
      });
      logApiCompletion(context, { status: 302, error: `oauth_error_${error}` });
      const failUrl = new URL("/mcp?oauth=error", req.nextUrl.origin);
      return withRequestHeaders(NextResponse.redirect(failUrl), context.requestId);
    }

    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    if (!code || !state || !server.oauthState || state !== server.oauthState) {
      logApiCompletion(context, { status: 400, error: "oauth_state_invalid" });
      return withRequestHeaders(NextResponse.json({ error: "Invalid OAuth callback state" }, { status: 400 }), context.requestId);
    }

    const tokenSet = await exchangeMcpOAuthCode({
      config: server,
      code,
    });

    await updateMcpServerByUserId(serverId, session.user.id, {
      oauthAccessTokenEnc: tokenSet.accessTokenEnc,
      oauthRefreshTokenEnc: tokenSet.refreshTokenEnc,
      oauthAccessTokenExpiresAt: tokenSet.expiresAt,
      oauthConnectedAt: new Date(),
      oauthState: null,
      status: "connected",
    });

    logAuditEvent({
      action: "mcp.server.oauth.connected",
      userId: session.user.id,
      requestId: context.requestId,
      targetId: serverId,
    });

    logApiCompletion(context, { status: 302 });
    const successUrl = new URL("/mcp?oauth=connected", req.nextUrl.origin);
    return withRequestHeaders(NextResponse.redirect(successUrl), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "mcp_oauth_callback_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}
