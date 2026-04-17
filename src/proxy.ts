import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 Proxy (replaces deprecated middleware.ts).
 *
 * Kept intentionally minimal per Next.js 16 guidance:
 * "Avoid relying on Proxy unless no other option exists."
 *
 * Responsibilities:
 * 1. Keep a no-op pass-through for /login
 *
 * Auth enforcement and login redirects are done with session-validity checks
 * inside route/page logic, not cookie-presence checks in Proxy.
 *
 * Auth enforcement for protected pages is done inside Server Component layouts,
 * not here — DB calls in Proxy add latency and the Neon adapter isn't Edge-safe.
 */

export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/login"],
};
