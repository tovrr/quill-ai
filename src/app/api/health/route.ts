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
  degradedModeHint?: string;
};

type ReadinessSummary = {
  status: CheckStatus;
  checks: DependencyCheck[];
  degradedModeHints: string[];
};

const DEFAULT_CHECK_TIMEOUT_MS = 1500;
const DEFAULT_PROVIDER_PROBE_CACHE_MS = 30_000;

type ProviderProbeSnapshot = {
  googleProbe: { ok: boolean; status?: number } | null;
  openrouterProbe: { ok: boolean; status?: number } | null;
  measuredAt: number;
};

const providerProbeCache = new Map<string, { expiresAt: number; snapshot: ProviderProbeSnapshot }>();

function getCheckTimeoutMs(): number {
  const parsed = Number(process.env.HEALTH_CHECK_TIMEOUT_MS ?? String(DEFAULT_CHECK_TIMEOUT_MS));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CHECK_TIMEOUT_MS;
}

function getProviderProbeCacheMs(): number {
  const parsed = Number(process.env.HEALTH_PROVIDER_PROBE_CACHE_MS ?? String(DEFAULT_PROVIDER_PROBE_CACHE_MS));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_PROVIDER_PROBE_CACHE_MS;
}

async function withTimeout<T>(task: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

async function runDbCheck(): Promise<DependencyCheck> {
  const startedAt = Date.now();
  const timeoutMs = getCheckTimeoutMs();

  try {
    await withTimeout(db.execute(sql`select 1`), timeoutMs);
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

async function runAuthCheck(): Promise<DependencyCheck> {
  const startedAt = Date.now();
  const timeoutMs = getCheckTimeoutMs();
  const hasSecret = Boolean(process.env.BETTER_AUTH_SECRET);
  const hasUrl = Boolean(process.env.BETTER_AUTH_URL);

  if (!hasSecret || !hasUrl) {
    return {
      name: "auth",
      status: "down",
      durationMs: Date.now() - startedAt,
      details: "missing_auth_env",
      degradedModeHint: "Sign-in and session restoration are unavailable until Better Auth env vars are restored.",
    };
  }

  try {
    new URL(process.env.BETTER_AUTH_URL as string);
  } catch {
    return {
      name: "auth",
      status: "down",
      durationMs: Date.now() - startedAt,
      details: "invalid_auth_url",
      degradedModeHint: "Sign-in cannot initialize until BETTER_AUTH_URL is a valid absolute URL.",
    };
  }

  try {
    await withTimeout(db.execute(sql`select 1 from "session" limit 1`), timeoutMs);
    return {
      name: "auth",
      status: "ok",
      durationMs: Date.now() - startedAt,
      details: "auth_env_and_session_table_ok",
    };
  } catch {
    return {
      name: "auth",
      status: "down",
      durationMs: Date.now() - startedAt,
      details: "session_store_unreachable_or_timeout",
      degradedModeHint: "Sign-in may load but session creation and validation are unavailable until the auth store recovers.",
    };
  }
}

async function probeUrl(input: {
  url: string;
  headers?: HeadersInit;
}): Promise<{ ok: boolean; status?: number }> {
  const timeoutMs = getCheckTimeoutMs();

  try {
    const response = await withTimeout(
      fetch(input.url, {
        method: "GET",
        headers: input.headers,
        cache: "no-store",
      }),
      timeoutMs
    );

    return {
      ok: response.ok,
      status: response.status,
    };
  } catch {
    return { ok: false };
  }
}

async function runProviderCheck(): Promise<DependencyCheck> {
  const startedAt = Date.now();
  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  if (!googleKey && !openrouterKey) {
    return {
      name: "provider",
      status: "down",
      durationMs: Date.now() - startedAt,
      details: "missing_provider_env",
      degradedModeHint: "Chat and image generation are unavailable until at least one model provider is configured.",
    };
  }

  const cacheKey = `${Boolean(googleKey)}:${Boolean(openrouterKey)}`;
  const now = Date.now();
  const cacheTtl = getProviderProbeCacheMs();
  const cached = providerProbeCache.get(cacheKey);

  let googleProbe: { ok: boolean; status?: number } | null;
  let openrouterProbe: { ok: boolean; status?: number } | null;

  if (cached && cached.expiresAt > now) {
    googleProbe = cached.snapshot.googleProbe;
    openrouterProbe = cached.snapshot.openrouterProbe;
  } else {
    [googleProbe, openrouterProbe] = await Promise.all([
      googleKey
        ? probeUrl({
            url: `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(googleKey)}&pageSize=1`,
          })
        : Promise.resolve(null),
      openrouterKey
        ? probeUrl({
            url: "https://openrouter.ai/api/v1/models",
            headers: {
              Authorization: `Bearer ${openrouterKey}`,
            },
          })
        : Promise.resolve(null),
    ]);

    providerProbeCache.set(cacheKey, {
      expiresAt: now + cacheTtl,
      snapshot: {
        googleProbe,
        openrouterProbe,
        measuredAt: now,
      },
    });
  }

  if (googleProbe?.ok) {
    if (openrouterKey && !openrouterProbe?.ok) {
      return {
        name: "provider",
        status: "degraded",
        durationMs: Date.now() - startedAt,
        details: `google_reachable_openrouter_probe_failed_${openrouterProbe?.status ?? "unknown"}`,
        degradedModeHint: "Core Google-backed chat and image generation work, but fast-mode free routing will fall back away from OpenRouter until it recovers.",
      };
    }

    return {
      name: "provider",
      status: "ok",
      durationMs: Date.now() - startedAt,
      details: openrouterProbe?.ok ? "google_and_openrouter_reachable" : "google_reachable",
    };
  }

  if (openrouterProbe?.ok) {
    return {
      name: "provider",
      status: "degraded",
      durationMs: Date.now() - startedAt,
      details: `google_probe_failed_${googleProbe?.status ?? "unknown"}_openrouter_reachable`,
      degradedModeHint: "Fast-mode text chat can continue through OpenRouter, but Google-backed thinking, advanced, vision, and image generation are unavailable.",
    };
  }

  return {
    name: "provider",
    status: "down",
    durationMs: Date.now() - startedAt,
    details: `provider_probes_failed_google_${googleProbe?.status ?? "unknown"}_openrouter_${openrouterProbe?.status ?? "unknown"}`,
    degradedModeHint: "No model provider is currently reachable, so chat and image generation requests will fail.",
  };
}

function summarize(checks: DependencyCheck[]): ReadinessSummary {
  const hasDown = checks.some((check) => check.status === "down");
  const degradedModeHints = checks
    .map((check) => check.degradedModeHint)
    .filter((hint): hint is string => Boolean(hint));

  if (hasDown) return { status: "down", checks, degradedModeHints };

  const hasDegraded = checks.some((check) => check.status === "degraded");
  if (hasDegraded) return { status: "degraded", checks, degradedModeHints };

  return { status: "ok", checks, degradedModeHints };
}

export async function GET(req: Request) {
  const context = createApiRequestContext(req, "/api/health");
  logApiStart(context);
  const url = new URL(req.url);
  const strictReadiness = url.searchParams.get("readiness") === "1";

  const checks = await Promise.all([runDbCheck(), runAuthCheck(), runProviderCheck()]);
  const readiness = summarize(checks);

  const statusCode = strictReadiness && readiness.status !== "ok" ? 503 : 200;
  const body = {
    status: strictReadiness ? readiness.status : "ok",
    mode: strictReadiness ? "readiness" : "liveness",
    readinessStatus: readiness.status,
    checkedAt: new Date().toISOString(),
    checks: readiness.checks,
    degradedModeHints: readiness.degradedModeHints,
  };
  const response = NextResponse.json(body, { status: statusCode });

  logApiCompletion(context, {
    status: statusCode,
    error:
      strictReadiness && readiness.status !== "ok"
        ? `health_${readiness.status}`
        : undefined,
  });

  return withRequestHeaders(response, context.requestId);
}
