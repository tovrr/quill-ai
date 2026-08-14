import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { createApiRequestContext, logApiCompletion, logApiStart, withRequestHeaders } from "@/lib/observability/logging";
import { isGithubAppConfigured, getGithubAppInstallUrl } from "@/lib/integrations/github-app";

export const dynamic = "force-dynamic";

// GET /api/github/auth -- redirect user to the GitHub App installation page.
//
// Safe skeleton (Track C.3, ROADMAP.md): returns 503 until a real GitHub
// App is registered and GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY /
// GITHUB_APP_SLUG are all set. See src/lib/integrations/github-app.ts.
export async function GET(req: Request) {
  const context = createApiRequestContext(req, "/api/github/auth");
  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session?.user?.id) {
      logApiStart(context);
      logApiCompletion(context, { status: 401, error: "unauthorized" });
      return withRequestHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), context.requestId);
    }

    context.userId = session.user.id;
    logApiStart(context);

    if (!isGithubAppConfigured()) {
      logApiCompletion(context, { status: 503, error: "github_app_not_configured" });
      return withRequestHeaders(
        NextResponse.json(
          {
            error:
              "GitHub integration is not configured yet. Set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, and GITHUB_APP_SLUG.",
          },
          { status: 503 }
        ),
        context.requestId
      );
    }

    const state = crypto.randomUUID();
    const response = NextResponse.redirect(getGithubAppInstallUrl(state));
    response.cookies.set("quill_github_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });

    logApiCompletion(context, { status: 302 });
    return withRequestHeaders(response, context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "github_oauth_init_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}
