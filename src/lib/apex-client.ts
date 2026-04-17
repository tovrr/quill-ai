/**
 * Apex API Client (Server-Side Only)
 * 
 * This module handles all communication with the Apex backend.
 * The API key is injected server-side and never exposed to the client.
 */

interface ApexChatRequest {
  question: string;
  mots_max?: number;
  context?: Record<string, unknown>;
}

interface ApexChatResponse {
  response: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

type ApexV1ChatCompletion = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

export class ApexClientError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApexClientError";
  }
}

function getApexConfig() {
  const baseUrl = process.env.APEX_BASE_URL;
  // Accept both APEX_API_KEY (preferred) and APEX_SECRET_KEY (legacy fallback)
  const apiKeyRaw = process.env.APEX_API_KEY || process.env.APEX_SECRET_KEY;
  const apiKey = apiKeyRaw?.trim();
  const allowAnonProxy = process.env.APEX_ALLOW_ANON_PROXY === "1";

  if (!baseUrl) {
    throw new Error("APEX_BASE_URL is not configured");
  }

  if (!apiKey && !allowAnonProxy) {
    throw new Error("APEX_API_KEY or APEX_SECRET_KEY is not configured and APEX_ALLOW_ANON_PROXY is not enabled");
  }

  return { baseUrl, apiKey, allowAnonProxy };
}

/**
 * Call Apex /chat endpoint synchronously
 */
export async function callApexChat(req: ApexChatRequest): Promise<ApexChatResponse> {
  const { baseUrl, apiKey } = getApexConfig();

  // Validate input
  if (!req.question || typeof req.question !== "string") {
    throw new ApexClientError(400, "question is required and must be a string");
  }

  if (req.question.trim().length === 0) {
    throw new ApexClientError(400, "question cannot be empty");
  }

  // Validate mots_max if provided
  if (req.mots_max !== undefined) {
    if (!Number.isInteger(req.mots_max) || req.mots_max < 1 || req.mots_max > 500) {
      throw new ApexClientError(
        400,
        "mots_max must be an integer between 1 and 500"
      );
    }
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    // Apex expects X-API-Key header (primary method)
    headers["X-API-Key"] = apiKey;
  }

  const body = {
    model: process.env.APEX_MODEL ?? "apex:fast",
    messages: [{ role: "user", content: req.question.trim() }],
    ...(req.mots_max && { max_tokens: req.mots_max }),
    ...(req.context && { metadata: req.context }),
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new ApexClientError(
          response.status,
          `Apex API returned ${response.status}`,
          errorText
        );
      }

      const data = (await response.json()) as ApexV1ChatCompletion;
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) {
        throw new ApexClientError(502, "Apex response did not include assistant content", data);
      }

      return {
        response: text,
        usage: {
          prompt_tokens: data.usage?.prompt_tokens,
          completion_tokens: data.usage?.completion_tokens,
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (error instanceof ApexClientError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApexClientError(504, "Request to Apex backend timed out");
    }

    if (error instanceof Error) {
      throw new ApexClientError(502, "Failed to reach Apex backend", error.message);
    }

    throw new ApexClientError(502, "Unknown error communicating with Apex");
  }
}

/**
 * Stream Apex /chat/stream endpoint as Server-Sent Events
 * Yields the ReadableStream to be piped directly to response
 */
export async function streamApexChat(req: ApexChatRequest): Promise<ReadableStream<Uint8Array>> {
  const { baseUrl, apiKey } = getApexConfig();

  // Validate input (same as callApexChat)
  if (!req.question || typeof req.question !== "string") {
    throw new ApexClientError(400, "question is required and must be a string");
  }

  if (req.question.trim().length === 0) {
    throw new ApexClientError(400, "question cannot be empty");
  }

  if (req.mots_max !== undefined) {
    if (!Number.isInteger(req.mots_max) || req.mots_max < 1 || req.mots_max > 500) {
      throw new ApexClientError(
        400,
        "mots_max must be an integer between 1 and 500"
      );
    }
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    // Apex expects X-API-Key header (primary method)
    headers["X-API-Key"] = apiKey;
  }

  const body = {
    model: process.env.APEX_MODEL ?? "apex:fast",
    messages: [{ role: "user", content: req.question.trim() }],
    stream: true,
    ...(req.mots_max && { max_tokens: req.mots_max }),
    ...(req.context && { metadata: req.context }),
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300_000); // 5min

    try {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new ApexClientError(
          response.status,
          `Apex streaming API returned ${response.status}`,
          errorText
        );
      }

      if (!response.body) {
        throw new ApexClientError(502, "Apex stream response has no body");
      }

      return response.body;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (error instanceof ApexClientError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApexClientError(504, "Request to Apex streaming endpoint timed out");
    }

    if (error instanceof Error) {
      throw new ApexClientError(502, "Failed to reach Apex streaming endpoint", error.message);
    }

    throw new ApexClientError(502, "Unknown error streaming from Apex");
  }
}
