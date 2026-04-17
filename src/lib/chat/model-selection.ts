import { google } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { getBestFreeModel } from "@/lib/openrouter-models";

export type ChatMode = "fast" | "thinking" | "advanced";

export type ResolvedModel = {
  model: ReturnType<typeof google> | ReturnType<typeof openrouter>;
  provider: "google" | "openrouter";
  modelId: string;
};

const OPENROUTER_DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_FALLBACK_FREE_MODEL = "google/gemma-3-27b-it:free";
const AI_GATEWAY_BASE_URL = process.env.AI_GATEWAY_BASE_URL ?? "https://ai-gateway.vercel.sh/v1";
const AI_GATEWAY_MODEL_PREFIX = process.env.AI_GATEWAY_MODEL_PREFIX ?? "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY;
const AI_GATEWAY_ENABLED = Boolean(AI_GATEWAY_API_KEY);

const openrouter = createOpenAI({
  apiKey: AI_GATEWAY_ENABLED ? AI_GATEWAY_API_KEY : OPENROUTER_API_KEY,
  baseURL: AI_GATEWAY_ENABLED ? AI_GATEWAY_BASE_URL : OPENROUTER_DEFAULT_BASE_URL,
});

// Tier IDs can be overridden per tier via env vars without redeploying.
const FAST_MODEL_ID = process.env.FAST_MODEL_OVERRIDE ?? "gemini-2.5-flash-lite";
const THINKING_MODEL_ID = process.env.THINKING_MODEL_OVERRIDE ?? "gemini-2.5-flash";
const ADVANCED_MODEL_ID = process.env.ADVANCED_MODEL_OVERRIDE ?? "gemini-2.5-pro";
const OPENROUTER_FAST_ENABLED = process.env.OPENROUTER_FAST_ENABLED === "true";

function mapModelIdForGateway(modelId: string): string {
  if (!AI_GATEWAY_ENABLED || !AI_GATEWAY_MODEL_PREFIX) return modelId;
  return `${AI_GATEWAY_MODEL_PREFIX}${modelId}`;
}

async function resolveFastOpenRouterModelId(): Promise<string> {
  const override = process.env.OPENROUTER_FREE_MODEL;
  if (override) return mapModelIdForGateway(override);

  if (!OPENROUTER_API_KEY) {
    return mapModelIdForGateway(OPENROUTER_FALLBACK_FREE_MODEL);
  }

  const model = await getBestFreeModel(OPENROUTER_API_KEY);
  return mapModelIdForGateway(model);
}

function canUseOpenRouterPath(preferVision: boolean): boolean {
  if (preferVision) return false;
  return Boolean(OPENROUTER_API_KEY || AI_GATEWAY_API_KEY);
}

export function getDailyLimitForMode(mode: ChatMode): number {
  const free = Number(process.env.FREE_DAILY_MESSAGES ?? "80");
  const think = Number(process.env.THINK_DAILY_MESSAGES ?? "40");
  const pro = Number(process.env.PRO_DAILY_MESSAGES ?? "120");

  switch (mode) {
    case "fast":
      return free;
    case "thinking":
      return think;
    default:
      return pro;
  }
}

export async function resolveModelForMode(mode: ChatMode, preferVision: boolean): Promise<ResolvedModel> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  // Reliability-first strategy:
  // - Default fast mode to Gemini unless OpenRouter fast is explicitly enabled.
  // - If Google key is unavailable, still fall back to OpenRouter as last resort.
  if (mode === "fast") {
    if (OPENROUTER_FAST_ENABLED && canUseOpenRouterPath(preferVision)) {
      const freeModel = await resolveFastOpenRouterModelId();
      return {
        model: openrouter(freeModel),
        provider: "openrouter",
        modelId: freeModel,
      };
    }

    if (key) {
      return {
        model: google(FAST_MODEL_ID),
        provider: "google",
        modelId: FAST_MODEL_ID,
      };
    }

    if (canUseOpenRouterPath(preferVision)) {
      const freeModel = await resolveFastOpenRouterModelId();
      return {
        model: openrouter(freeModel),
        provider: "openrouter",
        modelId: freeModel,
      };
    }

    throw new Error("No model provider configured for fast mode. Set GOOGLE_GENERATIVE_AI_API_KEY, OPENROUTER_API_KEY, or AI_GATEWAY_API_KEY.");
  }

  if (!key) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set (required for Think/Pro)");

  switch (mode) {
    case "thinking":
      return {
        model: google(THINKING_MODEL_ID),
        provider: "google",
        modelId: THINKING_MODEL_ID,
      };
    default:
      return {
        model: google(ADVANCED_MODEL_ID),
        provider: "google",
        modelId: ADVANCED_MODEL_ID,
      };
  }
}
