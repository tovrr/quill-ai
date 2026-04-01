import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const isDev = process.env.NODE_ENV === "development";

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
    isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
    "report-uri /api/csp-report",
  ].join("; ");
}

function buildCspEnforcedPolicy(): string {
  const connectSrc = isDev
    ? "'self' ws: wss: http://localhost:* https://vitals.vercel-insights.com https://*.vercel-insights.com"
    : "'self' wss: https://vitals.vercel-insights.com https://*.vercel-insights.com";
  
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ].join("; ");
}

const nextConfig: NextConfig = {
  // Remove the X-Powered-By: Next.js header (reduces fingerprinting)
  poweredByHeader: false,

  // Strict image optimization — only allow known external domains via remotePatterns
  images: {
    remotePatterns: [],
  },

  async headers() {
    const cspReportOnly = buildCspReportOnlyPolicy();
    const cspEnforced = buildCspEnforcedPolicy();

    return [
      {
        // Apply hardening headers to every response
        source: "/(.*)",
        headers: [
          // Prevent MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Deny framing entirely (clickjacking protection)
          { key: "X-Frame-Options", value: "DENY" },
          // Strict referrer — no full URL leakage to third parties
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Disable unused browser features
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // HSTS — force HTTPS for 1 year once deployed
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Phase 2 CSP rollout: enforce policy while keeping report-only telemetry
          {
            key: "Content-Security-Policy",
            value: cspEnforced,
          },
          {
            key: "Content-Security-Policy-Report-Only",
            value: cspReportOnly,
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
