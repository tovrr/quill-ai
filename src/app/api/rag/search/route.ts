/**
 * POST /api/rag/search
 * Semantic search over the user's knowledge base.
 *
 * Body: { query: string, limit?: number }
 * Returns: { results: SearchResult[] }
 */

import { NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth/server";
import { embedText } from "@/lib/rag/embed";
import { searchChunks } from "@/lib/rag/search";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: { query?: string; limit?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { query, limit = 5 } = body;

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const parsedLimit =
    typeof limit === "number" && Number.isFinite(limit)
      ? limit
      : typeof limit === "string" && limit.trim().length > 0 && Number.isFinite(Number(limit))
        ? Number(limit)
        : NaN;

  if (!Number.isFinite(parsedLimit)) {
    return NextResponse.json({ error: "limit must be a valid number" }, { status: 400 });
  }

  const clampedLimit = Math.min(Math.max(1, parsedLimit), 20);

  let embedding: number[];
  try {
    embedding = await embedText(query.trim());
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Embedding failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const results = await searchChunks(embedding, userId, clampedLimit);

  return NextResponse.json({ results });
}
