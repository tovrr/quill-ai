import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { logAuditEvent } from "@/lib/data/audit-log";
import {
  createApiRequestContext,
  logApiCompletion,
  logApiStart,
  withRequestHeaders,
} from "@/lib/observability/logging";
import {
  getMcpServerById,
  getMcpToolsByServerId,
  updateMcpServerByUserId,
  deleteMcpServerByUserId,
} from "@/lib/data/db-helpers";
import { encryptSecret } from "@/lib/auth/secret-box";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  const context = createApiRequestContext(req, "/api/mcp/servers/[serverId]");
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

    const tools = await getMcpToolsByServerId(serverId);
    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(NextResponse.json({ server, tools }), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "mcp_server_get_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  const context = createApiRequestContext(req, "/api/mcp/servers/[serverId]");
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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      logApiCompletion(context, { status: 400, error: "invalid_json" });
      return withRequestHeaders(NextResponse.json({ error: "Invalid JSON" }, { status: 400 }), context.requestId);
    }

    const b = body as Record<string, unknown>;
    const validAuthTypes = ["none", "bearer", "basic"];

    const updates: Parameters<typeof updateMcpServerByUserId>[2] = {};
    if (typeof b.name === "string") updates.name = b.name.trim().slice(0, 80);
    if (typeof b.url === "string") {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(b.url);
      } catch {
        logApiCompletion(context, { status: 400, error: "url_invalid" });
        return withRequestHeaders(NextResponse.json({ error: "url is invalid" }, { status: 400 }), context.requestId);
      }

      if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
        logApiCompletion(context, { status: 400, error: "url_protocol_invalid" });
        return withRequestHeaders(NextResponse.json({ error: "url must be http(s)" }, { status: 400 }), context.requestId);
      }

      updates.url = parsedUrl.toString().slice(0, 500);
    }
    if (typeof b.description === "string") updates.description = b.description.trim().slice(0, 500);
    if (typeof b.authType === "string" && validAuthTypes.includes(b.authType)) {
      updates.authType = b.authType as "none" | "bearer" | "basic";
    }
    if (b.authToken === null) updates.authToken = null;
    else if (typeof b.authToken === "string") updates.authToken = b.authToken.slice(0, 500);

    if (b.oauthProvider === null) updates.oauthProvider = null;
    else if (typeof b.oauthProvider === "string") updates.oauthProvider = b.oauthProvider.trim().slice(0, 80);

    if (b.oauthAuthorizeUrl === null) {
      updates.oauthAuthorizeUrl = null;
    } else if (typeof b.oauthAuthorizeUrl === "string") {
      let u: URL;
      try {
        u = new URL(b.oauthAuthorizeUrl.trim());
      } catch {
        logApiCompletion(context, { status: 400, error: "oauth_authorize_url_invalid" });
        return withRequestHeaders(NextResponse.json({ error: "oauthAuthorizeUrl is invalid" }, { status: 400 }), context.requestId);
      }
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        logApiCompletion(context, { status: 400, error: "oauth_authorize_url_protocol_invalid" });
        return withRequestHeaders(NextResponse.json({ error: "oauthAuthorizeUrl must be http(s)" }, { status: 400 }), context.requestId);
      }
      updates.oauthAuthorizeUrl = u.toString().slice(0, 500);
    }

    if (b.oauthTokenUrl === null) {
      updates.oauthTokenUrl = null;
    } else if (typeof b.oauthTokenUrl === "string") {
      let u: URL;
      try {
        u = new URL(b.oauthTokenUrl.trim());
      } catch {
        logApiCompletion(context, { status: 400, error: "oauth_token_url_invalid" });
        return withRequestHeaders(NextResponse.json({ error: "oauthTokenUrl is invalid" }, { status: 400 }), context.requestId);
      }
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        logApiCompletion(context, { status: 400, error: "oauth_token_url_protocol_invalid" });
        return withRequestHeaders(NextResponse.json({ error: "oauthTokenUrl must be http(s)" }, { status: 400 }), context.requestId);
      }
      updates.oauthTokenUrl = u.toString().slice(0, 500);
    }

    if (b.oauthClientId === null) updates.oauthClientId = null;
    else if (typeof b.oauthClientId === "string") updates.oauthClientId = b.oauthClientId.trim().slice(0, 500);

    if (b.oauthClientSecret === null) updates.oauthClientSecretEnc = null;
    else if (typeof b.oauthClientSecret === "string" && b.oauthClientSecret.trim()) {
      updates.oauthClientSecretEnc = encryptSecret(b.oauthClientSecret.trim().slice(0, 2000));
    }

    if (b.oauthScopes === null) updates.oauthScopes = null;
    else if (typeof b.oauthScopes === "string") updates.oauthScopes = b.oauthScopes.trim().slice(0, 500);

    if (b.oauthRedirectUri === null) {
      updates.oauthRedirectUri = null;
    } else if (typeof b.oauthRedirectUri === "string") {
      let u: URL;
      try {
        u = new URL(b.oauthRedirectUri.trim());
      } catch {
        logApiCompletion(context, { status: 400, error: "oauth_redirect_uri_invalid" });
        return withRequestHeaders(NextResponse.json({ error: "oauthRedirectUri is invalid" }, { status: 400 }), context.requestId);
      }
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        logApiCompletion(context, { status: 400, error: "oauth_redirect_uri_protocol_invalid" });
        return withRequestHeaders(NextResponse.json({ error: "oauthRedirectUri must be http(s)" }, { status: 400 }), context.requestId);
      }
      updates.oauthRedirectUri = u.toString().slice(0, 500);
    }

    const updated = await updateMcpServerByUserId(serverId, session.user.id, updates);
    logAuditEvent({
      action: "mcp.server.updated",
      userId: session.user.id,
      requestId: context.requestId,
      targetId: serverId,
      metadata: {
        updateKeys: Object.keys(updates),
      },
    });

    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(NextResponse.json({ server: updated }), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "mcp_server_patch_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  const context = createApiRequestContext(req, "/api/mcp/servers/[serverId]");
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
    const deleted = await deleteMcpServerByUserId(serverId, session.user.id);
    if (!deleted) {
      logApiCompletion(context, { status: 404, error: "not_found" });
      return withRequestHeaders(NextResponse.json({ error: "Not found" }, { status: 404 }), context.requestId);
    }

    logAuditEvent({
      action: "mcp.server.deleted",
      userId: session.user.id,
      requestId: context.requestId,
      targetId: serverId,
    });

    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(NextResponse.json({ ok: true }), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "mcp_server_delete_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}
