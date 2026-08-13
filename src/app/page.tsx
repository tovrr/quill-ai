import type { Metadata } from "next";
import Link from "next/link";
import { QuillLogo } from "@/components/ui/QuillLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HeroInput } from "@/components/HeroInput";

export const metadata: Metadata = {
  title: "Quill AI — Familiar AI Agents, Trusted by Design",
  description:
    "Quill gives teams a familiar AI agent workflow with a secure control plane. Run cloud and local models with policy, routing, identity, and cost controls in one place.",
  keywords: [
    "AI agent",
    "personal AI assistant",
    "autonomous AI",
    "AI research tool",
    "AI coding assistant",
    "Quill AI",
    "AI task automation",
  ],
  openGraph: {
    title: "Quill AI — Secure Control Plane for AI Agents",
    description:
      "Familiar AI agent UX with policy-first control, smart routing, and auditability across cloud and local models.",
    type: "website",
    url: "https://quill.ai",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Quill AI social preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Quill AI — Familiar AI Agents, Trusted by Design",
    description: "Run cloud and local agents with policy, routing, and cost controls.",
    images: ["/twitter-image"],
  },
  alternates: {
    canonical: "https://quill.ai",
  },
};

// MiniMax-style minimal home: nav + centered input, nothing else.
// Marketing content (features, specialist agents, how-it-works, examples, big CTA)
// lives at /about. See ROADMAP.md Track B.1.
export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-quill-bg text-quill-text">
      {/* Nav */}
      <nav className="shrink-0 border-b border-quill-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <QuillLogo size={24} />
            <span className="text-base font-semibold gradient-text tracking-tight">Quill AI</span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/about"
              className="max-sm:hidden flex items-center h-9 px-3 rounded-xl text-sm text-quill-muted hover:text-quill-text hover:bg-quill-border transition-all"
            >
              About
            </Link>
            <ThemeToggle className="h-9 w-9" />
            <Link
              href="/login"
              className="max-sm:hidden flex items-center h-9 px-3 rounded-xl text-sm text-quill-muted hover:text-quill-text hover:bg-quill-border transition-all"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="flex items-center h-9 px-4 rounded-xl bg-quill-accent hover:bg-quill-accent-2 text-white text-sm font-medium transition-all shadow-lg shadow-[var(--color-quill-glow-22)] active:scale-95"
            >
              Try Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Centered input, no marketing */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6">
        <div
          className="hero-glow pointer-events-none absolute left-1/2 top-1/3 h-100 w-150 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 sm:h-125 sm:w-200"
          style={{ background: "radial-gradient(ellipse at center, var(--color-quill-accent) 0%, transparent 70%)" }}
        />

        <h1 className="relative max-w-3xl text-center text-3xl font-bold tracking-tight leading-[1.15] sm:text-5xl">
          Familiar <span className="gradient-text">AI Agents</span>, Trusted by Design
        </h1>

        <div className="relative mt-6 flex w-full max-w-2xl flex-col items-center gap-3 px-4 sm:mt-8 sm:px-0">
          <HeroInput />
          <p className="text-xs text-quill-muted">
            Already have an account?{" "}
            <Link href="/login" className="text-quill-accent hover:text-quill-accent-2 transition-colors">
              Sign in
            </Link>
            {" · "}
            <Link href="/about" className="text-quill-accent hover:text-quill-accent-2 transition-colors">
              Learn more
            </Link>
          </p>
        </div>
      </main>

      {/* Minimal footer */}
      <footer className="shrink-0 border-t border-quill-border px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs text-quill-muted">© 2026 Quill AI. Familiar AI agents, trusted by design.</p>
          <div className="flex gap-5 text-xs text-quill-muted">
            <Link href="/about" className="hover:text-quill-text transition-colors">
              About
            </Link>
            <Link href="/pricing" className="hover:text-quill-text transition-colors">
              Pricing
            </Link>
            <Link href="/docs" className="hover:text-quill-text transition-colors">
              Docs
            </Link>
            <Link href="/privacy" className="hover:text-quill-text transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-quill-text transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
