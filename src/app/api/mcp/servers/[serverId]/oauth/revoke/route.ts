import { NextRequest, NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth/server";
import { getMcpServerById, updateMcpServerByUserId } from "@/lib/data/db-helpers";
import { logAuditEvent } from "@/lib/data/audit-log";
import {
  createApiRequestContext,
  logApiCompletion,
  logApiStart,
  withRequestHeaders,
} from "@/lib/observability/logging";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  const context = createApiRequestContext(req, "/api/mcp/servers/[serverId]/oauth/revoke");
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

    await updateMcpServerByUserId(serverId, session.user.id, {
      oauthAccessTokenEnc: null,
      oauthRefreshTokenEnc: null,
      oauthAccessTokenExpiresAt: null,
      oauthConnectedAt: null,
      oauthState: null,
      status: "disconnected",
    });

    logAuditEvent({
      action: "mcp.server.oauth.revoked",
      userId: session.user.id,
      requestId: context.requestId,
      targetId: serverId,
    });

    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(NextResponse.json({ ok: true }), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "mcp_oauth_revoke_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}
