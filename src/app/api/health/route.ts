import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    NEON_AUTH_BASE_URL: process.env.NEON_AUTH_BASE_URL ? "set" : "missing",
    NEON_AUTH_COOKIE_SECRET: process.env.NEON_AUTH_COOKIE_SECRET ? "set" : "missing",
    DATABASE_URL: process.env.DATABASE_URL ? "set" : "missing",
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY ? "set" : "missing",
  });
}
