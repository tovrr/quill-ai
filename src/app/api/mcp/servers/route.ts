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
import { getMcpServersByUserId, createMcpServer } from "@/lib/db-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const context = createApiRequestContext(req, "/api/mcp/servers");
  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session?.user?.id) {
      logApiStart(context);
      logApiCompletion(context, { status: 401, error: "unauthorized" });
      return withRequestHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), context.requestId);
    }

    context.userId = session.user.id;
    logApiStart(context);

    const servers = await getMcpServersByUserId(session.user.id);
    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(NextResponse.json({ servers }), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "mcp_servers_get_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}

export async function POST(req: NextRequest) {
  const context = createApiRequestContext(req, "/api/mcp/servers");
  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session?.user?.id) {
      logApiStart(context);
      logApiCompletion(context, { status: 401, error: "unauthorized" });
      return withRequestHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), context.requestId);
    }

    context.userId = session.user.id;
    logApiStart(context);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      logApiCompletion(context, { status: 400, error: "invalid_json" });
      return withRequestHeaders(NextResponse.json({ error: "Invalid JSON" }, { status: 400 }), context.requestId);
    }

    const b = body as Record<string, unknown>;
    if (typeof b.name !== "string" || !b.name.trim()) {
      logApiCompletion(context, { status: 400, error: "name_required" });
      return withRequestHeaders(NextResponse.json({ error: "name is required" }, { status: 400 }), context.requestId);
    }
    if (typeof b.url !== "string" || !b.url.trim()) {
      logApiCompletion(context, { status: 400, error: "url_required" });
      return withRequestHeaders(NextResponse.json({ error: "url is required" }, { status: 400 }), context.requestId);
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(String(b.url));
    } catch {
      logApiCompletion(context, { status: 400, error: "url_invalid" });
      return withRequestHeaders(NextResponse.json({ error: "url is invalid" }, { status: 400 }), context.requestId);
    }

    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      logApiCompletion(context, { status: 400, error: "url_protocol_invalid" });
      return withRequestHeaders(NextResponse.json({ error: "url must be http(s)" }, { status: 400 }), context.requestId);
    }

    const validAuthTypes = ["none", "bearer", "basic"];
    const authType = (typeof b.authType === "string" && validAuthTypes.includes(b.authType)
      ? b.authType
      : "none") as "none" | "bearer" | "basic";

    const server = await createMcpServer({
      userId: session.user.id,
      name: String(b.name).trim().slice(0, 80),
      url: parsedUrl.toString().slice(0, 500),
      description: typeof b.description === "string" ? b.description.trim().slice(0, 500) : undefined,
      authType,
      authToken: typeof b.authToken === "string" ? b.authToken.slice(0, 500) : undefined,
    });

    logAuditEvent({
      action: "mcp.server.created",
      userId: session.user.id,
      requestId: context.requestId,
      targetId: server.id,
      metadata: {
        authType: server.authType,
      },
    });

    logApiCompletion(context, { status: 201 });
    return withRequestHeaders(NextResponse.json({ server }, { status: 201 }), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "mcp_server_create_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}
