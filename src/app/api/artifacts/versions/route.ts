import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { parseBoundedInt } from "@/lib/api-security";
import { logAuditEvent } from "@/lib/audit-log";
import {
  createApiRequestContext,
  logApiCompletion,
  logApiStart,
  withRequestHeaders,
} from "@/lib/observability";
import {
  getArtifactVersionsByUserId,
  createArtifactVersion,
} from "@/lib/db-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const context = createApiRequestContext(req, "/api/artifacts/versions");

  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session?.user?.id) {
      logApiStart(context);
      logApiCompletion(context, { status: 401, error: "unauthorized" });
      return withRequestHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), context.requestId);
    }

    context.userId = session.user.id;
    logApiStart(context);

    const url = new URL(req.url);
    const limit = parseBoundedInt(url.searchParams.get("limit"), 50, 1, 100);

    const versions = await getArtifactVersionsByUserId(session.user.id, limit);
    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(NextResponse.json({ versions }), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "artifact_versions_get_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}

export async function POST(req: NextRequest) {
  const context = createApiRequestContext(req, "/api/artifacts/versions");

  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session?.user?.id) {
      logApiStart(context);
      logApiCompletion(context, { status: 401, error: "unauthorized" });
      return withRequestHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), context.requestId);
    }

    context.userId = session.user.id;
    logApiStart(context);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      logApiCompletion(context, { status: 400, error: "invalid_json" });
      return withRequestHeaders(NextResponse.json({ error: "Invalid JSON" }, { status: 400 }), context.requestId);
    }

    if (
      typeof body !== "object" ||
      body === null ||
      typeof (body as Record<string, unknown>).title !== "string" ||
      typeof (body as Record<string, unknown>).artifactType !== "string" ||
      !(body as Record<string, unknown>).payload
    ) {
      logApiCompletion(context, { status: 400, error: "missing_required_fields" });
      return withRequestHeaders(NextResponse.json({ error: "Missing required fields" }, { status: 400 }), context.requestId);
    }

    const { title, artifactType, payload, chatId } = body as {
      title: string;
      artifactType: string;
      payload: unknown;
      chatId?: string;
    };

    const validTypes = ["page", "react-app", "nextjs-bundle", "document"];
    if (!validTypes.includes(artifactType)) {
      logApiCompletion(context, { status: 400, error: "invalid_artifact_type" });
      return withRequestHeaders(NextResponse.json({ error: "Invalid artifactType" }, { status: 400 }), context.requestId);
    }

    const version = await createArtifactVersion({
      userId: session.user.id,
      chatId,
      title: title.slice(0, 120),
      artifactType: artifactType as "page" | "react-app" | "nextjs-bundle" | "document",
      payload,
    });

    logAuditEvent({
      action: "artifact.version.created",
      userId: session.user.id,
      requestId: context.requestId,
      targetId: version.id,
      metadata: {
        artifactType: version.artifactType,
      },
    });

    logApiCompletion(context, { status: 201 });
    return withRequestHeaders(NextResponse.json({ version }, { status: 201 }), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "artifact_version_create_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}
