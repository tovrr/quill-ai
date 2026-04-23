import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";

export function middleware(req: NextRequest) {
  // Generate a per-request nonce (base64)
  const nonce = crypto.randomBytes(16).toString("base64");

  // Build an enforced CSP that includes the nonce for scripts.
  // Styles still allow 'unsafe-inline' for now to avoid layout regressions; consider migrating to nonce for styles later.
  const connectSrc = process.env.NODE_ENV === "development" ? "'self' ws: wss: http://localhost:* https://vitals.vercel-insights.com https://*.vercel-insights.com" : "'self' wss: https://vitals.vercel-insights.com https://*.vercel-insights.com";
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
  ].join("; ");

  const res = NextResponse.next();
  // Set enforced CSP header (matches nonce used by rendered layout)
  res.headers.set("Content-Security-Policy", csp);

  // Expose the nonce to server components via a cookie readable by `cookies()` in layouts.
  // Cookie is not HttpOnly so server components can access it; set secure in production.
  res.cookies.set("csp-nonce", nonce, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return res;
}

export const config = {
  matcher: "/:path*",
};
