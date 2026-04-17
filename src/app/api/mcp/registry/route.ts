import { NextRequest, NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth/server";
import { parseBoundedInt } from "@/lib/auth/security";
import { listRegistryEntries, type McpRegistryEntry } from "@/lib/extensions/mcp-registry";
import {
  createApiRequestContext,
  logApiCompletion,
  logApiStart,
  withRequestHeaders,
} from "@/lib/observability/logging";

export const dynamic = "force-dynamic";

const ALLOWED_CATEGORIES: Array<McpRegistryEntry["category"]> = [
  "development",
  "productivity",
  "communication",
  "data",
];

const ALLOWED_TRUST: Array<McpRegistryEntry["trust"]> = ["official", "community"];

export async function GET(req: NextRequest) {
  const context = createApiRequestContext(req, "/api/mcp/registry");

  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session?.user?.id) {
      logApiStart(context);
      logApiCompletion(context, { status: 401, error: "unauthorized" });
      return withRequestHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), context.requestId);
    }

    context.userId = session.user.id;
    logApiStart(context);

    const searchParams = req.nextUrl.searchParams;
    const q = (searchParams.get("q") ?? "").trim().slice(0, 120);
    const offset = parseBoundedInt(searchParams.get("offset"), 0, 0, 10_000);
    const limit = parseBoundedInt(searchParams.get("limit"), 12, 1, 50);

    const categoryParam = (searchParams.get("category") ?? "all").toLowerCase();
    const category = ALLOWED_CATEGORIES.includes(categoryParam as McpRegistryEntry["category"])
      ? (categoryParam as McpRegistryEntry["category"])
      : "all";

    const trustParam = (searchParams.get("trust") ?? "all").toLowerCase();
    const trust = ALLOWED_TRUST.includes(trustParam as McpRegistryEntry["trust"])
      ? (trustParam as McpRegistryEntry["trust"])
      : "all";

    const filtered = listRegistryEntries({ q, category, trust });
    const items = filtered.slice(offset, offset + limit);

    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(
      NextResponse.json(
        {
          items,
          total: filtered.length,
          offset,
          limit,
          hasMore: offset + items.length < filtered.length,
          filters: { q, category, trust },
        },
        { status: 200 },
      ),
      context.requestId,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "mcp_registry_get_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}
