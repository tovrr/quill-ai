import { NextRequest, NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth/server";
import { getMcpServerById, updateMcpServerByUserId } from "@/lib/data/db-helpers";
import { buildMcpOAuthAuthorizationUrl, isMcpOAuthConfigured } from "@/lib/extensions/mcp-oauth";
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
  const context = createApiRequestContext(req, "/api/mcp/servers/[serverId]/oauth/start");
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

    const state = crypto.randomUUID();
    const authorizationUrl = buildMcpOAuthAuthorizationUrl(server, state);

    await updateMcpServerByUserId(serverId, session.user.id, {
      oauthState: state,
    });

    logAuditEvent({
      action: "mcp.server.oauth.started",
      userId: session.user.id,
      requestId: context.requestId,
      targetId: serverId,
    });

    const response = NextResponse.redirect(authorizationUrl);
    logApiCompletion(context, { status: 302 });
    return withRequestHeaders(response, context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "mcp_oauth_start_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}
