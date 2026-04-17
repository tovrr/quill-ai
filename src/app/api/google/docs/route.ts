import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { getGoogleConnectionByUserId, deleteGoogleConnectionByUserId } from "@/lib/data/db-helpers";
import { parseBoundedInt, readSafeErrorMessage, sanitizeGoogleNameQuery } from "@/lib/api-security";
import { logAuditEvent } from "@/lib/data/audit-log";
import { googleFetch } from "@/lib/integrations/google-api";
import { createApiRequestContext, logApiCompletion, logApiStart, withRequestHeaders } from "@/lib/observability";

export const dynamic = "force-dynamic";

// GET /api/google/docs?pageSize=10&query=...
export async function GET(req: NextRequest) {
  const context = createApiRequestContext(req, "/api/google/docs");
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
    const pageSize = parseBoundedInt(url.searchParams.get("pageSize"), 20, 1, 50);
    const query = sanitizeGoogleNameQuery(url.searchParams.get("query"));

  // Google Drive API — filter by mimeType = Google Doc
    const driveParams = new URLSearchParams({
      pageSize: String(pageSize),
      fields: "files(id,name,modifiedTime,webViewLink,owners)",
      orderBy: "modifiedTime desc",
      q: `mimeType='application/vnd.google-apps.document'${query ? ` and name contains '${query}'` : ""}`,
    });

    const res = await googleFetch(
      session.user.id,
      `https://www.googleapis.com/drive/v3/files?${driveParams.toString()}`
    );

    if (!res.ok) {
      const text = await readSafeErrorMessage(res);
      logApiCompletion(context, { status: res.status, error: "google_docs_upstream_failed" });
      return withRequestHeaders(NextResponse.json({ error: text }, { status: res.status }), context.requestId);
    }

    const data = await res.json();
    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(NextResponse.json(data), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "google_docs_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}

// DELETE /api/google/docs — disconnect Google account
export async function DELETE(req: NextRequest) {
  const context = createApiRequestContext(req, "/api/google/docs");
  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session?.user?.id) {
      logApiStart(context);
      logApiCompletion(context, { status: 401, error: "unauthorized" });
      return withRequestHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), context.requestId);
    }

    context.userId = session.user.id;
    logApiStart(context);

    await deleteGoogleConnectionByUserId(session.user.id);
    logAuditEvent({
      action: "google.connection.deleted",
      userId: session.user.id,
      requestId: context.requestId,
    });
    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(NextResponse.json({ ok: true }), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "google_disconnect_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}
