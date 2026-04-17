import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { getGoogleConnectionByUserId } from "@/lib/data/db-helpers";
import { parseBoundedInt, readSafeErrorMessage, sanitizeGoogleNameQuery } from "@/lib/api-security";
import { googleFetch } from "@/lib/integrations/google-api";
import { createApiRequestContext, logApiCompletion, logApiStart, withRequestHeaders } from "@/lib/observability";

export const dynamic = "force-dynamic";

// GET /api/google/drive?pageSize=20&query=...
export async function GET(req: NextRequest) {
  const context = createApiRequestContext(req, "/api/google/drive");
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

    const driveParams = new URLSearchParams({
      pageSize: String(pageSize),
      fields: "files(id,name,mimeType,modifiedTime,webViewLink,iconLink,owners,size)",
      orderBy: "modifiedTime desc",
      ...(query ? { q: `name contains '${query}'` } : {}),
    });

    const res = await googleFetch(
      session.user.id,
      `https://www.googleapis.com/drive/v3/files?${driveParams.toString()}`
    );

    if (!res.ok) {
      const text = await readSafeErrorMessage(res);
      logApiCompletion(context, { status: res.status, error: "google_drive_upstream_failed" });
      return withRequestHeaders(NextResponse.json({ error: text }, { status: res.status }), context.requestId);
    }

    const data = await res.json();
    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(NextResponse.json(data), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "google_drive_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}
