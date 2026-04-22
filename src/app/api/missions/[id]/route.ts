import { NextRequest, NextResponse } from "next/server";
import { findMissionById } from "@/lib/missions/mock-data";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const mission = findMissionById(params.id);

  if (!mission) {
    return NextResponse.json({ error: "Mission not found" }, { status: 404 });
  }

  return NextResponse.json({
    mission,
    meta: {
      phase: "phase-2-prep",
      notes: [
        "Replace mock store with database-backed queries.",
        "Add run, steps, and approvals subresources.",
      ],
    },
  });
}
