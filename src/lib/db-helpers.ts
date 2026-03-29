import { db } from "@/db";
import { chats, messages } from "@/db/schema";
import { eq, desc, and, gte, count } from "drizzle-orm";

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
}: {
  chatId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
}) {
  const [msg] = await db
    .insert(messages)
    .values({ chatId, role, content })
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
