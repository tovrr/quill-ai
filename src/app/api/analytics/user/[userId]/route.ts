import { NextRequest, NextResponse } from "next/server";
import { persistentMetricsService } from "@/lib/observability/persistent-metrics";

export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "30");

  try {
    const analytics = await persistentMetricsService.getUserAnalytics(userId, days);

    if (!analytics) {
      return NextResponse.json({ error: "User analytics not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: analytics,
      message: `User analytics for ${userId} over last ${days} days`,
    });
  } catch (error) {
    console.error("User analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch user analytics" }, { status: 500 });
  }
}
