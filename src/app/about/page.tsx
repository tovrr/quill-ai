import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ChartBarIcon,
  ClockIcon,
  CodeBracketIcon,
  LightBulbIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PhotoIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";
import { SparklesIcon } from "@heroicons/react/20/solid";
import { QuillLogo } from "@/components/ui/QuillLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { KILLERS, type KillerIconKey } from "@/lib/ai/killers";

export const metadata: Metadata = {
  title: "About Quill AI — Secure Control Plane for AI Agents",
  description:
    "Learn how Quill combines a familiar AI agent workflow with a secure control plane: policy, routing, identity, and cost controls across cloud and local models.",
  alternates: {
    canonical: "https://quill.ai/about",
  },
};

const capabilities = [
  {
    icon: <MagnifyingGlassIcon className="h-5.5 w-5.5" aria-hidden="true" />,
    title: "Deep Research",
    description: "Run web research workflows with visibility into each step, source, and model decision.",
    color: "#F87171",
  },
  {
    icon: <CodeBracketIcon className="h-5.5 w-5.5" aria-hidden="true" />,
    title: "App Builder",
    description: "Generate page/React/Next.js artifacts with quality scoring, iteration locks, and export-readiness diagnostics.",
    color: "#F87171",
  },
  {
    icon: <PencilSquareIcon className="h-5.5 w-5.5" aria-hidden="true" />,
    title: "Write & Create",
    description: "Create polished deliverables with reusable style controls across prompts, chats, and generated assets.",
    color: "#34d399",
  },
  {
    icon: <ChartBarIcon className="h-5.5 w-5.5" aria-hidden="true" />,
    title: "Analyze Data",
    description: "Turn files into actionable decisions with transparent analysis steps and reproducible outputs.",
    color: "#fbbf24",
  },
  {
    icon: <PhotoIcon className="h-5.5 w-5.5" aria-hidden="true" />,
    title: "Generate Images",
    description: "Generate visuals with configurable quality/cost trade-offs and the same control layer as text workflows.",
    color: "#f87171",
  },
  {
    icon: <SparklesIcon className="h-5.5 w-5.5" aria-hidden="true" />,
    title: "Specialist Agents",
    description: "Use specialist coworkers for coding, research, and writing while staying inside one governed workspace.",
    color: "#FCA5A5",
  },
];

const killerIconMap: Record<KillerIconKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  code: CodeBracketIcon,
  flow: ClockIcon,
  idea: LightBulbIcon,
  research: MagnifyingGlassIcon,
  pen: PencilSquareIcon,
};

const exampleTasks = [
  "Research all Series A AI startups from Q1 2026 and create a competitive landscape report",
  "Build me a full Next.js landing page with Tailwind, animations, and a waitlist form",
  "Create a React dashboard app with auth UI and preview it live in canvas",
  "Analyze my Q4 sales CSV and identify the top 3 revenue growth opportunities",
  "Write 5 cold email variants for my B2B SaaS product targeting CTOs",
  "Find the top 20 newsletters in the productivity space and their subscriber counts",
  "Create a 30-day social media content calendar for my AI startup",
];

const stats = [
  { value: "6+", label: "Specialist Coworkers" },
  { value: "Cloud + Local", label: "Unified Providers" },
  { value: "Policy-First", label: "Control Layer" },
];

