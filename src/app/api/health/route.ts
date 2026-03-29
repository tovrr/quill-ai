import { NextResponse } from "next/server";

// Public health-check — returns HTTP 200 only. No internal env var enumeration.
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
