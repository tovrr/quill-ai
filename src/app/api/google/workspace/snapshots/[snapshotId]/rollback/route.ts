import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import {
  getGoogleConnectionByUserId,
  getGoogleWorkspaceSnapshotById,
  createGoogleWorkspaceSnapshot,
} from "@/lib/data/db-helpers";
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

type SnapshotPayload = {
  documentId?: string;
  title?: string;
  text?: string;
  name?: string;
  parents?: string[];
  mimeType?: string;
};

async function replaceDocText(userId: string, documentId: string, text: string) {
  const getRes = await googleFetch(
    userId,
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`
  );
  if (!getRes.ok) {
    throw new Error(await readSafeErrorMessage(getRes));
  }

  const current = (await getRes.json()) as {
    revisionId?: string;
    body?: { content?: Array<{ endIndex?: number }> };
  };

  let endIndex = 1;
  for (const block of current.body?.content ?? []) {
    if (typeof block.endIndex === "number") endIndex = Math.max(endIndex, block.endIndex);
  }

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
  if (text.length > 0) {
    requests.push({
      insertText: {
        location: { index: 1 },
        text: text.slice(0, 200000),
      },
    });
  }

  const updateRes = await googleFetch(
    userId,
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests,
        ...(current.revisionId ? { writeControl: { requiredRevisionId: current.revisionId } } : {}),
      }),
    }
  );

  if (!updateRes.ok) {
    throw new Error(await readSafeErrorMessage(updateRes));
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ snapshotId: string }> }
) {
  const context = createApiRequestContext(req, "/api/google/workspace/snapshots/[snapshotId]/rollback");
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

    const { snapshotId } = await params;
    const snapshot = await getGoogleWorkspaceSnapshotById(snapshotId);
    if (!snapshot || snapshot.userId !== session.user.id) {
      logApiCompletion(context, { status: 404, error: "not_found" });
      return withRequestHeaders(NextResponse.json({ error: "Snapshot not found" }, { status: 404 }), context.requestId);
    }

    const before = (snapshot.beforePayload ?? null) as SnapshotPayload | null;
    const after = (snapshot.afterPayload ?? null) as SnapshotPayload | null;

    if (snapshot.resourceType === "google-doc") {
      if (snapshot.operation === "create") {
        if (!snapshot.resourceId) {
          logApiCompletion(context, { status: 400, error: "invalid_snapshot" });
          return withRequestHeaders(NextResponse.json({ error: "Snapshot missing resourceId" }, { status: 400 }), context.requestId);
        }

        const deleteRes = await googleFetch(
          session.user.id,
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(snapshot.resourceId)}`,
          { method: "DELETE" }
        );

        if (!deleteRes.ok) {
          const text = await readSafeErrorMessage(deleteRes);
          logApiCompletion(context, { status: deleteRes.status, error: "rollback_delete_failed" });
          return withRequestHeaders(NextResponse.json({ error: text }, { status: deleteRes.status }), context.requestId);
        }
      } else if (snapshot.operation === "update") {
        if (!snapshot.resourceId || typeof before?.text !== "string") {
          logApiCompletion(context, { status: 400, error: "invalid_snapshot" });
          return withRequestHeaders(NextResponse.json({ error: "Snapshot missing previous text" }, { status: 400 }), context.requestId);
        }
        await replaceDocText(session.user.id, snapshot.resourceId, before.text);
      } else if (snapshot.operation === "delete") {
        if (!before?.title) {
          logApiCompletion(context, { status: 400, error: "invalid_snapshot" });
          return withRequestHeaders(NextResponse.json({ error: "Snapshot missing deleted title" }, { status: 400 }), context.requestId);
        }

        const createRes = await googleFetch(session.user.id, "https://docs.googleapis.com/v1/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: before.title.slice(0, 150) }),
        });
        if (!createRes.ok) {
          const text = await readSafeErrorMessage(createRes);
          logApiCompletion(context, { status: createRes.status, error: "rollback_recreate_failed" });
          return withRequestHeaders(NextResponse.json({ error: text }, { status: createRes.status }), context.requestId);
        }

        const created = (await createRes.json()) as { documentId: string };
        if (before.text && before.text.trim()) {
          await replaceDocText(session.user.id, created.documentId, before.text);
        }
      }
    } else {
      if (snapshot.operation === "create") {
        if (!snapshot.resourceId) {
          logApiCompletion(context, { status: 400, error: "invalid_snapshot" });
          return withRequestHeaders(NextResponse.json({ error: "Snapshot missing resourceId" }, { status: 400 }), context.requestId);
        }

        const deleteRes = await googleFetch(
          session.user.id,
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(snapshot.resourceId)}`,
          { method: "DELETE" }
        );
        if (!deleteRes.ok) {
          const text = await readSafeErrorMessage(deleteRes);
          logApiCompletion(context, { status: deleteRes.status, error: "rollback_delete_failed" });
          return withRequestHeaders(NextResponse.json({ error: text }, { status: deleteRes.status }), context.requestId);
        }
      } else if (snapshot.operation === "rename" || snapshot.operation === "move") {
        if (!snapshot.resourceId || !before) {
          logApiCompletion(context, { status: 400, error: "invalid_snapshot" });
          return withRequestHeaders(NextResponse.json({ error: "Snapshot missing previous metadata" }, { status: 400 }), context.requestId);
        }

        const addParents = before.parents?.join(",") ?? "";
        const removeParents = after?.parents?.join(",") ?? "";
        const params = new URLSearchParams({ fields: "id,name,parents" });
        if (addParents) params.set("addParents", addParents);
        if (removeParents) params.set("removeParents", removeParents);

        const patchRes = await googleFetch(
          session.user.id,
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(snapshot.resourceId)}?${params.toString()}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(before.name ? { name: before.name } : {}),
            }),
          }
        );

        if (!patchRes.ok) {
          const text = await readSafeErrorMessage(patchRes);
          logApiCompletion(context, { status: patchRes.status, error: "rollback_update_failed" });
          return withRequestHeaders(NextResponse.json({ error: text }, { status: patchRes.status }), context.requestId);
        }
      } else if (snapshot.operation === "delete") {
        if (!before?.name) {
          logApiCompletion(context, { status: 400, error: "invalid_snapshot" });
          return withRequestHeaders(NextResponse.json({ error: "Snapshot missing deleted metadata" }, { status: 400 }), context.requestId);
        }

        const recreateRes = await googleFetch(session.user.id, "https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,parents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: before.name,
            ...(before.mimeType ? { mimeType: before.mimeType } : {}),
            ...(before.parents && before.parents.length > 0 ? { parents: before.parents } : {}),
          }),
        });

        if (!recreateRes.ok) {
          const text = await readSafeErrorMessage(recreateRes);
          logApiCompletion(context, { status: recreateRes.status, error: "rollback_recreate_failed" });
          return withRequestHeaders(NextResponse.json({ error: text }, { status: recreateRes.status }), context.requestId);
        }
      }
    }

    const rollbackSnapshot = await createGoogleWorkspaceSnapshot({
      userId: session.user.id,
      resourceType: snapshot.resourceType,
      operation: "update",
      resourceId: snapshot.resourceId ?? undefined,
      beforePayload: snapshot.afterPayload ?? undefined,
      afterPayload: snapshot.beforePayload ?? undefined,
    });

    logAuditEvent({
      action: "google.workspace.rollback",
      userId: session.user.id,
      requestId: context.requestId,
      targetId: snapshot.resourceId ?? snapshot.id,
      metadata: {
        sourceSnapshotId: snapshot.id,
        rollbackSnapshotId: rollbackSnapshot.id,
      },
    });

    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(NextResponse.json({ ok: true, rollbackSnapshotId: rollbackSnapshot.id }), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "google_snapshot_rollback_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}
