import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { getGoogleConnectionByUserId } from "@/lib/data/db-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conn = await getGoogleConnectionByUserId(session.user.id);
  if (!conn) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    email: conn.email,
    displayName: conn.displayName,
    scopes: conn.scopes,
    connectedAt: conn.createdAt,
  });
}
