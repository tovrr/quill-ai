import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { getChatById, getMessagesByChatId } from "@/lib/db-helpers";
import {
  extractTextFromMessageParts,
  getMessagePartTypes,
  hasRenderableAssistantContent,
  isRenderableMessagePart,
} from "@/lib/ai/assistant-message-utils";

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

  const auditRows = messages.map((message) => {
    const rawParts =
      Array.isArray(message.partsJson) && message.partsJson.length > 0
        ? message.partsJson
        : [{ type: "text", text: message.content }];

    const partTypes = getMessagePartTypes(rawParts);
    const renderablePartCount = rawParts.filter((part) => isRenderableMessagePart(part)).length;
    const textPreview = extractTextFromMessageParts(rawParts).slice(0, 160);

    const assistantRenderable =
      message.role === "assistant"
        ? hasRenderableAssistantContent({ role: "assistant", parts: rawParts })
        : null;

    return {
      id: message.id,
      role: message.role,
      createdAt: message.createdAt,
      partTypes,
      renderablePartCount,
      textPreview,
      assistantRenderable,
      willUseAssistantFallback: message.role === "assistant" ? !assistantRenderable : false,
    };
  });

  const summary = {
    total: auditRows.length,
    assistantMessages: auditRows.filter((row) => row.role === "assistant").length,
    assistantFallbackCandidates: auditRows.filter((row) => row.willUseAssistantFallback).length,
    assistantWithoutRenderableParts: auditRows.filter(
      (row) => row.role === "assistant" && row.renderablePartCount === 0,
    ).length,
  };

  return NextResponse.json({
    chatId,
    summary,
    messages: auditRows,
  });
}
