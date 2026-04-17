import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { getGoogleConnectionByUserId } from "@/lib/data/db-helpers";
import { readSafeErrorMessage } from "@/lib/api-security";
import { googleFetch } from "@/lib/integrations/google-api";
import { createApiRequestContext, logApiCompletion, logApiStart, withRequestHeaders } from "@/lib/observability/logging";

export const dynamic = "force-dynamic";

// GET /api/google/docs/[docId]  — fetch a single Google Doc's plain text + revisionId
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const { docId } = await params;
  const context = createApiRequestContext(req, "/api/google/docs/[docId]");

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

    if (!docId || !/^[A-Za-z0-9_-]+$/.test(docId)) {
      logApiCompletion(context, { status: 400, error: "invalid_doc_id" });
      return withRequestHeaders(NextResponse.json({ error: "invalid_doc_id" }, { status: 400 }), context.requestId);
    }

    const res = await googleFetch(
      session.user.id,
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(docId)}?fields=documentId,title,revisionId,body`
    );

    if (!res.ok) {
      const text = await readSafeErrorMessage(res);
      logApiCompletion(context, { status: res.status, error: "google_docs_upstream_failed" });
      return withRequestHeaders(NextResponse.json({ error: text }, { status: res.status }), context.requestId);
    }

    const doc = await res.json() as {
      documentId: string;
      title: string;
      revisionId: string;
      body?: { content?: Array<{ paragraph?: { elements?: Array<{ textRun?: { content?: string } }> } }> };
    };

    // Extract plain text from the document body
    const text = (doc.body?.content ?? [])
      .flatMap((b) => b?.paragraph?.elements ?? [])
      .map((e) => e?.textRun?.content ?? "")
      .join("");

    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(
      NextResponse.json({ documentId: doc.documentId, title: doc.title, revisionId: doc.revisionId, text }),
      context.requestId
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "google_doc_fetch_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: message }, { status: 500 }), context.requestId);
  }
}
