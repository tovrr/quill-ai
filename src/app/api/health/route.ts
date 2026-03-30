import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  createApiRequestContext,
  logApiCompletion,
  logApiStart,
  withRequestHeaders,
} from "@/lib/observability";

type CheckStatus = "ok" | "degraded" | "down";

type DependencyCheck = {
  name: "database" | "auth" | "provider";
  status: CheckStatus;
  durationMs: number;
  details?: string;
};

type ReadinessSummary = {
  status: CheckStatus;
  checks: DependencyCheck[];
};

const CHECK_TIMEOUT_MS = 1500;

async function withTimeout<T>(task: Promise<T>, timeoutMs: number): Promise<T> {
  return await Promise.race([
    task,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("timeout")), timeoutMs);
    }),
  ]);
}

async function runDbCheck(): Promise<DependencyCheck> {
  const startedAt = Date.now();
  try {
    await withTimeout(db.execute(sql`select 1`), CHECK_TIMEOUT_MS);
    return {
      name: "database",
      status: "ok",
      durationMs: Date.now() - startedAt,
    };
  } catch {
    return {
      name: "database",
      status: "down",
      durationMs: Date.now() - startedAt,
      details: "db_unreachable_or_timeout",
    };
  }
}

function runAuthCheck(): DependencyCheck {
  const startedAt = Date.now();
  const hasSecret = Boolean(process.env.BETTER_AUTH_SECRET);
  const hasUrl = Boolean(process.env.BETTER_AUTH_URL);

  const status: CheckStatus = hasSecret && hasUrl ? "ok" : "down";

  return {
    name: "auth",
    status,
    durationMs: Date.now() - startedAt,
    details: status === "ok" ? undefined : "missing_auth_env",
  };
}

function runProviderCheck(): DependencyCheck {
  const startedAt = Date.now();
  const hasGoogle = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);

  if (hasGoogle) {
    return {
      name: "provider",
      status: "ok",
      durationMs: Date.now() - startedAt,
      details: hasOpenRouter ? "google+openrouter_configured" : "google_configured",
    };
  }

  if (hasOpenRouter) {
    return {
      name: "provider",
      status: "degraded",
      durationMs: Date.now() - startedAt,
      details: "openrouter_only_configured",
    };
  }

  return {
    name: "provider",
    status: "down",
    durationMs: Date.now() - startedAt,
    details: "missing_provider_env",
  };
}

function summarize(checks: DependencyCheck[]): ReadinessSummary {
  const hasDown = checks.some((check) => check.status === "down");
  if (hasDown) return { status: "down", checks };

  const hasDegraded = checks.some((check) => check.status === "degraded");
  if (hasDegraded) return { status: "degraded", checks };

  return { status: "ok", checks };
}

export async function GET(req: Request) {
  const context = createApiRequestContext(req, "/api/health");
  logApiStart(context);

  const checks = await Promise.all([runDbCheck(), Promise.resolve(runAuthCheck()), Promise.resolve(runProviderCheck())]);
  const readiness = summarize(checks);

  const statusCode = readiness.status === "ok" ? 200 : 503;
  const response = NextResponse.json(readiness, { status: statusCode });

  logApiCompletion(context, {
    status: statusCode,
    error: readiness.status === "ok" ? undefined : `health_${readiness.status}`,
  });

  return withRequestHeaders(response, context.requestId);
}
