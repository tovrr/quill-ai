import { db } from "@/db";
import { modelUsageEvents } from "@/db/schema";
import { desc } from "drizzle-orm";

type ChatMode = "fast" | "thinking" | "advanced";
type UsageFeature = "chat" | "image";

type LanguageUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  [key: string]: unknown;
};

type ModelUsageInput = {
  userId?: string;
  chatId?: string;
  route: string;
  feature: UsageFeature;
  mode?: ChatMode;
  provider: string;
  model: string;
  usage?: LanguageUsage;
  imageCount?: number;
  providerMetadata?: unknown;
};

function parseUsdEnv(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function estimateTextCostUsd(input: {
  provider: string;
  model: string;
  usage?: LanguageUsage;
}): number | undefined {
  const inputTokens = input.usage?.inputTokens ?? 0;
  const outputTokens = input.usage?.outputTokens ?? 0;

  if (input.provider === "openrouter" && input.model.endsWith(":free")) {
    return 0;
  }

  let inputPerMillion: number | undefined;
  let outputPerMillion: number | undefined;

  if (input.provider === "google" && input.model === "gemini-2.5-flash-lite") {
    inputPerMillion = parseUsdEnv("PRICE_GEMINI_25_FLASH_LITE_INPUT_PER_1M_USD");
    outputPerMillion = parseUsdEnv("PRICE_GEMINI_25_FLASH_LITE_OUTPUT_PER_1M_USD");
  }

  if (input.provider === "google" && input.model === "gemini-2.5-flash") {
    inputPerMillion = parseUsdEnv("PRICE_GEMINI_25_FLASH_INPUT_PER_1M_USD");
    outputPerMillion = parseUsdEnv("PRICE_GEMINI_25_FLASH_OUTPUT_PER_1M_USD");
  }

  if (input.provider === "google" && input.model === "gemini-2.5-pro") {
    inputPerMillion = parseUsdEnv("PRICE_GEMINI_25_PRO_INPUT_PER_1M_USD");
    outputPerMillion = parseUsdEnv("PRICE_GEMINI_25_PRO_OUTPUT_PER_1M_USD");
  }

  if (input.provider === "openrouter") {
    inputPerMillion = parseUsdEnv("PRICE_OPENROUTER_INPUT_PER_1M_USD");
    outputPerMillion = parseUsdEnv("PRICE_OPENROUTER_OUTPUT_PER_1M_USD");
  }

  if (inputPerMillion == null || outputPerMillion == null) return undefined;

  return (inputTokens / 1_000_000) * inputPerMillion + (outputTokens / 1_000_000) * outputPerMillion;
}

function estimateImageCostUsd(input: { provider: string; model: string; imageCount: number }): number | undefined {
  if (input.provider === "google" && input.model === "imagen-4.0-fast-generate-001") {
    const perImage = parseUsdEnv("PRICE_IMAGEN_4_FAST_PER_IMAGE_USD");
    if (perImage == null) return undefined;
    return input.imageCount * perImage;
  }

  return undefined;
}

export async function recordModelUsage(input: ModelUsageInput) {
  const estimatedCostUsd =
    input.feature === "chat"
      ? estimateTextCostUsd({ provider: input.provider, model: input.model, usage: input.usage })
      : estimateImageCostUsd({ provider: input.provider, model: input.model, imageCount: input.imageCount ?? 1 });

  try {
    await db.insert(modelUsageEvents).values({
      userId: input.userId,
      chatId: input.chatId,
      route: input.route,
      feature: input.feature,
      mode: input.mode,
      provider: input.provider,
      model: input.model,
      inputTokens: input.usage?.inputTokens,
      outputTokens: input.usage?.outputTokens,
      totalTokens: input.usage?.totalTokens,
      reasoningTokens: input.usage?.reasoningTokens,
      cachedInputTokens: input.usage?.cachedInputTokens,
      imageCount: input.imageCount ?? 0,
      estimatedCostUsd,
      rawUsage: input.usage,
      providerMetadata: input.providerMetadata,
    });
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "model_usage.record.failed",
        route: input.route,
        provider: input.provider,
        model: input.model,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

export async function getRecentModelUsageEvents(limit = 200) {
  try {
    return await db.query.modelUsageEvents.findMany({
      orderBy: [desc(modelUsageEvents.createdAt)],
      limit,
    });
  } catch (error) {
    throw new Error(
      error instanceof Error ? `model_usage_unavailable:${error.message}` : "model_usage_unavailable"
    );
  }
}
