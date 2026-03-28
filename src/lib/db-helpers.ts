import { db } from "@/db";
import { chats, messages } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

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
