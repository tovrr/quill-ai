import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remove the X-Powered-By: Next.js header (reduces fingerprinting)
  poweredByHeader: false,

  // Strict image optimization — only allow known external domains via remotePatterns
  images: {
    remotePatterns: [],
  },

  async headers() {
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
        ],
      },
    ];
  },
};

export default nextConfig;
