/**
 * RAG embedding helpers — uses OpenAI text-embedding-3-small (1536 dims)
 * Requires OPENAI_API_KEY env var.
 */

const OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings";
const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIMS = 1536;

export { EMBED_DIMS };

async function callEmbeddingAPI(inputs: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set — required for RAG embeddings.");
  }

  const res = await fetch(OPENAI_EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI embedding API error ${res.status}: ${body}`);
  }

  const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
  // Sort by index to guarantee order
  const sorted = json.data.sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}

/**
 * Embed a single string. Returns a 1536-dim float array.
 */
export async function embedText(text: string): Promise<number[]> {
  const [embedding] = await callEmbeddingAPI([text]);
  return embedding;
}

/**
 * Embed multiple strings in one API call. Returns an array of 1536-dim float arrays.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  return callEmbeddingAPI(texts);
}
