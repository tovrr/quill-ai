import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { deleteChatByUserId, getChatById, getMessagesByChatId } from "@/lib/db-helpers";

interface Params {
  params: Promise<{ chatId: string }>;
}

export async function GET(_: Request, { params }: Params) {
  const sessionData = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
  if (!sessionData?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chatId } = await params;
  const chat = await getChatById(chatId);
  if (!chat || chat.userId !== sessionData.user.id) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  const messages = await getMessagesByChatId(chatId);
  return NextResponse.json({ chat, messages });
}

export async function DELETE(_: Request, { params }: Params) {
  const sessionData = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
  if (!sessionData?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chatId } = await params;
  const deleted = await deleteChatByUserId(chatId, sessionData.user.id);

  if (!deleted) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
