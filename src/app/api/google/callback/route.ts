import { NextRequest, NextResponse } from "next/server";
import { upsertGoogleConnection } from "@/lib/data/db-helpers";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { logAuditEvent } from "@/lib/data/audit-log";
import { createApiRequestContext, logApiCompletion, logApiStart, withRequestHeaders } from "@/lib/observability";

export const dynamic = "force-dynamic";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? "";

// GET /api/google/callback — exchange OAuth code for tokens
export async function GET(req: NextRequest) {
  const context = createApiRequestContext(req, "/api/google/callback");
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session?.user?.id) {
    logApiStart(context);
    logApiCompletion(context, { status: 401, error: "unauthorized" });
    return withRequestHeaders(NextResponse.redirect(new URL("/workspace?error=google_unauthorized", req.url)), context.requestId);
  }

  context.userId = session.user.id;
  logApiStart(context);

  const cookieState = req.cookies.get("quill_google_oauth_state")?.value;
  if (!state || !cookieState || state !== cookieState) {
    logApiCompletion(context, { status: 400, error: "oauth_state_mismatch" });
    return withRequestHeaders(NextResponse.redirect(new URL("/workspace?error=google_state", req.url)), context.requestId);
  }

  if (error) {
    logApiCompletion(context, { status: 302, error: "google_denied" });
    return withRequestHeaders(NextResponse.redirect(new URL("/workspace?error=google_denied", req.url)), context.requestId);
  }

  if (!code) {
    logApiCompletion(context, { status: 302, error: "google_invalid" });
    return withRequestHeaders(NextResponse.redirect(new URL("/workspace?error=google_invalid", req.url)), context.requestId);
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    logApiCompletion(context, { status: 302, error: "google_misconfigured" });
    return withRequestHeaders(NextResponse.redirect(new URL("/workspace?error=google_misconfigured", req.url)), context.requestId);
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenRes.ok) {
      logApiCompletion(context, { status: 302, error: "google_token_failed" });
      return withRequestHeaders(NextResponse.redirect(new URL("/workspace?error=google_token_failed", req.url)), context.requestId);
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      id_token?: string;
    };

    // Decode id_token to get email/name without an extra API call
    let email: string | undefined;
    let displayName: string | undefined;
    if (tokenData.id_token) {
      try {
        const parts = tokenData.id_token.split(".");
        const payload = JSON.parse(
          Buffer.from(parts[1] ?? "", "base64url").toString("utf8")
        ) as Record<string, unknown>;
        if (typeof payload.email === "string") email = payload.email;
        if (typeof payload.name === "string") displayName = payload.name;
      } catch {
        // Non-critical — skip if decode fails
      }
    }

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : undefined;

    await upsertGoogleConnection({
      userId: session.user.id,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
      email,
      displayName,
      scopes: tokenData.scope,
    });

    logAuditEvent({
      action: "google.connection.created",
      userId: session.user.id,
      requestId: context.requestId,
      metadata: {
        hasRefreshToken: Boolean(tokenData.refresh_token),
      },
    });

    const response = NextResponse.redirect(new URL("/workspace?connected=1", req.url));
    response.cookies.delete("quill_google_oauth_state");
    logApiCompletion(context, { status: 302 });
    return withRequestHeaders(response, context.requestId);
  } catch {
    logApiCompletion(context, { status: 302, error: "google_unknown" });
    return withRequestHeaders(NextResponse.redirect(new URL("/workspace?error=google_unknown", req.url)), context.requestId);
  }
}
