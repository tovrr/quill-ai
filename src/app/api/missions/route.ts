import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { getChatsByUserId } from "@/lib/data/db-helpers";
import { db } from "@/db";
import { externalSessions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { isAgentMissionSessionSource } from "@/lib/missions/source-policy";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessionData = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
  if (!sessionData?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = sessionData.user.id;

  const [chats, external] = await Promise.all([
    getChatsByUserId(userId),
    db.query.externalSessions.findMany({
      where: eq(externalSessions.userId, userId),
      orderBy: [desc(externalSessions.updatedAt)],
    }),
  ]);

  const quillMissions = chats.map((chat) => ({
    id: chat.id,
    title: chat.title,
    source: "quill" as const,
    sourceId: null,
    externalUrl: `/agent?chat=${chat.id}`,
    summary: null,
    createdAt: chat.createdAt?.toISOString() ?? null,
    updatedAt: chat.updatedAt?.toISOString() ?? null,
  }));

  const externalMissions = external.map((s) => ({
    id: s.id,
    title: s.title,
    source: s.source,
    sourceId: s.sourceId,
    externalUrl: s.externalUrl,
    summary: s.summary,
    createdAt: s.createdAt?.toISOString() ?? null,
    updatedAt: s.updatedAt?.toISOString() ?? null,
  })).filter((mission) => isAgentMissionSessionSource(mission.source));

  // Merge and sort newest first
  const missions = [...quillMissions, ...externalMissions].sort((a, b) => {
    const ta = a.updatedAt ?? a.createdAt ?? "";
    const tb = b.updatedAt ?? b.createdAt ?? "";
    return tb.localeCompare(ta);
  });

  return NextResponse.json({ missions, total: missions.length });
}

