import { NextResponse } from "next/server";
import { MOCK_ACTIVE_SNAPSHOT } from "@/lib/missions/mock-data";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    active: MOCK_ACTIVE_SNAPSHOT,
  });
}
