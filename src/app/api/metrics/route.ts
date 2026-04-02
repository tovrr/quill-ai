import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getApiMetricsSnapshot } from "@/lib/api-metrics";

export const dynamic = "force-dynamic";

function safeEquals(candidate: string, expected: string): boolean {
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isAuthorized(req: Request): boolean {
  const token = process.env.API_METRICS_TOKEN;
  if (!token) return false;

  const headerToken = req.headers.get("x-metrics-token");
  if (headerToken && safeEquals(headerToken, token)) return true;

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7).trim();
    return safeEquals(bearer, token);
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
