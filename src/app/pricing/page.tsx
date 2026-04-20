import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, CheckIcon } from "@heroicons/react/24/outline";
import { QuillLogo } from "@/components/ui/QuillLogo";
import { CheckoutButton } from "@/components/pricing/CheckoutButton";

export const metadata: Metadata = {
  title: "Pricing — Quill AI",
  description:
    "Transparent pricing for Quill's secure agent control plane. Start free, upgrade for advanced policy, routing, and governance.",
};

const FREE_FEATURES = [
  "Up to 2 connected providers",
  "Cloud + local routing support",
  "Basic policy templates",
  "Personal workspace",
  "Fast + Balanced route profiles",
  "Daily usage quotas",
  "Community support",
];

const THINK_FEATURES = [
  "Unlimited providers and environments",
  "Advanced boundary and policy rules",
  "Key isolation + project-level quotas",
  "Fast + Balanced + Reasoning profiles",
  "Budget caps and route overrides",
  "90-day audit timeline",
  "Priority email support",
];

const PRO_FEATURES = [
  "Everything in Pro Control",
  "Multi-user workspace + role controls",
  "Shared policy packs",
  "Team analytics by provider and route",
  "1-year audit retention + exports",
  "Onboarding guidance for small teams",
  "Priority support SLA",
];

function Check({ color }: { color: string }) {
  return <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color }} />;
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-quill-bg text-quill-text">
      {/* Nav */}
      <nav className="border-b border-quill-border px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <QuillLogo size={22} />
          <span className="text-sm font-semibold gradient-text tracking-tight">Quill AI</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="hidden sm:inline-flex items-center h-9 px-3 rounded-xl text-sm text-quill-muted hover:text-quill-text hover:bg-quill-border transition-all"
          >
            <ArrowLeftIcon className="mr-1.5 h-3.5 w-3.5" />
            Home
          </Link>
          <Link
            href="/login"
            className="flex items-center h-9 px-4 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white text-sm font-medium transition-all shadow-lg shadow-[rgba(239,68,68,0.25)] active:scale-95"
          >
            Try Free
          </Link>
        </div>
      </nav>

      {/* Header */}
      <div
        className="px-4 sm:px-6 pt-14 sm:pt-20 pb-12 text-center"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.07) 0%, transparent 65%)" }}
      >
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">Pricing for trusted agent operations</h1>
        <p className="text-quill-muted text-base sm:text-lg max-w-lg mx-auto">
          Keep the familiar AI workflow. Upgrade when you need stronger policy, routing, and governance controls.
        </p>
        <p className="mt-3 text-xs text-[#EF4444] font-medium">
          No hidden fees. Transparent limits and predictable control upgrades.
        </p>
      </div>

      {/* Plans */}
      <div className="px-4 sm:px-6 pb-16 sm:pb-24 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-start">
          {/* Free */}
          <div className="flex flex-col p-6 rounded-2xl border border-quill-border bg-[#0d0d15]">
            <p className="text-xs font-semibold uppercase tracking-widest text-quill-muted mb-3">Free</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-black text-quill-text">$0</span>
              <span className="text-sm text-quill-muted mb-1">/mo</span>
            </div>
            <p className="text-xs text-[#6F737A] mb-6">No credit card required</p>
            <Link
              href="/login"
              className="flex items-center justify-center h-10 rounded-xl border border-quill-border text-sm font-medium text-[#A1A7B0] hover:border-quill-border-2 hover:text-quill-text transition-all mb-6"
            >
              Get started
            </Link>
            <ul className="space-y-3">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-quill-muted">
                  <Check color="#343944" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro */}
          <div className="flex flex-col p-6 rounded-2xl border-2 border-[#EF4444] bg-[#0d0d15] relative">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#EF4444] text-white text-[11px] font-bold tracking-wide whitespace-nowrap">
              MOST POPULAR
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#EF4444] mb-3">Pro Control</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-black text-quill-text">$29</span>
              <span className="text-sm text-quill-muted mb-1">/mo</span>
            </div>
            <p className="text-xs text-[#6F737A] mb-6">Billed monthly · Cancel anytime</p>
            <CheckoutButton plan="pro" />
            <ul className="space-y-3">
              {THINK_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-[#C1C7D0]">
                  <Check color="#EF4444" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Team */}
          <div
            className="flex flex-col p-6 rounded-2xl border border-[rgba(245,158,11,0.3)] bg-[#0d0d15]"
            style={{ boxShadow: "0 0 40px rgba(245,158,11,0.04)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-[#f59e0b] mb-3">Team Ops</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-black text-quill-text">$99</span>
              <span className="text-sm text-quill-muted mb-1">/mo</span>
            </div>
            <p className="text-xs text-[#6F737A] mb-6">Billed monthly · Cancel anytime</p>
            <CheckoutButton plan="team" />
            <ul className="space-y-3">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-[#C1C7D0]">
                  <Check color="#f59e0b" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Objections */}
        <div className="mt-16 sm:mt-20 max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-center mb-8">Common objections, answered</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                q: "We already use provider dashboards",
                a: "Dashboards show usage per vendor. Quill gives one control plane across vendors with enforceable policy and routing decisions.",
              },
              {
                q: "Switching providers usually means rewrites",
                a: "Quill abstracts model providers so apps and workflows can switch endpoints without a full integration rewrite.",
              },
              {
                q: "Governance sounds enterprise-heavy",
                a: "Quill starts simple: templates, profile-based routing, and clear defaults. Advanced controls are there only when you need them.",
              },
              {
                q: "We worry about runaway AI costs",
                a: "Apex route profiles, budget caps, and per-key quotas give predictable spend boundaries before costs spike.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="rounded-2xl border border-quill-border bg-quill-surface-2 p-5">
                <p className="text-sm font-semibold text-quill-text mb-2">{q}</p>
                <p className="text-sm text-quill-muted leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 sm:mt-20 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-center mb-8">Frequently asked questions</h2>
          <div className="space-y-5">
            {[
              {
                q: "Can I cancel anytime?",
                a: "Yes. Cancel from Settings → Billing at any time. Your plan stays active until the end of the current billing period — no partial refunds.",
              },
              {
                q: "What happens when I hit my message limit?",
                a: "Requests are paused until your next billing cycle resets. You can upgrade at any time to get more immediately.",
              },
              {
                q: "Can I run cloud and local models together?",
                a: "Yes. Quill is built for hybrid workflows where cloud and local providers can be governed in one place.",
              },
              {
                q: "How does Quill differ from model provider UIs?",
                a: "Quill is not another model UI. It is a control plane with policy, routing, identity, and auditability across providers.",
              },
              {
                q: "Do you provide auditability?",
                a: "Yes. Pro and Team plans include audit timelines, and Team includes extended retention and export support.",
              },
              {
                q: "Is there an annual discount?",
                a: "Annual billing with savings is on the roadmap. Join now and we will notify you when annual plans launch.",
              },
              {
                q: "Can I customize output behavior?",
                a: "Yes. You can configure style instructions, route profiles, and policy defaults to align with your workflow.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="border-b border-quill-border pb-5">
                <p className="text-sm font-semibold text-quill-text mb-2">{q}</p>
                <p className="text-sm text-quill-muted leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer links */}
        <div className="mt-14 pt-8 border-t border-quill-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <QuillLogo size={16} />
            <span className="text-xs font-semibold gradient-text">Quill AI</span>
          </div>
          <p className="text-xs text-[#6F737A]">© 2026 Quill AI</p>
          <div className="flex gap-5 text-xs text-quill-muted">
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
      </div>
    </div>
  );
}
