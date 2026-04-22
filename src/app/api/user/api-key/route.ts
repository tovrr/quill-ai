/**
 * GET  /api/user/api-key  → list API keys for current user
 * POST /api/user/api-key  → generate a new API key (returns plaintext once)
 * DELETE /api/user/api-key?id=<id> → revoke a key
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { db } from "@/db";
import { userApiKeys } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";

export const dynamic = "force-dynamic";

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function GET() {
  const sessionData = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
  if (!sessionData?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = await db.query.userApiKeys.findMany({
    where: eq(userApiKeys.userId, sessionData.user.id),
    columns: { id: true, label: true, createdAt: true, lastUsedAt: true },
  });

  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const sessionData = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
  if (!sessionData?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let label = "default";
  try {
    const body = (await req.json()) as { label?: string };
    if (typeof body.label === "string" && body.label.trim()) {
      label = body.label.trim().slice(0, 64);
    }
  } catch {
    // no body — use default label
  }

  const rawKey = `qak_${randomBytes(32).toString("hex")}`;
  const hash = hashKey(rawKey);

  await db.insert(userApiKeys).values({
    userId: sessionData.user.id,
    label,
    keyHash: hash,
  });

  // Return plaintext key ONCE — not stored, cannot be recovered
  return NextResponse.json({ key: rawKey, label }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const sessionData = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
  if (!sessionData?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await db
    .delete(userApiKeys)
    .where(and(eq(userApiKeys.id, id), eq(userApiKeys.userId, sessionData.user.id)));

  return NextResponse.json({ ok: true });
}
