import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { getGoogleConnectionByUserId } from "@/lib/data/db-helpers";
import { parseBoundedInt, readSafeErrorMessage } from "@/lib/api-security";
import { googleFetch } from "@/lib/integrations/google-api";
import { createApiRequestContext, logApiCompletion, logApiStart, withRequestHeaders } from "@/lib/observability";

export const dynamic = "force-dynamic";

// GET /api/google/calendar/events?maxResults=10&timeMin=...
export async function GET(req: NextRequest) {
  const context = createApiRequestContext(req, "/api/google/calendar/events");
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
    const maxResults = parseBoundedInt(url.searchParams.get("maxResults"), 10, 1, 50);
    const rawTimeMin = url.searchParams.get("timeMin");
    const timeMin = rawTimeMin && !Number.isNaN(Date.parse(rawTimeMin))
      ? new Date(rawTimeMin).toISOString()
      : new Date().toISOString();

    const calParams = new URLSearchParams({
      maxResults: String(maxResults),
      timeMin,
      singleEvents: "true",
      orderBy: "startTime",
      fields: "items(id,summary,start,end,htmlLink,location,description,attendees)",
    });

    const res = await googleFetch(
      session.user.id,
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${calParams.toString()}`
    );

    if (!res.ok) {
      const text = await readSafeErrorMessage(res);
      logApiCompletion(context, { status: res.status, error: "google_calendar_upstream_failed" });
      return withRequestHeaders(NextResponse.json({ error: text }, { status: res.status }), context.requestId);
    }

    const data = await res.json();
    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(NextResponse.json(data), context.requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "google_calendar_failed";
    logApiCompletion(context, { status: 500, error: message });
    return withRequestHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }), context.requestId);
  }
}
