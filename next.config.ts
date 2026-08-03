import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const isDev = process.env.NODE_ENV === "development";

// Report-only CSP for telemetry; the ENFORCED policy lives in src/proxy.ts
// so it can carry a per-request nonce (required for client-component pages
// to hydrate under the strict script-src policy). The two policies must
// stay in sync — when you add a new source here, add it there too.
function buildCspReportOnlyPolicy(): string {
  const connectSrc = isDev
    ? "'self' ws: wss: http://localhost:* https://vitals.vercel-insights.com https://*.vercel-insights.com"
    : "'self' wss: https://vitals.vercel-insights.com https://*.vercel-insights.com";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
    "report-uri /api/csp-report",
  ].join("; ");
}

const nextConfig: NextConfig = {
  // Remove the X-Powered-By: Next.js header (reduces fingerprinting)
  poweredByHeader: false,

  // Strict image optimization — only allow known external domains via remotePatterns
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  // Turbopack root directory (fixes workspace root inference on some setups)
  turbopack: {
    root: process.cwd(),
  },

  async headers() {
    const cspReportOnly = buildCspReportOnlyPolicy();

    // Note: enforced Content-Security-Policy is intentionally NOT set here.
    // It lives in src/proxy.ts where it can carry a per-request nonce that
    // matches the one Next.js applies to its RSC bootstrap <script> tags.
    // See src/proxy.ts for the buildCsp() implementation.
    const commonHeaders: Array<{ key: string; value: string }> = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
    ];

    if (!isDev) {
      commonHeaders.splice(4, 0, { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
    }

    return [
      {
        source: "/(.*)",
        headers: commonHeaders,
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
