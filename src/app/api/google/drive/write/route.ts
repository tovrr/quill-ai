import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { getGoogleConnectionByUserId, createGoogleWorkspaceSnapshot } from "@/lib/data/db-helpers";
import { logAuditEvent } from "@/lib/data/audit-log";
import { googleFetch } from "@/lib/integrations/google-api";
import { readSafeErrorMessage } from "@/lib/api-security";
import {
  createApiRequestContext,
  logApiCompletion,
  logApiStart,
  withRequestHeaders,
} from "@/lib/observability/logging";

export const dynamic = "force-dynamic";

type DriveFileMeta = {
  id: string;
  name: string;
  mimeType?: string;
  modifiedTime?: string;
  parents?: string[];
  trashed?: boolean;
};

async function fetchDriveFile(userId: string, fileId: string): Promise<DriveFileMeta | null> {
  const res = await googleFetch(
    userId,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,modifiedTime,parents,trashed`
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await readSafeErrorMessage(res));
  }
  return (await res.json()) as DriveFileMeta;
}

export async function POST(req: NextRequest) {
  const context = createApiRequestContext(req, "/api/google/drive/write");
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

    const body = (await req.json()) as { name?: string; parentId?: string };
    const name = body.name?.trim();
    if (!name) {
      logApiCompletion(context, { status: 400, error: "name_required" });
      return withRequestHeaders(NextResponse.json({ error: "name is required" }, { status: 400 }), context.requestId);
    }

    const createRes = await googleFetch(session.user.id, "https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,modifiedTime,parents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.slice(0, 150),
        mimeType: "application/vnd.google-apps.folder",
        ...(body.parentId ? { parents: [body.parentId] } : {}),
      }),
    });

    if (!createRes.ok) {
      const text = await readSafeErrorMessage(createRes);
      logApiCompletion(context, { status: createRes.status, error: "google_drive_create_failed" });
      return withRequestHeaders(NextResponse.json({ error: text }, { status: createRes.status }), context.requestId);
    }

    const created = (await createRes.json()) as DriveFileMeta;

    const snapshot = await createGoogleWorkspaceSnapshot({
      userId: session.user.id,
      resourceType: "drive-file",
      operation: "create",
      resourceId: created.id,
      afterPayload: created,
    });

    logAuditEvent({
      action: "google.drive.created",
      userId: session.user.id,
      requestId: context.requestId,
      targetId: created.id,
      metadata: { snapshotId: snapshot.id },
    });

    logApiCompletion(context, { status: 201 });
    return withRequestHeaders(NextResponse.json({ file: created, snapshotId: snapshot.id }, { status: 201 }), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "google_drive_create_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}

export async function PATCH(req: NextRequest) {
  const context = createApiRequestContext(req, "/api/google/drive/write");
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
      fileId?: string;
      name?: string;
      addParentId?: string;
      removeParentId?: string;
      expectedModifiedTime?: string;
    };

    if (!body.fileId) {
      logApiCompletion(context, { status: 400, error: "file_id_required" });
      return withRequestHeaders(NextResponse.json({ error: "fileId is required" }, { status: 400 }), context.requestId);
    }

    const before = await fetchDriveFile(session.user.id, body.fileId);
    if (!before) {
      logApiCompletion(context, { status: 404, error: "not_found" });
      return withRequestHeaders(NextResponse.json({ error: "File not found" }, { status: 404 }), context.requestId);
    }

    if (body.expectedModifiedTime && before.modifiedTime !== body.expectedModifiedTime) {
      logApiCompletion(context, { status: 409, error: "revision_conflict" });
      return withRequestHeaders(
        NextResponse.json({ error: "revision_conflict", currentModifiedTime: before.modifiedTime }, { status: 409 }),
        context.requestId
      );
    }

    const params = new URLSearchParams({ fields: "id,name,mimeType,modifiedTime,parents" });
    if (body.addParentId) params.set("addParents", body.addParentId);
    if (body.removeParentId) params.set("removeParents", body.removeParentId);

    const patchRes = await googleFetch(
      session.user.id,
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(body.fileId)}?${params.toString()}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(body.name ? { name: body.name.trim().slice(0, 150) } : {}),
        }),
      }
    );

    if (!patchRes.ok) {
      const text = await readSafeErrorMessage(patchRes);
      logApiCompletion(context, { status: patchRes.status, error: "google_drive_update_failed" });
      return withRequestHeaders(NextResponse.json({ error: text }, { status: patchRes.status }), context.requestId);
    }

    const after = (await patchRes.json()) as DriveFileMeta;

    const snapshot = await createGoogleWorkspaceSnapshot({
      userId: session.user.id,
      resourceType: "drive-file",
      operation: body.addParentId || body.removeParentId ? "move" : "rename",
      resourceId: body.fileId,
      beforePayload: before,
      afterPayload: after,
    });

    logAuditEvent({
      action: "google.drive.updated",
      userId: session.user.id,
      requestId: context.requestId,
      targetId: body.fileId,
      metadata: { snapshotId: snapshot.id },
    });

    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(NextResponse.json({ file: after, snapshotId: snapshot.id }), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "google_drive_update_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}

export async function DELETE(req: NextRequest) {
  const context = createApiRequestContext(req, "/api/google/drive/write");
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
    const fileId = url.searchParams.get("fileId") ?? "";
    const expectedModifiedTime = url.searchParams.get("expectedModifiedTime") ?? undefined;
    if (!fileId) {
      logApiCompletion(context, { status: 400, error: "file_id_required" });
      return withRequestHeaders(NextResponse.json({ error: "fileId is required" }, { status: 400 }), context.requestId);
    }

    const before = await fetchDriveFile(session.user.id, fileId);
    if (!before) {
      logApiCompletion(context, { status: 404, error: "not_found" });
      return withRequestHeaders(NextResponse.json({ error: "File not found" }, { status: 404 }), context.requestId);
    }

    if (expectedModifiedTime && before.modifiedTime !== expectedModifiedTime) {
      logApiCompletion(context, { status: 409, error: "revision_conflict" });
      return withRequestHeaders(
        NextResponse.json({ error: "revision_conflict", currentModifiedTime: before.modifiedTime }, { status: 409 }),
        context.requestId
      );
    }

    const deleteRes = await googleFetch(
      session.user.id,
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
      { method: "DELETE" }
    );

    if (!deleteRes.ok) {
      const text = await readSafeErrorMessage(deleteRes);
      logApiCompletion(context, { status: deleteRes.status, error: "google_drive_delete_failed" });
      return withRequestHeaders(NextResponse.json({ error: text }, { status: deleteRes.status }), context.requestId);
    }

    const snapshot = await createGoogleWorkspaceSnapshot({
      userId: session.user.id,
      resourceType: "drive-file",
      operation: "delete",
      resourceId: fileId,
      beforePayload: before,
    });

    logAuditEvent({
      action: "google.drive.deleted",
      userId: session.user.id,
      requestId: context.requestId,
      targetId: fileId,
      metadata: { snapshotId: snapshot.id },
    });

    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(NextResponse.json({ ok: true, snapshotId: snapshot.id }), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "google_drive_delete_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}
