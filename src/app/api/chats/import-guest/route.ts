import { NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth/server";
import { createChat, getChatById, saveMessage, updateChatTitle } from "@/lib/db-helpers";
import {
  createApiRequestContext,
  logApiCompletion,
  logApiStart,
  withRequestHeaders,
} from "@/lib/observability";

type GuestMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
};

type ImportPayload = {
  chatId?: string;
  messages?: GuestMessage[];
};

function truncateTitle(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "Imported chat";
  return trimmed.length > 80 ? `${trimmed.slice(0, 80)}...` : trimmed;
}

function normalizeMessages(input: unknown): GuestMessage[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const role = (item as { role?: unknown }).role;
      const content = (item as { content?: unknown }).content;

      if (role !== "user" && role !== "assistant" && role !== "system" && role !== "tool") {
        return null;
      }

      if (typeof content !== "string") return null;
      const normalized = content.trim();
      if (!normalized) return null;

      return { role, content: normalized } as GuestMessage;
    })
    .filter((entry): entry is GuestMessage => Boolean(entry));
}

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const context = createApiRequestContext(req, "/api/chats/import-guest");
  logApiStart(context);

  try {
    const sessionData = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
    if (!sessionData?.user?.id) {
      const unauthorized = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      logApiCompletion(context, { status: 401, error: "unauthorized" });
      return withRequestHeaders(unauthorized, context.requestId);
    }

    const userId = sessionData.user.id;
    context.userId = userId;

    const body = (await req.json().catch(() => ({}))) as ImportPayload;
    const messages = normalizeMessages(body.messages);

    if (messages.length === 0) {
      const badReq = NextResponse.json({ error: "No importable messages" }, { status: 400 });
      logApiCompletion(context, { status: 400, error: "no_messages" });
      return withRequestHeaders(badReq, context.requestId);
    }

    let chatId = body.chatId;
    if (chatId) {
      const existing = await getChatById(chatId);
      if (!existing || existing.userId !== userId) {
        chatId = undefined;
      }
    }

    const firstUserMessage = messages.find((m) => m.role === "user")?.content ?? "Imported chat";

    if (!chatId) {
      const created = await createChat(userId, truncateTitle(firstUserMessage));
      chatId = created.id;
    }

    for (const message of messages) {
      await saveMessage({
        chatId,
        role: message.role,
        content: message.content,
      });
    }

    await updateChatTitle(chatId, truncateTitle(firstUserMessage));

    const res = NextResponse.json({ ok: true, chatId, importedCount: messages.length }, { status: 200 });
    logApiCompletion(context, { status: 200 });
    return withRequestHeaders(res, context.requestId);
  } catch {
    const errorRes = NextResponse.json({ error: "Failed to import guest conversation" }, { status: 500 });
    logApiCompletion(context, { status: 500, error: "import_failed" });
    return withRequestHeaders(errorRes, context.requestId);
  }
}
