import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { getUserSkills, installUserSkill } from "@/lib/data/db-helpers";
import { getSkillById, SKILLS_REGISTRY } from "@/lib/skills-registry";
import { logAuditEvent } from "@/lib/data/audit-log";
import { createApiRequestContext, logApiCompletion, logApiStart, withRequestHeaders } from "@/lib/observability";

export const dynamic = "force-dynamic";

// GET /api/skills — list all skills with user's install status
export async function GET(req: NextRequest) {
  const context = createApiRequestContext(req, "/api/skills");
  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session?.user?.id) {
      logApiStart(context);
      logApiCompletion(context, { status: 401, error: "unauthorized" });
      return withRequestHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), context.requestId);
    }

    context.userId = session.user.id;
    logApiStart(context);

    const installed = await getUserSkills(session.user.id);
    const installedMap = new Map(installed.map((s) => [s.skillId, s]));

    const skills = SKILLS_REGISTRY.map((skill) => {
      const row = installedMap.get(skill.id);
      return {
        ...skill,
        installed: !!row || skill.builtIn === true,
        enabled: row?.enabled ?? skill.builtIn === true,
        config: row?.config ?? null,
        installedAt: row?.installedAt ?? null,
      };
    });

    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(NextResponse.json({ skills }), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "skills_list_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: message }, { status: 500 }), context.requestId);
  }
}

// POST /api/skills — install a skill
// body: { skillId: string; config?: Record<string,unknown> }
export async function POST(req: NextRequest) {
  const context = createApiRequestContext(req, "/api/skills");
  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session?.user?.id) {
      logApiStart(context);
      logApiCompletion(context, { status: 401, error: "unauthorized" });
      return withRequestHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), context.requestId);
    }

    context.userId = session.user.id;
    logApiStart(context);

    const body = await req.json() as { skillId?: unknown; config?: unknown };
    const skillId = typeof body.skillId === "string" ? body.skillId.trim() : null;

    if (!skillId) {
      logApiCompletion(context, { status: 400, error: "missing_skill_id" });
      return withRequestHeaders(NextResponse.json({ error: "missing_skill_id" }, { status: 400 }), context.requestId);
    }

    const skill = getSkillById(skillId);
    if (!skill) {
      logApiCompletion(context, { status: 404, error: "skill_not_found" });
      return withRequestHeaders(NextResponse.json({ error: "skill_not_found" }, { status: 404 }), context.requestId);
    }

    if (skill.status === "coming-soon") {
      logApiCompletion(context, { status: 400, error: "skill_not_available" });
      return withRequestHeaders(NextResponse.json({ error: "skill_not_available" }, { status: 400 }), context.requestId);
    }

    const config = body.config && typeof body.config === "object" ? body.config : undefined;
    const row = await installUserSkill(session.user.id, skillId, config);

    logAuditEvent({ action: "skill.installed", userId: session.user.id, metadata: { skillId } });
    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(NextResponse.json({ skill: row }), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "skill_install_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: message }, { status: 500 }), context.requestId);
  }
}
