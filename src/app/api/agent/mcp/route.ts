/**
 * Quill MCP Server — streamable HTTP transport (JSON-RPC 2.0)
 *
 * Endpoint: POST /api/agent/mcp
 * Auth:     Authorization: Bearer <api_key>   (generated via /api/user/api-key)
 *
 * Compatible with:
 *   - Hermes Agent  → add to config: mcp_servers: [{name: "quill", url: "https://<host>/api/agent/mcp", auth: "<key>"}]
 *   - OpenClaw      → add MCP server in Settings → MCPs with this URL + Bearer token
 *   - Any MCP client (Claude Desktop, Cursor, etc.)
 *
 * Exposed tools:
 *   list_missions        — list all sessions (Quill chats + external agents)
 *   send_session         — push an agent session into the Mission Inbox
 *   get_mission          — get a single mission by id
 *   new_chat_url         — get the URL to start a new Quill chat
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { chats, externalSessions, userApiKeys } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { createHash } from "crypto";
import { getChatsByUserId } from "@/lib/data/db-helpers";
import type { SessionSource } from "@/db/schema";
import {
  AGENT_MISSION_SOURCES,
  isAgentMissionSessionSource,
  isAgentMissionSource,
} from "@/lib/missions/source-policy";

export const dynamic = "force-dynamic";

// ─── Auth ────────────────────────────────────────────────────────────────────

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

async function resolveUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;

  const hash = hashKey(token);
  const apiKey = await db.query.userApiKeys.findFirst({
    where: eq(userApiKeys.keyHash, hash),
  });
  if (!apiKey) return null;

  // Update lastUsedAt (fire and forget)
  db.update(userApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(userApiKeys.id, apiKey.id))
    .catch(() => {});

  return apiKey.userId;
}

// ─── MCP types (minimal) ─────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

function rpcResult(id: string | number | null, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function rpcError(id: string | number | null, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } });
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "list_missions",
    description:
      "List all sessions in the Quill Mission Inbox — includes Quill chats and agent sessions (Hermes, OpenClaw, and connected agents).",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results to return (default 50)", default: 50 },
        source: {
          type: "string",
          enum: ["quill", "hermes", "openclaw", "agent", "custom"],
          description: "Filter by source (optional)",
        },
      },
    },
  },
  {
    name: "send_session",
    description:
      "Push an agent session into the Quill Mission Inbox. Call this at the end of any significant task or conversation to keep the user informed.",
    inputSchema: {
      type: "object",
      required: ["title", "source"],
      properties: {
        title: { type: "string", description: "Short title for this session (max 255 chars)" },
        source: {
          type: "string",
          enum: ["hermes", "openclaw", "agent", "custom"],
          description: "Origin platform or agent name",
        },
        summary: { type: "string", description: "Brief summary of what was accomplished (max 2000 chars)" },
        sourceId: { type: "string", description: "External ID in the originating system" },
        externalUrl: { type: "string", description: "Deep link back to the source conversation" },
        metadata: { type: "object", description: "Any extra key/value metadata" },
      },
    },
  },
  {
    name: "get_mission",
    description: "Get details for a single mission by its ID.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Mission/session ID" },
      },
    },
  },
  {
    name: "new_chat_url",
    description: "Returns the URL to open a new Quill chat in the browser.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
] as const;

// ─── Tool handlers ────────────────────────────────────────────────────────────

async function handleListMissions(userId: string, params: Record<string, unknown>) {
  const limit = typeof params.limit === "number" ? Math.min(params.limit, 200) : 50;
  const sourceFilter = typeof params.source === "string" ? params.source : null;

  const [quillChats, external] = await Promise.all([
    getChatsByUserId(userId),
    db.query.externalSessions.findMany({
      where: eq(externalSessions.userId, userId),
      orderBy: [desc(externalSessions.updatedAt)],
    }),
  ]);
  const externalAgentMissions = external.filter((s) => isAgentMissionSessionSource(s.source));

  const all = [
    ...quillChats.map((c) => ({
      id: c.id,
      title: c.title,
      source: "quill",
      updatedAt: c.updatedAt?.toISOString() ?? null,
      url: `/agent?chat=${c.id}`,
    })),
    ...externalAgentMissions.map((s) => ({
      id: s.id,
      title: s.title,
      source: s.source,
      summary: s.summary,
      updatedAt: s.updatedAt?.toISOString() ?? null,
      url: s.externalUrl ?? null,
    })),
  ]
    .filter((m) => !sourceFilter || m.source === sourceFilter)
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, limit);

  return { missions: all, total: all.length };
}

async function handleSendSession(userId: string, args: Record<string, unknown>) {
  const { title, source, summary, sourceId, externalUrl, metadata } = args;

  if (typeof title !== "string" || !title.trim()) {
    throw new Error("title is required");
  }

  const ALLOWED_SOURCES: SessionSource[] = [...AGENT_MISSION_SOURCES];
  if (typeof source === "string" && !isAgentMissionSource(source)) {
    throw new Error("source must be one of: hermes, openclaw, agent, custom");
  }

  const resolvedSource: SessionSource =
    typeof source === "string" && ALLOWED_SOURCES.includes(source as SessionSource)
      ? (source as SessionSource)
      : "custom";

  const [session] = await db
    .insert(externalSessions)
    .values({
      userId,
      source: resolvedSource,
      sourceId: typeof sourceId === "string" ? sourceId : null,
      title: title.trim().slice(0, 255),
      summary: typeof summary === "string" ? summary.slice(0, 2000) : null,
      externalUrl: typeof externalUrl === "string" ? externalUrl.slice(0, 2048) : null,
      metadata: metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : null,
    })
    .returning();

  return { id: session.id, source: session.source, title: session.title };
}

async function handleGetMission(userId: string, args: Record<string, unknown>) {
  const { id } = args;
  if (typeof id !== "string") throw new Error("id is required");

  // Try Quill chat first
  const chat = await db.query.chats.findFirst({ where: eq(chats.id, id) });
  if (chat && chat.userId === userId) {
    return {
      id: chat.id,
      title: chat.title,
      source: "quill",
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      url: `/agent?chat=${chat.id}`,
    };
  }

  // Try external session
  const ext = await db.query.externalSessions.findFirst({ where: eq(externalSessions.id, id) });
  if (ext && ext.userId === userId) {
    return {
      id: ext.id,
      title: ext.title,
      source: ext.source,
      summary: ext.summary,
      sourceId: ext.sourceId,
      createdAt: ext.createdAt,
      updatedAt: ext.updatedAt,
      url: ext.externalUrl,
    };
  }

  throw new Error("mission_not_found");
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  // MCP server info endpoint (used by clients to discover capabilities)
  return NextResponse.json({
    name: "quill-mcp",
    version: "1.0.0",
    description: "Quill AI Mission Inbox — MCP server for agent session management",
    transport: "http",
    auth: "bearer",
  });
}

export async function POST(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return rpcError(null, -32001, "Unauthorized — provide Authorization: Bearer <api_key>");
  }

  let body: JsonRpcRequest;
  try {
    body = (await req.json()) as JsonRpcRequest;
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  const { id, method, params = {} } = body;

  try {
    switch (method) {
      case "initialize":
        return rpcResult(id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "quill-mcp", version: "1.0.0" },
        });

      case "tools/list":
        return rpcResult(id, { tools: TOOLS });

      case "tools/call": {
        const toolName = params.name as string;
        const toolArgs = (params.arguments ?? {}) as Record<string, unknown>;

        switch (toolName) {
          case "list_missions":
            return rpcResult(id, {
              content: [{ type: "text", text: JSON.stringify(await handleListMissions(userId, toolArgs), null, 2) }],
            });

          case "send_session":
            return rpcResult(id, {
              content: [{ type: "text", text: JSON.stringify(await handleSendSession(userId, toolArgs), null, 2) }],
            });

          case "get_mission":
            return rpcResult(id, {
              content: [{ type: "text", text: JSON.stringify(await handleGetMission(userId, toolArgs), null, 2) }],
            });

          case "new_chat_url": {
            const host = req.headers.get("host") ?? "localhost:3000";
            const proto = req.headers.get("x-forwarded-proto") ?? "http";
            return rpcResult(id, {
              content: [{ type: "text", text: `${proto}://${host}/agent` }],
            });
          }

          default:
            return rpcError(id, -32601, `Unknown tool: ${toolName}`);
        }
      }

      case "ping":
        return rpcResult(id, {});

      default:
        return rpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "internal_error";
    return rpcError(id, -32603, message);
  }
}
