import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { getUserSkillById, uninstallUserSkill, updateUserSkillConfig } from "@/lib/data/db-helpers";
import { getSkillById } from "@/lib/skills-registry";
import { logAuditEvent } from "@/lib/data/audit-log";
import { createApiRequestContext, logApiCompletion, logApiStart, withRequestHeaders } from "@/lib/observability";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ skillId: string }> };

// DELETE /api/skills/[skillId] — uninstall a skill
export async function DELETE(req: NextRequest, { params }: Params) {
  const { skillId } = await params;
  const context = createApiRequestContext(req, "/api/skills/[skillId]");

  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session?.user?.id) {
      logApiStart(context);
      logApiCompletion(context, { status: 401, error: "unauthorized" });
      return withRequestHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), context.requestId);
    }

    context.userId = session.user.id;
    logApiStart(context);

    const skill = getSkillById(skillId);
    if (!skill) {
      logApiCompletion(context, { status: 404, error: "skill_not_found" });
      return withRequestHeaders(NextResponse.json({ error: "skill_not_found" }, { status: 404 }), context.requestId);
    }

    if (skill.builtIn) {
      logApiCompletion(context, { status: 400, error: "cannot_uninstall_builtin" });
      return withRequestHeaders(NextResponse.json({ error: "cannot_uninstall_builtin" }, { status: 400 }), context.requestId);
    }

    await uninstallUserSkill(session.user.id, skillId);
    logAuditEvent({ action: "skill.uninstalled", userId: session.user.id, metadata: { skillId } });
    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(NextResponse.json({ ok: true }), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "skill_uninstall_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: message }, { status: 500 }), context.requestId);
  }
}

// PATCH /api/skills/[skillId] — update config for an installed skill
// body: { config: Record<string,unknown> }
export async function PATCH(req: NextRequest, { params }: Params) {
  const { skillId } = await params;
  const context = createApiRequestContext(req, "/api/skills/[skillId]");

  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session?.user?.id) {
      logApiStart(context);
      logApiCompletion(context, { status: 401, error: "unauthorized" });
      return withRequestHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), context.requestId);
    }

    context.userId = session.user.id;
    logApiStart(context);

    const skill = getSkillById(skillId);
    if (!skill) {
      logApiCompletion(context, { status: 404, error: "skill_not_found" });
      return withRequestHeaders(NextResponse.json({ error: "skill_not_found" }, { status: 404 }), context.requestId);
    }

    const row = await getUserSkillById(session.user.id, skillId);
    if (!row) {
      logApiCompletion(context, { status: 404, error: "skill_not_installed" });
      return withRequestHeaders(NextResponse.json({ error: "skill_not_installed" }, { status: 404 }), context.requestId);
    }

    const body = await req.json() as { config?: unknown };
    if (!body.config || typeof body.config !== "object") {
      logApiCompletion(context, { status: 400, error: "missing_config" });
      return withRequestHeaders(NextResponse.json({ error: "missing_config" }, { status: 400 }), context.requestId);
    }

    const updated = await updateUserSkillConfig(session.user.id, skillId, body.config);
    logAuditEvent({ action: "skill.config_updated", userId: session.user.id, metadata: { skillId } });
    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(NextResponse.json({ skill: updated }), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "skill_config_update_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: message }, { status: 500 }), context.requestId);
  }
}
