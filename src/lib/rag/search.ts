/**
 * RAG vector similarity search using pgvector.
 * Finds the top-k chunks closest to the query embedding (cosine distance).
 */

import { db } from "@/db";
import { ragChunks, ragDocuments } from "@/db/schema";
import { sql, eq, and } from "drizzle-orm";

export interface SearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  similarity: number;
}

/**
 * Search the knowledge base for chunks similar to the given embedding.
 * Uses cosine distance (`<=>` pgvector operator).
 */
export async function searchChunks(
  queryEmbedding: number[],
  userId: string,
  limit = 5,
  similarityThreshold = 0.3
): Promise<SearchResult[]> {
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  const rows = await db
    .select({
      chunkId: ragChunks.id,
      documentId: ragChunks.documentId,
      documentTitle: ragDocuments.title,
      chunkIndex: ragChunks.chunkIndex,
      content: ragChunks.content,
      // 1 - cosine_distance = cosine_similarity
      similarity: sql<number>`1 - (${ragChunks.embedding} <=> ${sql.raw(`'${vectorLiteral}'::vector`)})`,
    })
    .from(ragChunks)
    .innerJoin(ragDocuments, eq(ragChunks.documentId, ragDocuments.id))
    .where(and(eq(ragChunks.userId, userId), sql`${ragChunks.embedding} IS NOT NULL`))
    .orderBy(sql`${ragChunks.embedding} <=> ${sql.raw(`'${vectorLiteral}'::vector`)}`)
    .limit(limit);

  return rows.filter((r) => r.similarity >= similarityThreshold);
}
