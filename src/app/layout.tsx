import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// ── Viewport (mobile-first) ───────────────────────────────────────────────────
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",          // iOS safe area support
  themeColor: "#EF4444",
};

// ── App metadata + PWA ────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: "Quill AI — Your Personal AI Agent",
  description:
    "Quill AI is your personal AI agent. Research, write, code, build pages, and execute complex tasks autonomously.",
  keywords: ["AI agent", "personal assistant", "Quill AI", "autonomous AI"],

  // PWA / installable web app
  manifest: "/manifest.webmanifest",
  applicationName: "Quill AI",

  // iOS
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Quill AI",
  },

  // Android / generic
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#EF4444",
    "msapplication-tap-highlight": "no",
  },

  // Open Graph (for sharing)
  openGraph: {
    title: "Quill AI",
    description: "Your personal AI agent",
    type: "website",
  },

  // Icons
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Preconnect for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className={`${inter.variable} antialiased font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
