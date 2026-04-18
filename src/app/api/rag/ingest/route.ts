/**
 * POST /api/rag/ingest
 * Ingests text into the RAG knowledge base.
 *
 * Body: { title: string, content: string, source?: string }
 * - title: human-readable label for the document
 * - content: raw text to chunk and embed
 * - source: "upload" | "url" | "text" (default "text")
 */

import { NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth/server";
import { db } from "@/db";
import { ragDocuments, ragChunks } from "@/db/schema";
import { chunkText } from "@/lib/rag/chunk";
import { embedBatch } from "@/lib/rag/embed";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: { title?: string; content?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, content, source = "text" } = body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  // 1. Create document record
  const [doc] = await db
    .insert(ragDocuments)
    .values({
      userId,
      title: title.trim(),
      source: ["upload", "url", "text"].includes(source) ? source : "text",
      mimeType: "text/plain",
      byteSize: Buffer.byteLength(content, "utf8"),
    })
    .returning();

  // 2. Chunk the content
  const chunks = chunkText(content);

  if (chunks.length === 0) {
    return NextResponse.json({ documentId: doc.id, chunkCount: 0 });
  }

  // 3. Embed all chunks in one batch call
  let embeddings: number[][];
  try {
    embeddings = await embedBatch(chunks.map((c) => c.content));
  } catch (err) {
    // Roll back document if embedding fails
    await db.delete(ragDocuments).where(
      (await import("drizzle-orm")).eq(ragDocuments.id, doc.id)
    );
    const msg = err instanceof Error ? err.message : "Embedding failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // 4. Insert all chunks
  await db.insert(ragChunks).values(
    chunks.map((chunk, i) => ({
      documentId: doc.id,
      userId,
      chunkIndex: chunk.index,
      content: chunk.content,
      embedding: embeddings[i],
    }))
  );

  // 5. Update chunkCount on document
  const { eq } = await import("drizzle-orm");
  await db
    .update(ragDocuments)
    .set({ chunkCount: chunks.length, updatedAt: new Date() })
    .where(eq(ragDocuments.id, doc.id));

  return NextResponse.json({ documentId: doc.id, chunkCount: chunks.length }, { status: 201 });
}
