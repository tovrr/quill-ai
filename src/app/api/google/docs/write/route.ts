import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { getGoogleConnectionByUserId, createGoogleWorkspaceSnapshot } from "@/lib/data/db-helpers";
import { logAuditEvent } from "@/lib/data/audit-log";
import { googleFetch } from "@/lib/google-api";
import { readSafeErrorMessage } from "@/lib/api-security";
import {
  createApiRequestContext,
  logApiCompletion,
  logApiStart,
  withRequestHeaders,
} from "@/lib/observability";

export const dynamic = "force-dynamic";

type DocsBodyContent = {
  endIndex?: number;
  paragraph?: {
    elements?: Array<{
      textRun?: {
        content?: string;
      };
    }>;
  };
};

type GoogleDoc = {
  documentId: string;
  title?: string;
  revisionId?: string;
  body?: {
    content?: DocsBodyContent[];
  };
};

function extractDocText(doc: GoogleDoc): string {
  const content = doc.body?.content ?? [];
  const chunks: string[] = [];
  for (const block of content) {
    const elements = block.paragraph?.elements ?? [];
    for (const el of elements) {
      const text = el.textRun?.content;
      if (typeof text === "string") {
        chunks.push(text);
      }
    }
  }
  return chunks.join("").trimEnd();
}

function getDocContentEndIndex(doc: GoogleDoc): number {
  const content = doc.body?.content ?? [];
  let endIndex = 1;
  for (const block of content) {
    if (typeof block.endIndex === "number") {
      endIndex = Math.max(endIndex, block.endIndex);
    }
  }
  return endIndex;
}

async function fetchDoc(userId: string, documentId: string): Promise<GoogleDoc | null> {
  const res = await googleFetch(
    userId,
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await readSafeErrorMessage(res));
  }
  return (await res.json()) as GoogleDoc;
}

