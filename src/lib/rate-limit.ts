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

export function checkRateLimit(input: CheckRateLimitInput): RateLimitResult {
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
