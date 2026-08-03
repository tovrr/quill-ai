import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";

/**
 * Next.js 16 Proxy (replaces deprecated middleware.ts).
 *
 * Responsibilities:
 * 1. Generate a per-request CSP nonce and attach it to the response CSP header
 *    so client-component pages (login, agent, etc.) can hydrate. Without this,
 *    Next.js 16's RSC bootstrap <script> tags are blocked by the strict
 *    `script-src 'self'` policy in next.config.ts and the page stays blank.
 * 2. Expose the same nonce to server components via `x-nonce` request header,
 *    so layout.tsx can put it on its own inline <script> tags.
 *
 * Auth enforcement is intentionally NOT done here (DB calls in Proxy add
 * latency and the Neon adapter isn't Edge-safe). Session-validity checks
 * live in Server Component layouts and route handlers.
 */

function buildCsp(nonce: string, isDev: boolean): string {
  const connectSrc = isDev
    ? "'self' ws: wss: http://localhost:* https://vitals.vercel-insights.com https://*.vercel-insights.com"
    : "'self' wss: https://vitals.vercel-insights.com https://*.vercel-insights.com";

  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}'`;

  const parts = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'", // styles still allow 'unsafe-inline' to avoid layout regressions
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
    "report-uri /api/csp-report",
  ];

  if (!isDev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = crypto.randomBytes(16).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const csp = buildCsp(nonce, isDev);

  // Forward the nonce as a request header so server components (layout.tsx)
  // can read it via `headers()` and put it on their own inline <script> tags.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

// Run on every non-static path so the CSP + nonce are applied app-wide.
// API routes are excluded — they return JSON and don't need CSP script-src.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon-.*\\.png|manifest.webmanifest|.*\\.svg).*)"],
};
