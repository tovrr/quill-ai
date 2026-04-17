import { recordApiMetric } from "@/lib/api-metrics";

type ApiRequestContext = {
  route: string;
  requestId: string;
  startedAt: number;
  ip: string;
  userId?: string;
};

type ApiCompletion = {
  status: number;
  error?: string;
};

export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return req.headers.get("x-real-ip") ?? "unknown";
}

export function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function createApiRequestContext(req: Request, route: string): ApiRequestContext {
  return {
    route,
    requestId: getRequestId(req),
    startedAt: Date.now(),
    ip: getClientIp(req),
  };
}

export function logApiStart(context: ApiRequestContext): void {
  console.info(
    JSON.stringify({
      event: "api.request.start",
      route: context.route,
      requestId: context.requestId,
      ip: context.ip,
      userId: context.userId ?? "guest",
    })
  );
}

export function logApiCompletion(context: ApiRequestContext, completion: ApiCompletion): void {
  recordApiMetric({
    route: context.route,
    status: completion.status,
    error: completion.error,
  });

  console.info(
    JSON.stringify({
      event: "api.request.complete",
      route: context.route,
      requestId: context.requestId,
      ip: context.ip,
      userId: context.userId ?? "guest",
      status: completion.status,
      durationMs: Date.now() - context.startedAt,
      error: completion.error,
    })
  );
}

export function buildRateLimitHeaders(input: {
  requestId: string;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}): HeadersInit {
  return {
    "x-request-id": input.requestId,
    "x-ratelimit-limit": String(input.limit),
    "x-ratelimit-remaining": String(input.remaining),
    "retry-after": String(input.retryAfterSeconds),
  };
}

export function withRequestHeaders(res: Response, requestId: string): Response {
  const headers = new Headers(res.headers);
  headers.set("x-request-id", requestId);

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}
