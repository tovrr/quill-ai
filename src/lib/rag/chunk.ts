/**
 * Text chunking for RAG ingestion.
 * Splits text into overlapping fixed-size chunks suitable for embedding.
 */

export interface Chunk {
  index: number;
  content: string;
}

const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_OVERLAP = 50;

/**
 * Split `text` into overlapping character-based chunks.
 * Tries to break at whitespace boundaries within the overlap window.
 */
export function chunkText(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_OVERLAP
): Chunk[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized.length === 0) return [];

  const safeChunkSize = Number.isFinite(chunkSize) && chunkSize > 0 ? Math.floor(chunkSize) : DEFAULT_CHUNK_SIZE;
  const safeOverlap = Number.isFinite(overlap) && overlap >= 0 ? Math.floor(overlap) : DEFAULT_OVERLAP;
  const effectiveOverlap = Math.min(safeOverlap, safeChunkSize - 1);

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < normalized.length) {
    let end = Math.min(start + safeChunkSize, normalized.length);

    // Try to break at a whitespace boundary near the end (within last 20% of chunk)
    if (end < normalized.length) {
      const lookback = Math.floor(safeChunkSize * 0.2);
      const breakPoint = normalized.lastIndexOf(" ", end);
      if (breakPoint > end - lookback) {
        end = breakPoint + 1;
      }
    }

    if (end <= start) {
      end = Math.min(start + safeChunkSize, normalized.length);
      if (end <= start) break;
    }

    chunks.push({ index, content: normalized.slice(start, end).trim() });
    index++;

    const nextStart = Math.max(end - effectiveOverlap, start + 1);
    if (nextStart >= normalized.length) break;
    start = nextStart;
  }

  return chunks.filter((c) => c.content.length > 0);
}
