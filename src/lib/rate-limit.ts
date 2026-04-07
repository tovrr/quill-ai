type Bucket = {
  count: number;
  resetAt: number;
};

type CheckRateLimitInput = {
  key: string;
  max: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

const globalStore = globalThis as typeof globalThis & {
  __quillRateLimitStore__?: Map<string, Bucket>;
};

const store = globalStore.__quillRateLimitStore__ ?? new Map<string, Bucket>();
globalStore.__quillRateLimitStore__ = store;

function checkRateLimitInMemory(input: CheckRateLimitInput): RateLimitResult {
  const now = Date.now();
  const existing = store.get(input.key);

  if (!existing || existing.resetAt <= now) {
    const next: Bucket = {
      count: 1,
      resetAt: now + input.windowMs,
    };
    store.set(input.key, next);
    return {
      allowed: true,
      limit: input.max,
      remaining: Math.max(0, input.max - 1),
      retryAfterSeconds: Math.ceil(input.windowMs / 1000),
    };
  }

  if (existing.count >= input.max) {
    return {
      allowed: false,
      limit: input.max,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  store.set(input.key, existing);

  return {
    allowed: true,
    limit: input.max,
    remaining: Math.max(0, input.max - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

function getUpstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url, token };
}

type UpstashPipelineResponse = {
  result?: Array<{ result?: number | string | null }>;
};

async function checkRateLimitUpstash(input: CheckRateLimitInput): Promise<RateLimitResult | null> {
  const cfg = getUpstashConfig();
  if (!cfg) return null;

  try {
    const ttlSeconds = Math.max(1, Math.ceil(input.windowMs / 1000));
    const redisKey = `quill:ratelimit:${input.key}`;

    const res = await fetch(`${cfg.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, ttlSeconds, "NX"],
        ["PTTL", redisKey],
      ]),
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });

    if (!res.ok) {
      throw new Error(`Upstash returned ${res.status}`);
    }

    const payload = (await res.json()) as UpstashPipelineResponse;
    const [incr, , pttl] = payload.result ?? [];
    const count = Number(incr?.result ?? 0);
    const pttlMs = Number(pttl?.result ?? input.windowMs);

    if (!Number.isFinite(count) || count <= 0) return null;

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((Number.isFinite(pttlMs) && pttlMs > 0 ? pttlMs : input.windowMs) / 1000)
    );

    return {
      allowed: count <= input.max,
      limit: input.max,
      remaining: Math.max(0, input.max - count),
      retryAfterSeconds,
    };
  } catch (error) {
    console.warn("[rate-limit] Upstash unavailable, using in-memory fallback:", error);
    return null;
  }
}

export async function checkRateLimit(input: CheckRateLimitInput): Promise<RateLimitResult> {
  const distributed = await checkRateLimitUpstash(input);
  if (distributed) return distributed;
  return checkRateLimitInMemory(input);
}
