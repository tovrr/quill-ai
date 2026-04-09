import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { deleteChatByUserId, getChatById, getMessagesByChatId, updateChatTitle } from "@/lib/db-helpers";

interface Params {
  params: Promise<{ chatId: string }>;
}

function normalizeTitle(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const normalized = input.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.length > 64 ? `${normalized.slice(0, 64).trimEnd()}...` : normalized;
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

export async function PATCH(request: Request, { params }: Params) {
  const sessionData = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
  if (!sessionData?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chatId } = await params;
  const chat = await getChatById(chatId);
  if (!chat || chat.userId !== sessionData.user.id) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { title?: unknown } | null;
  const title = normalizeTitle(body?.title);
  if (!title) {
    return NextResponse.json({ error: "Invalid title" }, { status: 400 });
  }

  await updateChatTitle(chatId, title);
  return NextResponse.json({ ok: true, title });
}
