/**
 * POST /api/missions/ingest
 *
 * Ingest endpoint for external AGENT sessions.
 * Mission Inbox is intentionally agent-focused.
 *
 * Auth: Bearer <api_key>  (generated via POST /api/user/api-key)
 *
 * Body:
 * {
 *   source: "hermes" | "openclaw" | "agent" | "custom",
 *   title: string,
 *   summary?: string,
 *   sourceId?: string,
 *   externalUrl?: string,
 *   metadata?: object,
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { externalSessions, userApiKeys } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";
import type { SessionSource } from "@/db/schema";
import { AGENT_MISSION_SOURCES, isAgentMissionSource } from "@/lib/missions/source-policy";

export const dynamic = "force-dynamic";

const ALLOWED_SOURCES: SessionSource[] = [...AGENT_MISSION_SOURCES];

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
  }

  const hash = hashKey(token);
  const apiKey = await db.query.userApiKeys.findFirst({
    where: eq(userApiKeys.keyHash, hash),
  });

  if (!apiKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  db.update(userApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(userApiKeys.id, apiKey.id))
    .catch(() => {});

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { source, title, summary, sourceId, externalUrl, metadata } = body;

  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 422 });
  }

  if (typeof source === "string" && !isAgentMissionSource(source)) {
    return NextResponse.json(
      { error: "source must be one of: hermes, openclaw, agent, custom" },
      { status: 422 }
    );
  }

  const resolvedSource: SessionSource =
    typeof source === "string" && ALLOWED_SOURCES.includes(source as SessionSource)
      ? (source as SessionSource)
      : "custom";

  const [session] = await db
    .insert(externalSessions)
    .values({
      userId: apiKey.userId,
      source: resolvedSource,
      sourceId: typeof sourceId === "string" ? sourceId : null,
      title: title.trim().slice(0, 255),
      summary: typeof summary === "string" ? summary.slice(0, 2000) : null,
      externalUrl: typeof externalUrl === "string" ? externalUrl.slice(0, 2048) : null,
      metadata: metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : null,
    })
    .returning();

  return NextResponse.json({ id: session.id, source: session.source }, { status: 201 });
}
