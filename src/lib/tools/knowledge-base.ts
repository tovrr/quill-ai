import { tool, jsonSchema } from "ai";
import { embedText } from "@/lib/rag/embed";
import { searchChunks } from "@/lib/rag/search";

export const SEARCH_KNOWLEDGE_BASE_DESCRIPTION =
  "Search the user's personal knowledge base for relevant information. " +
  "Use this when the user asks about their documents, notes, or any previously ingested content. " +
  "Returns the most semantically similar text chunks from the knowledge base.";

export const searchKnowledgeBaseInputSchema = jsonSchema<{ query: string; limit?: number }>({
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "The search query to find relevant knowledge base content.",
    },
    limit: {
      type: "number",
      description: "Maximum number of results to return (1-10, default 5).",
    },
  },
  required: ["query"],
});

export function buildSearchKnowledgeBaseTool(userId: string) {
  return tool({
    description: SEARCH_KNOWLEDGE_BASE_DESCRIPTION,
    inputSchema: searchKnowledgeBaseInputSchema,
    execute: async ({ query, limit = 5 }: { query: string; limit?: number }) => {
      try {
        const embedding = await embedText(query);
        const results = await searchChunks(embedding, userId, Math.min(limit, 10));
        if (results.length === 0) {
          return { found: false, message: "No relevant content found in the knowledge base." };
        }
        return {
          found: true,
          results: results.map((r) => ({
            documentTitle: r.documentTitle,
            content: r.content,
            similarity: Math.round(r.similarity * 100) / 100,
          })),
        };
      } catch {
        return { found: false, message: "Knowledge base search is unavailable (OPENAI_API_KEY not configured)." };
      }
    },
  });
}
