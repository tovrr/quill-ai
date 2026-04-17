// Auto-selects the best available free model from OpenRouter.
// Results are cached per-process for 1 hour so we don't hit the API on every request.

type OpenRouterModel = {
  id: string;
  context_length: number;
  top_provider?: { max_completion_tokens?: number };
};

type ModelsResponse = {
  data: OpenRouterModel[];
};

type ModelCache = {
  modelId: string;
  fetchedAt: number;
};

const CACHE_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

// Known high-quality free models ranked by preference.
// Used as fallback if the API call fails.
const FALLBACK_FREE_MODELS = [
  "google/gemma-3-27b-it:free",
  "qwen/qwen3-8b:free",
  "meta-llama/llama-3.1-8b-instruct:free",
];

const globalStore = globalThis as typeof globalThis & {
  __quillOpenRouterModelCache__?: ModelCache;
};

function scoreModel(model: OpenRouterModel): number {
  // Prefer larger context windows and higher completion limits as a quality proxy.
  const context = model.context_length ?? 0;
  const completion = model.top_provider?.max_completion_tokens ?? 0;
  return context + completion * 2;
}

export async function getBestFreeModel(apiKey: string): Promise<string> {
  // Return override if explicitly set.
  const override = process.env.OPENROUTER_FREE_MODEL;
  if (override) return override;

  // Return cached result if still fresh.
  const cached = globalStore.__quillOpenRouterModelCache__;
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.modelId;
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      // Prevent hanging — models list should respond quickly.
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`OpenRouter models API returned ${res.status}`);

    const json = (await res.json()) as ModelsResponse;

    const freeModels = (json.data ?? []).filter(
      (m) => typeof m.id === "string" && m.id.endsWith(":free")
    );

    if (freeModels.length === 0) throw new Error("No free models returned");

    freeModels.sort((a, b) => scoreModel(b) - scoreModel(a));

    const best = freeModels[0].id;
    globalStore.__quillOpenRouterModelCache__ = { modelId: best, fetchedAt: Date.now() };
    console.info(JSON.stringify({ event: "openrouter.model.selected", model: best }));
    return best;
  } catch (err) {
    console.warn(
      "[openrouter-models] Failed to fetch models, using fallback:",
      err instanceof Error ? err.message : err
    );
    // Return last cached value if we have one (even expired), else hardcoded fallback.
    if (cached) return cached.modelId;
    return FALLBACK_FREE_MODELS[0];
  }
}
