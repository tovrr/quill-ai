import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { logAuditEvent } from "@/lib/data/audit-log";
import {
  createApiRequestContext,
  logApiCompletion,
  logApiStart,
  withRequestHeaders,
} from "@/lib/observability";
import {
  getArtifactVersionById,
  deleteArtifactVersionByUserId,
} from "@/lib/data/db-helpers";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const context = createApiRequestContext(req, "/api/artifacts/versions/[versionId]");
  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session?.user?.id) {
      logApiStart(context);
      logApiCompletion(context, { status: 401, error: "unauthorized" });
      return withRequestHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), context.requestId);
    }

    context.userId = session.user.id;
    logApiStart(context);

    const { versionId } = await params;
    const version = await getArtifactVersionById(versionId);
    if (!version || version.userId !== session.user.id) {
      logApiCompletion(context, { status: 404, error: "not_found" });
      return withRequestHeaders(NextResponse.json({ error: "Not found" }, { status: 404 }), context.requestId);
    }

    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(NextResponse.json({ version }), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "artifact_version_get_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const context = createApiRequestContext(req, "/api/artifacts/versions/[versionId]");
  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session?.user?.id) {
      logApiStart(context);
      logApiCompletion(context, { status: 401, error: "unauthorized" });
      return withRequestHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), context.requestId);
    }

    context.userId = session.user.id;
    logApiStart(context);

    const { versionId } = await params;
    const deleted = await deleteArtifactVersionByUserId(versionId, session.user.id);
    if (!deleted) {
      logApiCompletion(context, { status: 404, error: "not_found" });
      return withRequestHeaders(NextResponse.json({ error: "Not found" }, { status: 404 }), context.requestId);
    }

    logAuditEvent({
      action: "artifact.version.deleted",
      userId: session.user.id,
      requestId: context.requestId,
      targetId: versionId,
    });

    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(NextResponse.json({ ok: true }), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "artifact_version_delete_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}