export async function POST(req: NextRequest) {
  const context = createApiRequestContext(req, "/api/google/docs/write");
  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session?.user?.id) {
      logApiStart(context);
      logApiCompletion(context, { status: 401, error: "unauthorized" });
      return withRequestHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), context.requestId);
    }

    context.userId = session.user.id;
    logApiStart(context);

    const conn = await getGoogleConnectionByUserId(session.user.id);
    if (!conn) {
      logApiCompletion(context, { status: 403, error: "not_connected" });
      return withRequestHeaders(NextResponse.json({ error: "not_connected" }, { status: 403 }), context.requestId);
    }

    const body = (await req.json()) as { title?: string; text?: string };
    const title = body.title?.trim();
    if (!title) {
      logApiCompletion(context, { status: 400, error: "title_required" });
      return withRequestHeaders(NextResponse.json({ error: "title is required" }, { status: 400 }), context.requestId);
    }

    const createRes = await googleFetch(session.user.id, "https://docs.googleapis.com/v1/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.slice(0, 150) }),
    });

    if (!createRes.ok) {
      const text = await readSafeErrorMessage(createRes);
      logApiCompletion(context, { status: createRes.status, error: "google_docs_create_failed" });
      return withRequestHeaders(NextResponse.json({ error: text }, { status: createRes.status }), context.requestId);
    }

    const created = (await createRes.json()) as GoogleDoc;

    if (body.text && body.text.trim()) {
      const seedRes = await googleFetch(
        session.user.id,
        `https://docs.googleapis.com/v1/documents/${encodeURIComponent(created.documentId)}:batchUpdate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [
              {
                insertText: {
                  location: { index: 1 },
                  text: body.text.slice(0, 200000),
                },
              },
            ],
          }),
        }
      );

      if (!seedRes.ok) {
        const text = await readSafeErrorMessage(seedRes);
        logApiCompletion(context, { status: seedRes.status, error: "google_docs_seed_failed" });
        return withRequestHeaders(NextResponse.json({ error: text }, { status: seedRes.status }), context.requestId);
      }
    }

    const snapshot = await createGoogleWorkspaceSnapshot({
      userId: session.user.id,
      resourceType: "google-doc",
      operation: "create",
      resourceId: created.documentId,
      afterPayload: {
        documentId: created.documentId,
        title: created.title,
      },
    });

    logAuditEvent({
      action: "google.docs.created",
      userId: session.user.id,
      requestId: context.requestId,
      targetId: created.documentId,
      metadata: { snapshotId: snapshot.id },
    });

    logApiCompletion(context, { status: 201 });
    return withRequestHeaders(NextResponse.json({ document: created, snapshotId: snapshot.id }, { status: 201 }), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "google_docs_create_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}

export async function PATCH(req: NextRequest) {
  const context = createApiRequestContext(req, "/api/google/docs/write");
  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session?.user?.id) {
      logApiStart(context);
      logApiCompletion(context, { status: 401, error: "unauthorized" });
      return withRequestHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), context.requestId);
    }

    context.userId = session.user.id;
    logApiStart(context);

    const conn = await getGoogleConnectionByUserId(session.user.id);
    if (!conn) {
      logApiCompletion(context, { status: 403, error: "not_connected" });
      return withRequestHeaders(NextResponse.json({ error: "not_connected" }, { status: 403 }), context.requestId);
    }

    const body = (await req.json()) as {
      documentId?: string;
      text?: string;
      requiredRevisionId?: string;
    };

    if (!body.documentId || typeof body.text !== "string") {
      logApiCompletion(context, { status: 400, error: "invalid_payload" });
      return withRequestHeaders(NextResponse.json({ error: "documentId and text are required" }, { status: 400 }), context.requestId);
    }

    const before = await fetchDoc(session.user.id, body.documentId);
    if (!before) {
      logApiCompletion(context, { status: 404, error: "not_found" });
      return withRequestHeaders(NextResponse.json({ error: "Document not found" }, { status: 404 }), context.requestId);
    }

    if (body.requiredRevisionId && before.revisionId !== body.requiredRevisionId) {
      logApiCompletion(context, { status: 409, error: "revision_conflict" });
      return withRequestHeaders(
        NextResponse.json({ error: "revision_conflict", currentRevisionId: before.revisionId }, { status: 409 }),
        context.requestId
      );
    }

    const endIndex = getDocContentEndIndex(before);
    const requests: Array<Record<string, unknown>> = [];
    if (endIndex > 1) {
      requests.push({
        deleteContentRange: {
          range: {
            startIndex: 1,
            endIndex: endIndex - 1,
          },
        },
      });
    }

    if (body.text.length > 0) {
      requests.push({
        insertText: {
          location: { index: 1 },
          text: body.text.slice(0, 200000),
        },
      });
    }

    const updateRes = await googleFetch(
      session.user.id,
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(body.documentId)}:batchUpdate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests,
          ...(before.revisionId ? { writeControl: { requiredRevisionId: before.revisionId } } : {}),
        }),
      }
    );

    if (!updateRes.ok) {
      const text = await readSafeErrorMessage(updateRes);
      const status = updateRes.status === 400 ? 409 : updateRes.status;
      logApiCompletion(context, { status, error: "google_docs_update_failed" });
      return withRequestHeaders(NextResponse.json({ error: text }, { status }), context.requestId);
    }

    const after = await fetchDoc(session.user.id, body.documentId);

    const snapshot = await createGoogleWorkspaceSnapshot({
      userId: session.user.id,
      resourceType: "google-doc",
      operation: "update",
      resourceId: body.documentId,
      beforePayload: {
        documentId: before.documentId,
        title: before.title,
        revisionId: before.revisionId,
        text: extractDocText(before),
      },
      afterPayload: after
        ? {
            documentId: after.documentId,
            title: after.title,
            revisionId: after.revisionId,
            text: extractDocText(after),
          }
        : undefined,
    });

    logAuditEvent({
      action: "google.docs.updated",
      userId: session.user.id,
      requestId: context.requestId,
      targetId: body.documentId,
      metadata: { snapshotId: snapshot.id },
    });

    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(
      NextResponse.json({
        ok: true,
        snapshotId: snapshot.id,
        revisionId: after?.revisionId,
      }),
      context.requestId
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "google_docs_update_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}

export async function DELETE(req: NextRequest) {
  const context = createApiRequestContext(req, "/api/google/docs/write");
  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session?.user?.id) {
      logApiStart(context);
      logApiCompletion(context, { status: 401, error: "unauthorized" });
      return withRequestHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), context.requestId);
    }

    context.userId = session.user.id;
    logApiStart(context);

    const conn = await getGoogleConnectionByUserId(session.user.id);
    if (!conn) {
      logApiCompletion(context, { status: 403, error: "not_connected" });
      return withRequestHeaders(NextResponse.json({ error: "not_connected" }, { status: 403 }), context.requestId);
    }

    const url = new URL(req.url);
    const documentId = url.searchParams.get("documentId") ?? "";
    if (!documentId) {
      logApiCompletion(context, { status: 400, error: "document_id_required" });
      return withRequestHeaders(NextResponse.json({ error: "documentId is required" }, { status: 400 }), context.requestId);
    }

    const before = await fetchDoc(session.user.id, documentId);
    if (!before) {
      logApiCompletion(context, { status: 404, error: "not_found" });
      return withRequestHeaders(NextResponse.json({ error: "Document not found" }, { status: 404 }), context.requestId);
    }

    const deleteRes = await googleFetch(
      session.user.id,
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(documentId)}`,
      { method: "DELETE" }
    );

    if (!deleteRes.ok) {
      const text = await readSafeErrorMessage(deleteRes);
      logApiCompletion(context, { status: deleteRes.status, error: "google_docs_delete_failed" });
      return withRequestHeaders(NextResponse.json({ error: text }, { status: deleteRes.status }), context.requestId);
    }

    const snapshot = await createGoogleWorkspaceSnapshot({
      userId: session.user.id,
      resourceType: "google-doc",
      operation: "delete",
      resourceId: documentId,
      beforePayload: {
        documentId: before.documentId,
        title: before.title,
        text: extractDocText(before),
      },
    });

    logAuditEvent({
      action: "google.drive.deleted",
      userId: session.user.id,
      requestId: context.requestId,
      targetId: documentId,
      metadata: { snapshotId: snapshot.id, kind: "google-doc" },
    });

    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(NextResponse.json({ ok: true, snapshotId: snapshot.id }), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "google_docs_delete_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}