// Marketing surface moved off the home page per ROADMAP.md Track B.1 (MiniMax-style
// minimal home = nav + centered input only). Content below is unchanged from the old
// home page, just relocated + given its own nav/footer.
export default function AboutPage() {
  return (
    <div className="min-h-screen bg-quill-bg text-quill-text overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass hero-nav-glass border-b border-quill-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <QuillLogo size={24} />
            <span className="text-base font-semibold gradient-text tracking-tight">Quill AI</span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm text-quill-muted">
            <a href="#features" className="hover:text-quill-text transition-colors">Features</a>
            <a href="#agents" className="hover:text-quill-text transition-colors">Agents</a>
            <a href="#how-it-works" className="hover:text-quill-text transition-colors">How it works</a>
          </div>

          <div className="flex items-center gap-2">
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

      {/* Hero */}
      <section className="relative pt-20 sm:pt-32 pb-10 sm:pb-24 px-4 sm:px-6 flex flex-col items-center text-center overflow-hidden">
        <div
          className="hero-glow absolute top-0 left-1/2 -translate-x-1/2 w-150 sm:w-200 h-100 sm:h-125 rounded-full opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, var(--color-quill-accent) 0%, transparent 70%)" }}
        />

        <div className="relative flex items-center gap-2 px-4 py-1.5 rounded-full border border-quill-border-2 bg-quill-glow-10 text-quill-accent-2 text-xs font-medium mb-4 sm:mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-quill-accent-2 motion-safe:animate-pulse" />
          Familiar UX. Trusted control plane.
        </div>

        <h1 className="relative text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.08] max-w-4xl">
          Familiar <span className="gradient-text">AI Agents</span>
          <br />
          Trusted by Design
        </h1>

        <p className="relative mt-4 sm:mt-6 text-base sm:text-xl text-quill-muted max-w-2xl leading-relaxed px-2">
          Keep the workflow users already know from modern agent products.
          Add Quill&apos;s secure control plane for policy, routing, identity, and cost guardrails.
        </p>

        <div className="relative flex items-center gap-3 mt-6 sm:mt-10">
          <Link
            href="/login"
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-quill-accent hover:bg-quill-accent-2 text-white font-semibold text-base transition-all shadow-2xl shadow-[rgba(239,68,68,0.4)] active:scale-95"
          >
            <QuillLogo size={20} />
            Start Free
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl border border-quill-border hover:border-quill-border-2 text-quill-text-2 hover:text-quill-text font-medium text-base transition-all"
          >
            Try the composer
          </Link>
        </div>

        {/* Stats */}
        <div className="relative flex items-center gap-8 sm:gap-12 mt-8 sm:mt-16">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl sm:text-3xl font-bold gradient-text">{stat.value}</div>
              <div className="text-xs text-quill-muted mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Demo preview */}
      <section className="px-4 sm:px-6 pb-16 sm:pb-24 max-w-5xl mx-auto">
        <div className="relative rounded-2xl sm:rounded-3xl border border-quill-border bg-quill-surface-2 overflow-hidden shadow-2xl shadow-black/50">
          <div className="flex items-center gap-2 px-4 sm:px-5 py-3 sm:py-3.5 border-b border-quill-border bg-quill-bg">
            <div className="w-3 h-3 rounded-full bg-quill-accent-2/60" />
            <div className="w-3 h-3 rounded-full bg-quill-yellow/60" />
            <div className="w-3 h-3 rounded-full bg-quill-green/60" />
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-quill-surface border border-quill-border text-xs text-quill-muted">
                <QuillLogo size={12} />
                quill.ai/agent
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div className="flex justify-end">
              <div className="max-w-xs sm:max-w-lg px-4 py-3 rounded-2xl rounded-tr-sm bg-quill-accent text-white text-sm leading-relaxed">
                Connect Claude, Gemini, and local models, then enforce policy and budget limits for this project
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-quill-surface border border-quill-border flex items-center justify-center shrink-0 mt-0.5">
                <QuillLogo size={16} />
              </div>
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                {[
                  { tool: "Provider Switchboard", desc: "Connected Gemini + Claude + Local", status: "done", color: "#34d399" },
                  { tool: "Boundary Guard", desc: "Applied local-boundary data rules", status: "done", color: "#34d399" },
                  { tool: "Apex Routing", desc: "Selecting best route under budget cap", status: "running", color: "#EF4444" },
                ].map((t) => (
                  <div key={t.tool} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-quill-border bg-quill-surface text-xs min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: t.color }} />
                    <span className="font-semibold text-quill-text shrink-0">{t.tool}</span>
                    <span className="text-quill-muted truncate hidden sm:block">{t.desc}</span>
                    {t.status === "running" && (
                      <span className="ml-auto text-quill-accent-2 text-[10px] font-medium bg-quill-glow-10 px-2 py-0.5 rounded-full shrink-0">
                        Running
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-4 sm:px-6 py-16 sm:py-24 max-w-6xl mx-auto">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Everything needed to run trusted agents</h2>
          <p className="mt-4 text-quill-muted text-base sm:text-lg max-w-xl mx-auto">
            Keep familiar interaction patterns while adding enforceable trust, routing, and governance controls.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {capabilities.map((cap) => (
            <div key={cap.title} className="p-5 sm:p-6 rounded-2xl border border-quill-border bg-quill-surface-2 hover:border-quill-border-2 transition-all duration-200 group">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all group-hover:scale-110" style={{ background: `${cap.color}15`, color: cap.color }}>
                {cap.icon}
              </div>
              <h3 className="font-semibold text-quill-text mb-2">{cap.title}</h3>
              <p className="text-sm text-quill-muted leading-relaxed">{cap.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Specialist Agents */}
      <section id="agents" className="px-4 sm:px-6 py-16 sm:py-24 bg-quill-surface-2 border-y border-quill-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-quill-border-2 bg-quill-glow-10 text-quill-accent-2 text-xs font-medium mb-4">
              <SparklesIcon className="h-2.5 w-2.5" aria-hidden="true" />
              Specialist Agents
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Switch to the right expert instantly</h2>
            <p className="mt-4 text-quill-muted text-base sm:text-lg max-w-xl mx-auto">
              Each coworker is tuned for a specific domain with shared policy and routing controls.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {KILLERS.map((killer) => {
              const KillerIcon = killerIconMap[killer.iconKey];

              return (
                <Link
                  key={killer.id}
                  href={`/agent?killer=${killer.id}`}
                  className="flex items-start gap-4 p-5 rounded-2xl border transition-all duration-200 group hover:scale-[1.02]"
                  style={{ borderColor: `${killer.accent}25`, background: `${killer.accent}06` }}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${killer.accent}18`, border: `1px solid ${killer.accent}35`, color: killer.accent }}>
                    <KillerIcon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-quill-text group-hover:text-white transition-colors" style={{ color: killer.accent }}>{killer.name}</p>
                    <p className="text-sm text-quill-muted mt-0.5">{killer.tagline}</p>
                    <p className="text-xs text-quill-muted mt-1.5 leading-relaxed line-clamp-2">{killer.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-4 sm:px-6 py-16 sm:py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">How Quill works</h2>
            <p className="mt-4 text-quill-muted text-base sm:text-lg">From familiar prompt to governed execution in three steps.</p>
          </div>

          <div className="flex flex-col md:flex-row gap-4 md:gap-0 items-stretch">
            {[
              {
                step: "1",
                title: "Connect your providers",
                desc: "Bring cloud and local models into one workspace with a single integration layer.",
                example: '"Gemini + Claude + local Llama connected"',
                color: "#EF4444",
              },
              {
                step: "2",
                title: "Set policy and budget guardrails",
                desc: "Define what data can leave boundaries, enforce quotas, and apply role-aware access controls.",
                example: "Boundary rules → key isolation → budget caps",
                color: "#f59e0b",
              },
              {
                step: "3",
                title: "Run with Apex",
                desc: "Apex routes each request by latency, quality target, and cost so operations stay reliable.",
                example: "Fast / Balanced / Reasoning profiles",
                color: "#10b981",
              },
            ].map((item, i) => (
              <div key={item.step} className="flex flex-col md:flex-row md:flex-1 items-stretch">
                <div
                  className="flex-1 relative flex flex-col gap-4 p-6 sm:p-7 rounded-2xl border bg-quill-surface-2 transition-all duration-200 hover:scale-[1.01]"
                  style={{ borderColor: `${item.color}30` }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0"
                    style={{ background: `${item.color}20`, color: item.color, border: `1px solid ${item.color}40` }}
                  >
                    {item.step}
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-quill-text mb-2">{item.title}</h3>
                    <p className="text-sm text-quill-muted leading-relaxed">{item.desc}</p>
                  </div>

                  <div
                    className="mt-auto pt-4 border-t text-xs font-mono text-quill-muted italic leading-relaxed"
                    style={{ borderColor: `${item.color}20` }}
                  >
                    {item.example}
                  </div>

                  <div
                    className="absolute bottom-0 left-6 right-6 h-px rounded-full opacity-60"
                    style={{ background: `linear-gradient(to right, transparent, ${item.color}, transparent)` }}
                  />
                </div>

                {i < 2 && (
                  <div className="hidden md:flex items-center justify-center w-10 shrink-0">
                    <ArrowRightIcon className="h-5 w-5 text-quill-border-2" aria-hidden="true" />
                  </div>
                )}
                {i < 2 && (
                  <div className="flex md:hidden items-center justify-center h-8 shrink-0">
                    <ArrowDownIcon className="h-5 w-5 text-quill-border-2" aria-hidden="true" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-10 sm:mt-12 text-center">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl border border-quill-border hover:border-quill-border-2 text-quill-text-2 hover:text-quill-text font-medium text-base transition-all"
            >
              See Pricing
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Example tasks */}
      <section id="examples" className="px-4 sm:px-6 py-16 sm:py-24 bg-quill-surface-2 border-y border-quill-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">What can you ask Quill?</h2>
            <p className="mt-4 text-quill-muted text-base sm:text-lg">Familiar requests, now with policy and routing intelligence.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {exampleTasks.map((task) => (
              <Link
                key={task}
                href="/login"
                className="flex items-center gap-4 px-4 sm:px-5 py-4 rounded-2xl border border-quill-border bg-quill-bg hover:border-quill-border-2 hover:bg-quill-glow-10 transition-all duration-200 group text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-quill-glow-10 flex items-center justify-center shrink-0 text-quill-accent-2 group-hover:bg-quill-border transition-colors">
                  <PlayIcon className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <p className="text-sm text-quill-text-2 group-hover:text-quill-text transition-colors leading-snug">{task}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 py-16 sm:py-24 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 50%, var(--color-quill-accent) 0%, transparent 70%)" }} />
        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-5 sm:mb-6">
            Ship agents people can <span className="gradient-text">trust</span>
          </h2>
          <p className="text-quill-muted text-base sm:text-lg mb-8 sm:mb-10">
            Start with a familiar workflow and scale into secure, governed AI operations without rebuilding your stack.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2.5 px-7 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-quill-accent hover:bg-quill-accent-2 text-white font-semibold text-base sm:text-lg transition-all shadow-2xl shadow-[rgba(239,68,68,0.4)] active:scale-95"
          >
            <QuillLogo size={20} />
            Start Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-quill-border px-4 sm:px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <QuillLogo size={18} />
            <span className="text-sm font-semibold gradient-text">Quill AI</span>
          </div>
          <p className="text-xs text-quill-muted text-center">© 2026 Quill AI. Familiar AI agents, trusted by design.</p>
          <div className="flex gap-5 text-xs text-quill-muted">
            <Link href="/pricing" className="hover:text-quill-text transition-colors">Pricing</Link>
            <Link href="/docs" className="hover:text-quill-text transition-colors">Docs</Link>
            <Link href="/privacy" className="hover:text-quill-text transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-quill-text transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
