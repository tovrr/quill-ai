import { db } from "@/db";
import { chats, messageFiles, messages, modelUsageEvents, userEntitlements } from "@/db/schema";
import { sanitizeStoredMessage } from "@/lib/assistant-message-utils";
import { eq, desc, and, gte, count } from "drizzle-orm";

const MAX_DB_FILE_BYTES = Number(process.env.MAX_DB_FILE_BYTES ?? "5242880");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseDataUrl(url: string): { mediaType: string; base64: string } | null {
  const match = url.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  return {
    mediaType: match[1] || "application/octet-stream",
    base64: match[2].replace(/\s+/g, ""),
  };
}

function extractTextFromParts(parts: unknown[]): string {
  return parts
    .map((part) => {
      if (!isRecord(part) || part.type !== "text") return "";
      return typeof part.text === "string" ? part.text : "";
    })
    .join("\n")
    .trim();
}

async function persistDurableFileParts(chatId: string, rawParts: unknown[] | undefined): Promise<unknown[] | null> {
  if (!Array.isArray(rawParts) || rawParts.length === 0) return null;

  const nextParts: unknown[] = [];

  for (const rawPart of rawParts) {
    if (!isRecord(rawPart) || rawPart.type !== "file") {
      nextParts.push(rawPart);
      continue;
    }

    const url = typeof rawPart.url === "string" ? rawPart.url : "";
    if (!url || url.startsWith("/api/files/")) {
      nextParts.push(rawPart);
      continue;
    }

    const parsed = parseDataUrl(url);
    if (!parsed) {
      // Keep non-data URLs as-is (remote/provider-hosted URLs).
      nextParts.push(rawPart);
      continue;
    }

    const byteSize = Buffer.from(parsed.base64, "base64").length;
    if (byteSize > MAX_DB_FILE_BYTES) {
      // Too large for DB-backed storage; keep original URL to avoid dropping content.
      nextParts.push(rawPart);
      continue;
    }

    const [stored] = await db
      .insert(messageFiles)
      .values({
        chatId,
        mediaType: typeof rawPart.mediaType === "string" ? rawPart.mediaType : parsed.mediaType,
        filename: typeof rawPart.filename === "string" ? rawPart.filename : null,
        byteSize,
        dataBase64: parsed.base64,
      })
      .returning({ id: messageFiles.id });

    nextParts.push({
      ...rawPart,
      url: `/api/files/${stored.id}`,
    });
  }

  return nextParts;
}

export async function getChatsByUserId(userId: string) {
  return db.query.chats.findMany({
    where: eq(chats.userId, userId),
    orderBy: [desc(chats.updatedAt)],
  });
}

export async function getChatById(chatId: string) {
  return db.query.chats.findFirst({
    where: eq(chats.id, chatId),
  });
}

export async function createChat(userId: string, title: string, id?: string) {
  const [chat] = await db
    .insert(chats)
    .values({ userId, title, ...(id ? { id } : {}) })
    .returning();
  return chat;
}

export async function updateChatTitle(chatId: string, title: string) {
  await db.update(chats).set({ title, updatedAt: new Date() }).where(eq(chats.id, chatId));
}

export async function getMessagesByChatId(chatId: string) {
  return db.query.messages.findMany({
    where: eq(messages.chatId, chatId),
    orderBy: [messages.createdAt],
  });
}

export async function saveMessage({
  chatId,
  role,
  content,
  parts,
}: {
  chatId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  parts?: unknown[];
}) {
  const durableParts = await persistDurableFileParts(chatId, parts);
  const normalized = sanitizeStoredMessage({
    role,
    content,
    parts: durableParts,
  });

  if (normalized.usedFallback) {
    console.warn("[db-helpers] normalized non-renderable assistant message before persistence", {
      chatId,
      originalPartTypes: normalized.originalPartTypes,
    });
  }

  const [msg] = await db
    .insert(messages)
    .values({ chatId, role, content: normalized.content, partsJson: normalized.parts })
    .returning();
  return msg;
}

export async function deleteChat(chatId: string) {
  await db.delete(chats).where(eq(chats.id, chatId));
}

export async function deleteChatByUserId(chatId: string, userId: string) {
  const deleted = await db
    .delete(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .returning({ id: chats.id });

  return deleted.length > 0;
}

export async function countUserMessagesToday(userId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const result = await db
    .select({ value: count() })
    .from(messages)
    .innerJoin(chats, eq(messages.chatId, chats.id))
    .where(
      and(
        eq(chats.userId, userId),
        eq(messages.role, "user"),
        gte(messages.createdAt, startOfDay)
      )
    );

  return result[0]?.value ?? 0;
}

export async function getRecentModelUsage(limit = 200) {
  return db.query.modelUsageEvents.findMany({
    orderBy: [desc(modelUsageEvents.createdAt)],
    limit,
  });
}

export async function getUserEntitlementByUserId(userId: string) {
  return db.query.userEntitlements.findFirst({
    where: eq(userEntitlements.userId, userId),
  });
}

export async function createUserEntitlement(input: {
  userId: string;
  plan: "free" | "trial" | "paid";
  status?: "active" | "expired" | "canceled";
  trialStartedAt?: Date;
  trialEndsAt?: Date;
  paidStartsAt?: Date;
  paidEndsAt?: Date;
}) {
  const [row] = await db
    .insert(userEntitlements)
    .values({
      userId: input.userId,
      plan: input.plan,
      status: input.status ?? "active",
      trialStartedAt: input.trialStartedAt,
      trialEndsAt: input.trialEndsAt,
      paidStartsAt: input.paidStartsAt,
      paidEndsAt: input.paidEndsAt,
    })
    .returning();

  return row;
}

export async function updateUserEntitlement(
  userId: string,
  updates: Partial<{
    plan: "free" | "trial" | "paid";
    status: "active" | "expired" | "canceled";
    trialStartedAt: Date | null;
    trialEndsAt: Date | null;
    paidStartsAt: Date | null;
    paidEndsAt: Date | null;
  }>
) {
  const [row] = await db
    .update(userEntitlements)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(userEntitlements.userId, userId))
    .returning();

  return row;
}
