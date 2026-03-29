import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 Proxy (replaces deprecated middleware.ts).
 *
 * Kept intentionally minimal per Next.js 16 guidance:
 * "Avoid relying on Proxy unless no other option exists."
 *
 * Responsibilities:
 * 1. Redirect already-authenticated users away from /login → /agent
 * 2. Inject security headers that cannot be set in next.config.ts (none needed here)
 *
 * Auth enforcement for protected pages is done inside Server Component layouts,
 * not here — DB calls in Proxy add latency and the Neon adapter isn't Edge-safe.
 */

// Cookie name set by Better Auth on sign-in
const SESSION_COOKIE = "better-auth.session_token";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect signed-in users away from /login
  if (pathname === "/login" && request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/agent", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login"],
};
