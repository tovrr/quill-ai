import { recordApiMetric } from "@/lib/builder/metrics";
import { persistentMetricsService } from "@/lib/observability/persistent-metrics";

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

/**
 * Error code to human-readable message mapping
 * Provides clear, actionable error messages for API consumers
 */
export const ERROR_MESSAGES: Record<string, { message: string; suggestion: string | null }> = {
  // Authentication errors
  auth_required_mode: {
    message: "Sign in required to use this feature.",
    suggestion: "Please sign in to access Think and Pro modes.",
  },
  auth_required_web_search: {
    message: "Sign in required for web search.",
    suggestion: "Please sign in to use web search functionality.",
  },
  chat_forbidden: {
    message: "You do not have access to this chat.",
    suggestion: "This chat belongs to another user.",
  },
  // Rate limit errors
  rate_limit: {
    message: "Too many requests. Please slow down.",
    suggestion: "Wait a moment before trying again.",
  },
  daily_quota_reached: {
    message: "Daily message limit reached.",
    suggestion: "Your daily limit for this mode has been reached. Try again tomorrow or upgrade your plan.",
  },
  web_search_daily_quota_reached: {
    message: "Daily web search limit reached.",
    suggestion: "You've used all your web searches for today. Try again tomorrow or upgrade your plan.",
  },
  // Payment errors
  paid_mode_required: {
    message: "This feature requires a paid plan.",
    suggestion: "Upgrade to a paid plan to access Think and Pro modes.",
  },
  // Validation errors
  invalid_request_body: {
    message: "Invalid request format.",
    suggestion: "Check your request body and ensure all required fields are provided.",
  },
  no_messages: {
    message: "No messages provided.",
    suggestion: "Include at least one message in your request.",
  },
  // Service errors
  web_search_not_configured: {
    message: "Web search is not available.",
    suggestion: "This feature is being configured. Please try again later.",
  },
  // Generic errors
  internal_error: {
    message: "Something went wrong on our end.",
    suggestion: "Please try again. If the problem persists, contact support.",
  },
  client_aborted: {
    message: "Request cancelled.",
    suggestion: null,
  },
};

/**
 * Get a user-friendly error response with actionable suggestions
 */
export function getErrorResponse(
  errorCode: string,
  requestId: string,
  additionalDetails?: Record<string, unknown>
): { error: string; code: string; suggestion: string | null; requestId: string; details?: Record<string, unknown> } {
  const errorInfo = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.internal_error;

  return {
    error: errorInfo.message,
    code: errorCode,
    suggestion: errorInfo.suggestion,
    requestId,
    ...(additionalDetails ? { details: additionalDetails } : {}),
  };
}

/**
 * Extended rate limit headers with reset time
 */
export function buildRateLimitHeaders(input: {
  requestId: string;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetTime?: number;
}): HeadersInit {
  const headers: HeadersInit = {
    "x-request-id": input.requestId,
    "x-ratelimit-limit": String(input.limit),
    "x-ratelimit-remaining": String(input.remaining),
    "retry-after": String(input.retryAfterSeconds),
  };

  if (input.resetTime) {
    headers["x-ratelimit-reset"] = String(input.resetTime);
  }

  return headers;
}

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

  // Record persistent metrics for analytics
  if (context.userId) {
    persistentMetricsService.recordUserActivity(context.userId, {
      route: context.route,
      feature: "api_request",
      value: 1,
      metadata: {
        status: completion.status,
        durationMs: Date.now() - context.startedAt,
        hasError: !!completion.error,
      },
    });
  }

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

export function withRequestHeaders(res: Response, requestId: string): Response {
  const headers = new Headers(res.headers);
  headers.set("x-request-id", requestId);

  // Configure CORS using an allowlist from ALLOWED_ORIGINS (comma-separated).
  // If unset, default to safer `null` (same-origin) instead of a wildcard.
  const allowedRaw = process.env.ALLOWED_ORIGINS ?? "";
  const allowed = allowedRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowed.length === 0) {
    headers.set("access-control-allow-origin", "null");
  } else if (allowed.includes("*")) {
    headers.set("access-control-allow-origin", "*");
  } else {
    // Use the first allowed origin to avoid reflecting arbitrary origins.
    headers.set("access-control-allow-origin", allowed[0]);
    headers.set("vary", "Origin");
  }

  // Add security headers
  if (!headers.has("x-content-type-options")) {
    headers.set("x-content-type-options", "nosniff");
  }

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

/**
 * Create a JSON error response with enhanced error details
 */
export function createJsonErrorResponse(
  errorCode: string,
  status: number,
  requestId: string,
  additionalDetails?: Record<string, unknown>
): Response {
  const errorResponse = getErrorResponse(errorCode, requestId, additionalDetails);

  return new Response(JSON.stringify(errorResponse), {
    status,
    headers: {
      "Content-Type": "application/json",
      "x-request-id": requestId,
      "x-content-type-options": "nosniff",
    },
  });
}
