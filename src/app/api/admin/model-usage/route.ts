import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getRecentModelUsageEvents } from "@/lib/model-usage";

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
    return safeEquals(authHeader.slice(7).trim(), token);
  }

  return false;
}

export async function GET(req: Request) {
  if (!process.env.API_METRICS_TOKEN) {
    return NextResponse.json({ error: "Admin usage endpoint not configured" }, { status: 503 });
  }

  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? "200")));
  let events;
  try {
    events = await getRecentModelUsageEvents(limit);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Model usage telemetry is not available yet.",
        details: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 503 }
    );
  }

  const totals = {
    eventCount: events.length,
    estimatedCostUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    imageCount: 0,
  };

  const byModel = new Map<string, {
    provider: string;
    model: string;
    calls: number;
    estimatedCostUsd: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    imageCount: number;
  }>();

  for (const event of events) {
    totals.estimatedCostUsd += event.estimatedCostUsd ?? 0;
    totals.inputTokens += event.inputTokens ?? 0;
    totals.outputTokens += event.outputTokens ?? 0;
    totals.totalTokens += event.totalTokens ?? 0;
    totals.imageCount += event.imageCount ?? 0;

    const key = `${event.provider}:${event.model}`;
    const current = byModel.get(key) ?? {
      provider: event.provider,
      model: event.model,
      calls: 0,
      estimatedCostUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      imageCount: 0,
    };

    current.calls += 1;
    current.estimatedCostUsd += event.estimatedCostUsd ?? 0;
    current.inputTokens += event.inputTokens ?? 0;
    current.outputTokens += event.outputTokens ?? 0;
    current.totalTokens += event.totalTokens ?? 0;
    current.imageCount += event.imageCount ?? 0;
    byModel.set(key, current);
  }

  return NextResponse.json(
    {
      totals,
      byModel: Array.from(byModel.values()).sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd),
      recent: events,
    },
    { status: 200 }
  );
}
