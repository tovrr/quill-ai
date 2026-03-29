type TavilySearchResult = {
  title?: string;
  url?: string;
  content?: string;
  raw_content?: string;
};

type TavilySearchResponse = {
  results?: TavilySearchResult[];
};

export type WebSearchItem = {
  title: string;
  url: string;
  snippet: string;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const searchCache = new Map<string, { expiresAt: number; results: WebSearchItem[] }>();

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function cleanSnippet(value: string | undefined): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

export function isWebSearchConfigured(): boolean {
  return Boolean(process.env.TAVILY_API_KEY);
}

export async function searchWeb(query: string, maxResults = 5): Promise<WebSearchItem[]> {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) return [];

  const cached = searchCache.get(normalizedQuery);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.results;
  }

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("Web search is not configured.");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",
      include_answer: false,
      include_raw_content: false,
      max_results: maxResults,
      topic: "general",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Web search provider error (${response.status}): ${errorText || response.statusText}`);
  }

  const payload = (await response.json()) as TavilySearchResponse;
  const results = (payload.results ?? [])
    .map((item) => {
      const url = typeof item.url === "string" ? item.url.trim() : "";
      if (!url) return null;

      const title = typeof item.title === "string" && item.title.trim() ? item.title.trim() : url;
      const snippet = cleanSnippet(item.content ?? item.raw_content);

      return { title, url, snippet };
    })
    .filter((item): item is WebSearchItem => item !== null)
    .slice(0, maxResults);

  searchCache.set(normalizedQuery, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    results,
  });

  return results;
}

export function buildWebSearchContext(query: string, results: WebSearchItem[]): string {
  if (results.length === 0) {
    return [
      "Web search was requested but returned no results.",
      `Original search query: ${query}`,
      "Be explicit that no live sources were found.",
    ].join("\n");
  }

  const formattedResults = results
    .map((result, index) => {
      const lines = [`${index + 1}. ${result.title}`, `URL: ${result.url}`];
      if (result.snippet) lines.push(`Snippet: ${result.snippet}`);
      return lines.join("\n");
    })
    .join("\n\n");

  return [
    "Live web search results are available for this response.",
    `Search query: ${query}`,
    "Use these results when relevant, prefer concrete facts over speculation, and cite the source URLs directly in the answer when you rely on them.",
    "Search results:",
    formattedResults,
  ].join("\n\n");
}