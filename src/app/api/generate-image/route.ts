import { google } from "@ai-sdk/google";
import { experimental_generateImage as generateImage } from "ai";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  buildRateLimitHeaders,
  createApiRequestContext,
  logApiCompletion,
  logApiStart,
} from "@/lib/observability";
import { recordModelUsage } from "@/lib/model-usage";

export const maxDuration = 60;

function jsonResponse(payload: Record<string, string>, status: number, headers?: HeadersInit) {
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

  const perMinute = Number(process.env.API_IMAGE_REQUESTS_PER_MINUTE ?? "6");
  const rateLimit = checkRateLimit({
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
      }
    );
  } catch (error) {
    console.error("Image generation error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate image";
    logApiCompletion(requestContext, { status: 500, error: message });
    return jsonResponse({ error: message }, 500, {
      "x-request-id": requestContext.requestId,
    });
  }
}
