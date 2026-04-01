import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { headers as nextHeaders } from "next/headers";
import { db } from "@/db";
import { chats, messageFiles } from "@/db/schema";
import { auth } from "@/lib/auth/server";

interface Params {
  params: Promise<{ fileId: string }>;
}

function sanitizeFilename(input: string | null): string {
  if (!input) return "attachment";
  return input.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "attachment";
}

export async function GET(_: Request, { params }: Params) {
  const sessionData = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
  if (!sessionData?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileId } = await params;

  const file = await db.query.messageFiles.findFirst({
    where: eq(messageFiles.id, fileId),
  });

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const chat = await db.query.chats.findFirst({
    where: eq(chats.id, file.chatId),
    columns: { userId: true },
  });

  if (!chat || chat.userId !== sessionData.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const bytes = Buffer.from(file.dataBase64, "base64");
  const filename = sanitizeFilename(file.filename);

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": file.mediaType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename=\"${filename}\"`,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
