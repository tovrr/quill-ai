import type { Metadata } from "next";
import Link from "next/link";
import { QuillLogo } from "@/components/ui/QuillLogo";

export const metadata: Metadata = {
  title: "Pricing — Quill AI",
  description: "Simple, honest pricing. Start free, upgrade when you need more. No hidden fees.",
};

const FREE_FEATURES = [
  "50 messages / month",
  "Fast model only",
  "1 specialist agent",
  "7-day chat history",
  "No web search",
  "No image generation",
];

const SILVER_FEATURES = [
  "1,000 messages / month",
  "Fast + Think models",
  "All 5 specialist agents",
  "90-day chat history",
  "Web search included",
  "20 image generations / mo",
  "File uploads",
  "Canvas mode",
];

const GOLD_FEATURES = [
  "Unlimited messages",
  "Fast + Think + Pro models",
  "All 5 specialist agents",
  "Unlimited chat history",
  "Web search included",
  "Unlimited image generation",
  "File uploads",
  "Canvas mode",
  "Priority processing speed",
];

function Check({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e8e8f0]">
      {/* Nav */}
      <nav className="border-b border-[#1e1e2e] px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <QuillLogo size={22} />
          <span className="text-sm font-semibold gradient-text tracking-tight">Quill AI</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center h-9 px-3 rounded-xl text-sm text-[#6b6b8a] hover:text-[#e8e8f0] hover:bg-[#1e1e2e] transition-all hidden sm:flex">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Home
          </Link>
          <Link href="/login" className="flex items-center h-8 px-3 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-medium transition-all">
            Try Free
          </Link>
        </div>
      </nav>

      {/* Header */}
      <div className="px-4 sm:px-6 pt-14 sm:pt-20 pb-12 text-center" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.07) 0%, transparent 65%)" }}>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">
          Simple, honest pricing
        </h1>
        <p className="text-[#6b6b8a] text-base sm:text-lg max-w-lg mx-auto">
          Start free. Upgrade when you need more power. No hidden fees, no surprises.
        </p>
        <p className="mt-3 text-xs text-[#EF4444] font-medium">
          All paid plans include a 7-day free trial — no charge until it ends.
        </p>
      </div>

      {/* Plans */}
      <div className="px-4 sm:px-6 pb-16 sm:pb-24 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-start">

          {/* Free */}
          <div className="flex flex-col p-6 rounded-2xl border border-[#1e1e2e] bg-[#0d0d15]">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#6b6b8a] mb-3">Free</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-black text-[#e8e8f0]">$0</span>
              <span className="text-sm text-[#6b6b8a] mb-1">/mo</span>
            </div>
            <p className="text-xs text-[#4a4a6a] mb-6">No credit card required</p>
            <Link href="/login" className="flex items-center justify-center h-10 rounded-xl border border-[#1e1e2e] text-sm font-medium text-[#a8a8c0] hover:border-[#2a2a3e] hover:text-[#e8e8f0] transition-all mb-6">
              Get started
            </Link>
            <ul className="space-y-3">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-[#6b6b8a]">
                  <Check color="#2a2a3e" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Silver */}
          <div className="flex flex-col p-6 rounded-2xl border-2 border-[#EF4444] bg-[#0d0d15] relative">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#EF4444] text-white text-[11px] font-bold tracking-wide whitespace-nowrap">
              MOST POPULAR
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#EF4444] mb-3">Silver</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-black text-[#e8e8f0]">$12</span>
              <span className="text-sm text-[#6b6b8a] mb-1">/mo</span>
            </div>
            <p className="text-xs text-[#4a4a6a] mb-6">Billed monthly · Cancel anytime</p>
            <Link href="/login" className="flex items-center justify-center h-10 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white text-sm font-semibold shadow-lg shadow-[rgba(239,68,68,0.25)] transition-all mb-6">
              Start Silver
            </Link>
            <ul className="space-y-3">
              {SILVER_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-[#c8c8e0]">
                  <Check color="#EF4444" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Gold */}
          <div className="flex flex-col p-6 rounded-2xl border border-[rgba(245,158,11,0.3)] bg-[#0d0d15]" style={{ boxShadow: "0 0 40px rgba(245,158,11,0.04)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#f59e0b] mb-3">Gold</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-black text-[#e8e8f0]">$29</span>
              <span className="text-sm text-[#6b6b8a] mb-1">/mo</span>
            </div>
            <p className="text-xs text-[#4a4a6a] mb-6">Billed monthly · Cancel anytime</p>
            <Link href="/login" className="flex items-center justify-center h-10 rounded-xl border border-[rgba(245,158,11,0.4)] text-[#f59e0b] text-sm font-semibold hover:bg-[rgba(245,158,11,0.08)] transition-all mb-6">
              Start Gold
            </Link>
            <ul className="space-y-3">
              {GOLD_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-[#c8c8e0]">
                  <Check color="#f59e0b" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 sm:mt-20 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-center mb-8">Frequently asked questions</h2>
          <div className="space-y-5">
            {[
              { q: "Can I cancel anytime?", a: "Yes. Cancel from Settings → Billing at any time. Your plan stays active until the end of the current billing period — no partial refunds." },
              { q: "What happens when I hit my message limit?", a: "Requests are paused until your next billing cycle resets. You can upgrade at any time to get more immediately." },
              { q: "Is there an annual discount?", a: "Annual billing (2 months free) is coming soon. Sign up free and we'll notify you when it's available." },
              { q: "Do you store my conversations?", a: "Yes — linked to your account. Free plan: 7 days. Silver: 90 days. Gold: indefinitely. You can export or delete your data at any time." },
              { q: "What AI models does Quill use?", a: "Fast uses Gemini 2.0 Flash Lite, Think uses Gemini 2.5 Pro with extended reasoning, and Pro uses Gemini 1.5 Pro for best overall quality." },
            ].map(({ q, a }) => (
              <div key={q} className="border-b border-[#1e1e2e] pb-5">
                <p className="text-sm font-semibold text-[#e8e8f0] mb-2">{q}</p>
                <p className="text-sm text-[#6b6b8a] leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer links */}
        <div className="mt-14 pt-8 border-t border-[#1e1e2e] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <QuillLogo size={16} />
            <span className="text-xs font-semibold gradient-text">Quill AI</span>
          </div>
          <p className="text-xs text-[#4a4a6a]">© 2026 Quill AI</p>
          <div className="flex gap-5 text-xs text-[#6b6b8a]">
            <Link href="/pricing" className="hover:text-[#e8e8f0] transition-colors">Pricing</Link>
            <Link href="/docs" className="hover:text-[#e8e8f0] transition-colors">Docs</Link>
            <Link href="/privacy" className="hover:text-[#e8e8f0] transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-[#e8e8f0] transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
