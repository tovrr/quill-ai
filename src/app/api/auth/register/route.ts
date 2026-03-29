import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string; name?: string };
    const email = body.email?.trim().toLowerCase();
    const name = body.name?.trim();

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    // Check if user already exists
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existing) {
      // Return success — the sign-in flow will handle it
      return NextResponse.json({ ok: true, existing: true });
    }

    // Create new user
    await db.insert(users).values({
      email,
      name: name ?? email.split("@")[0],
    });

    return NextResponse.json({ ok: true, existing: false });
  } catch (err) {
    console.error("[register]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
