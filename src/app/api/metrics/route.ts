import { NextResponse } from "next/server";
import { getApiMetricsSnapshot } from "@/lib/api-metrics";

export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const token = process.env.API_METRICS_TOKEN;
  if (!token) return false;

  const headerToken = req.headers.get("x-metrics-token");
  if (headerToken && headerToken === token) return true;

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7).trim();
    return bearer === token;
  }

  return false;
}

export async function GET(req: Request) {
  if (!process.env.API_METRICS_TOKEN) {
    return NextResponse.json(
      { error: "Metrics endpoint not configured" },
      { status: 503 }
    );
  }

  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(getApiMetricsSnapshot(), { status: 200 });
}
