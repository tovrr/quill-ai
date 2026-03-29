import type { Metadata } from "next";
import Link from "next/link";
import { QuillLogo } from "@/components/ui/QuillLogo";

export const metadata: Metadata = {
  title: "Documentation — Quill AI",
  description: "Learn how to get the most out of Quill AI. Guides, references, and tips.",
};

const sections = [
  {
    category: "Getting Started",
    color: "#EF4444",
    articles: [
      { title: "What is Quill AI?", desc: "An overview of what Quill is, what it can do, and who it's for.", slug: "what-is-quill" },
      { title: "Creating your account", desc: "How to sign up, sign in, and manage your profile.", slug: "account-setup" },
      { title: "Your first task", desc: "Send your first message and understand how Quill responds.", slug: "first-task" },
      { title: "Understanding plans", desc: "Which features are available on Free, Think, and Pro.", slug: "plans" },
    ],
  },
  {
    category: "Core Features",
    color: "#f59e0b",
    articles: [
      { title: "Modes: Fast, Think, Pro", desc: "When to use each model mode and what to expect.", slug: "model-modes" },
      { title: "Web Search", desc: "How Quill searches the web and uses live results in responses.", slug: "web-search" },
      { title: "File attachments", desc: "Supported file types, size limits, and how Quill reads them.", slug: "file-attachments" },
      { title: "Image generation", desc: "Generate images with Imagen 4 directly from the chat input.", slug: "image-generation" },
      { title: "Canvas mode", desc: "Split-pane document view for reviewing long-form AI output.", slug: "canvas-mode" },
    ],
  },
  {
    category: "Specialist Agents",
    color: "#10b981",
    articles: [
      { title: "What are Killers?", desc: "How specialist agents work and when to use them.", slug: "killers-overview" },
      { title: "Code Wizard", desc: "Full-stack engineering, debugging, and architecture.", slug: "killer-code" },
      { title: "Flow Master", desc: "Productivity coaching, systems, and workflow design.", slug: "killer-flow" },
      { title: "Idea Factory", desc: "Creative brainstorming and unconventional ideation.", slug: "killer-idea" },
      { title: "Deep Dive", desc: "Research, competitive analysis, and synthesized insights.", slug: "killer-research" },
      { title: "Pen Master", desc: "Writing, copywriting, and content creation.", slug: "killer-pen" },
    ],
  },
  {
    category: "Account & Billing",
    color: "#06b6d4",
    articles: [
      { title: "Managing your subscription", desc: "Upgrade, downgrade, or cancel your plan anytime.", slug: "subscription" },
      { title: "Usage limits", desc: "How message and feature limits work per plan.", slug: "usage-limits" },
      { title: "Billing and invoices", desc: "Payment methods, receipts, and billing cycles.", slug: "billing" },
      { title: "Delete your account", desc: "How to permanently remove your data from Quill.", slug: "delete-account" },
    ],
  },
  {
    category: "Privacy & Security",
    color: "#f472b6",
    articles: [
      { title: "How your data is used", desc: "What we store, why, and for how long.", slug: "data-usage" },
      { title: "Data export", desc: "Download all your conversation history and account data.", slug: "data-export" },
      { title: "Security practices", desc: "How we protect your data in transit and at rest.", slug: "security" },
    ],
  },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-quill-bg text-quill-text">
      {/* Nav */}
      <nav className="border-b border-quill-border px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <QuillLogo size={22} />
          <span className="text-sm font-semibold gradient-text tracking-tight">Quill AI</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xs text-quill-muted hover:text-quill-text transition-colors hidden sm:block">← Home</Link>
          <Link
            href="/login"
            className="flex items-center h-8 px-3 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-medium transition-all"
          >
            Try free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="border-b border-quill-border px-4 sm:px-6 py-12 sm:py-16 text-center" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.06) 0%, transparent 70%)" }}>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Documentation</h1>
        <p className="text-quill-muted text-base sm:text-lg max-w-xl mx-auto">
          Everything you need to get the most out of Quill AI.
        </p>

        {/* Search placeholder */}
        <div className="mt-6 max-w-md mx-auto">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-quill-surface border border-quill-border text-sm text-[#4a4a6a]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Search docs…
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-12">
        {sections.map((section) => (
          <div key={section.category}>
            {/* Section header */}
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-1 h-5 rounded-full" style={{ background: section.color }} />
              <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: section.color }}>
                {section.category}
              </h2>
            </div>

            {/* Article grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {section.articles.map((article) => (
                <div
                  key={article.slug}
                  className="group flex flex-col gap-1.5 p-4 rounded-xl border border-quill-border bg-[#0d0d15] hover:border-quill-border-2 hover:bg-quill-surface transition-all duration-150 cursor-default"
                >
                  <p className="text-sm font-medium text-quill-text group-hover:text-white transition-colors leading-snug">
                    {article.title}
                  </p>
                  <p className="text-xs text-quill-muted leading-relaxed">{article.desc}</p>
                  <span className="mt-1 text-[11px]" style={{ color: section.color }}>Coming soon →</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Bottom note */}
        <div className="pt-8 border-t border-quill-border text-center">
          <p className="text-sm text-quill-muted">
            Can&apos;t find what you&apos;re looking for?{" "}
            <a href="mailto:support@quill.ai" className="text-[#EF4444] hover:underline">
              Contact support
            </a>
          </p>
          <div className="flex items-center justify-center gap-5 mt-4 text-xs text-[#4a4a6a]">
            <Link href="/privacy" className="hover:text-quill-muted transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-quill-muted transition-colors">Terms</Link>
            <Link href="/" className="hover:text-quill-muted transition-colors">Home</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
