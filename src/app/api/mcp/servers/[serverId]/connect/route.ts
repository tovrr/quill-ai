import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { logAuditEvent } from "@/lib/audit-log";
import {
  createApiRequestContext,
  logApiCompletion,
  logApiStart,
  withRequestHeaders,
} from "@/lib/observability";
import {
  getMcpServerById,
  replaceMcpToolsForServer,
  updateMcpServerByUserId,
} from "@/lib/db-helpers";

export const dynamic = "force-dynamic";

// POST /api/mcp/servers/[serverId]/connect
// Fetches the MCP server's tool list using the MCP protocol (GET /tools) and
// persists discovered tools.  Auth tokens are forwarded in the Authorization
// header when configured.  Times out after 10 s to keep the route snappy.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  const context = createApiRequestContext(req, "/api/mcp/servers/[serverId]/connect");
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

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (server.authType === "bearer" && server.authToken) {
      requestHeaders["Authorization"] = `Bearer ${server.authToken}`;
    } else if (server.authType === "basic" && server.authToken) {
      requestHeaders["Authorization"] = `Basic ${Buffer.from(server.authToken).toString("base64")}`;
    }

    let tools: { toolName: string; toolDescription?: string; inputSchema?: unknown }[] = [];
    let status: "connected" | "error" = "error";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const baseUrl = server.url.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/tools`, {
        headers: requestHeaders,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        await updateMcpServerByUserId(serverId, session.user.id, {
          status: "error",
          lastConnectedAt: new Date(),
          toolCount: 0,
        });
        logApiCompletion(context, { status: 502, error: "upstream_status" });
        return withRequestHeaders(NextResponse.json(
          { error: `Server returned ${res.status}`, status: "error" },
          { status: 502 }
        ), context.requestId);
      }

      const data = (await res.json()) as unknown;

      // Normalise two common MCP tool-list shapes:
      // 1. { tools: [...] }
      // 2. [...] (bare array)
      const raw =
        Array.isArray(data)
          ? data
          : (typeof data === "object" && data !== null && Array.isArray((data as Record<string, unknown>).tools))
            ? (data as Record<string, unknown>).tools as unknown[]
            : [];

      tools = raw.map((t) => {
        const item = t as Record<string, unknown>;
        return {
          toolName: String(item.name ?? item.toolName ?? "unnamed"),
          toolDescription: typeof item.description === "string" ? item.description : undefined,
          inputSchema: item.inputSchema ?? item.parameters ?? undefined,
        };
      });

      await replaceMcpToolsForServer(serverId, session.user.id, tools);
      await updateMcpServerByUserId(serverId, session.user.id, {
        status: "connected",
        lastConnectedAt: new Date(),
        toolCount: tools.length,
      });
      status = "connected";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await updateMcpServerByUserId(serverId, session.user.id, {
        status: "error",
        lastConnectedAt: new Date(),
        toolCount: 0,
      });
      logApiCompletion(context, { status: 502, error: msg });
      return withRequestHeaders(NextResponse.json({ error: msg, status: "error" }, { status: 502 }), context.requestId);
    }

    logAuditEvent({
      action: "mcp.server.connected",
      userId: session.user.id,
      requestId: context.requestId,
      targetId: serverId,
      metadata: {
        toolCount: tools.length,
      },
    });

    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(NextResponse.json({ status, tools }), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "mcp_server_connect_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}
