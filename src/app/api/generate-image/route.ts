import { google } from "@ai-sdk/google";
import { experimental_generateImage as generateImage } from "ai";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { checkRateLimit } from "@/lib/observability/rate-limit";
import {
  buildRateLimitHeaders,
  createApiRequestContext,
  logApiCompletion,
  logApiStart,
} from "@/lib/observability/logging";
import { recordModelUsage } from "@/lib/observability/metrics";
import { resolveUserEntitlements } from "@/lib/auth/entitlements";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { modelUsageEvents } from "@/db/schema";

export const maxDuration = 60;

function jsonResponse(payload: Record<string, unknown>, status: number, headers?: HeadersInit) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

export async function POST(req: Request) {
  const requestContext = createApiRequestContext(req, "/api/generate-image");
  // Image generation is a paid-tier feature — require authentication
  const sessionData = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
  if (!sessionData?.user?.id) {
    logApiStart(requestContext);
    logApiCompletion(requestContext, { status: 401, error: "auth_required" });
    return jsonResponse({ error: "Authentication required" }, 401, {
      "x-request-id": requestContext.requestId,
    });
  }

  requestContext.userId = sessionData.user.id;
  logApiStart(requestContext);

  // Check daily image limits (cost control)
  const today = new Date().toISOString().split("T")[0];
  const IMAGE_LIMITS = {
    free: { perDay: 5, perMinute: 2 },
    pro: { perDay: 50, perMinute: 6 },
  };

  const entitlement = await resolveUserEntitlements({
    userId: sessionData.user.id,
    email: sessionData.user.email ?? undefined,
  });
  const userTier: "free" | "pro" = entitlement.canUsePaidModes ? "pro" : "free";
  const userLimit = IMAGE_LIMITS[userTier];

  const [dailyImageCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(modelUsageEvents)
    .where(sql`user_id = ${sessionData.user.id} AND feature = 'image' AND DATE(created_at) = ${today}`);

  const imagesToday = dailyImageCount?.count || 0;

  if (imagesToday >= userLimit.perDay) {
    logApiCompletion(requestContext, { status: 429, error: "daily_image_limit_reached" });
    return jsonResponse(
      {
        error: "Daily image limit reached",
        message:
          userTier === "free"
            ? `You've used your ${userLimit.perDay} free images today. Upgrade to Pro for ${IMAGE_LIMITS.pro.perDay} images/day.`
            : "You've reached your daily limit. Try again tomorrow.",
        usage: { today: imagesToday, limit: userLimit.perDay },
      },
      429,
      { "x-request-id": requestContext.requestId },
    );
  }

  const perMinute = Number(process.env.API_IMAGE_REQUESTS_PER_MINUTE ?? String(userLimit.perMinute));
  const rateLimit = await checkRateLimit({
    key: `image:user:${sessionData.user.id}`,
    max: perMinute,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    const headers = buildRateLimitHeaders({
      requestId: requestContext.requestId,
      limit: rateLimit.limit,
      remaining: rateLimit.remaining,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
    logApiCompletion(requestContext, { status: 429, error: "rate_limit" });
    return jsonResponse({ error: "Too many image requests. Please retry shortly." }, 429, headers);
  }

  const { prompt } = await req.json();

  if (!prompt || typeof prompt !== "string") {
    logApiCompletion(requestContext, { status: 400, error: "prompt_required" });
    return jsonResponse({ error: "Prompt is required" }, 400, {
      "x-request-id": requestContext.requestId,
    });
  }

  try {
    const modelId = "imagen-4.0-fast-generate-001";
    const { image, usage, providerMetadata } = await generateImage({
      model: google.image(modelId),
      prompt,
      aspectRatio: "1:1",
    });

    await recordModelUsage({
      userId: sessionData.user.id,
      route: "/api/generate-image",
      feature: "image",
      provider: "google",
      model: modelId,
      imageCount: 1,
      usage,
      providerMetadata,
    });

    logApiCompletion(requestContext, { status: 200 });
    return new Response(
      JSON.stringify({
        url: `data:${image.mediaType};base64,${image.base64}`,
        mediaType: image.mediaType,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "x-request-id": requestContext.requestId,
        },
      },
    );
  } catch (error) {
    console.error("Image generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate image";
    logApiCompletion(requestContext, { status: 500, error: message });
    return jsonResponse({ error: message }, 500, {
      "x-request-id": requestContext.requestId,
    });
  }
}
