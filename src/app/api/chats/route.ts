import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { getChatsByUserId } from "@/lib/data/db-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessionData = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
  if (!sessionData?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const chats = await getChatsByUserId(sessionData.user.id);
  return NextResponse.json(chats);
}
