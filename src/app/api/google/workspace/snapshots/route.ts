import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { getGoogleConnectionByUserId, getGoogleWorkspaceSnapshotsByUserId } from "@/lib/data/db-helpers";
import { parseBoundedInt } from "@/lib/auth/security";
import {
  createApiRequestContext,
  logApiCompletion,
  logApiStart,
  withRequestHeaders,
} from "@/lib/observability/logging";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const context = createApiRequestContext(req, "/api/google/workspace/snapshots");
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
    const limit = parseBoundedInt(url.searchParams.get("limit"), 20, 1, 50);
    const snapshots = await getGoogleWorkspaceSnapshotsByUserId(session.user.id, limit);

    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(NextResponse.json({ snapshots }), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "google_snapshots_list_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}
