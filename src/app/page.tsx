import type { Metadata } from "next";
import Link from "next/link";
import { QuillLogo } from "@/components/ui/QuillLogo";
import { KillerSvgIcon } from "@/components/ui/KillerIcon";
import { KILLERS } from "@/lib/killers";
import { HeroInput } from "@/components/HeroInput";

export const metadata: Metadata = {
  title: "Quill AI — Your Personal AI Agent That Gets Things Done",
  description:
    "Quill is your personal AI agent. Research, write, code, analyze data, and execute complex multi-step tasks autonomously. Free to start — no credit card required.",
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
    title: "Quill AI — Your Personal AI Agent",
    description:
      "Research, write, code, and execute complex tasks autonomously. Give Quill a goal — it figures out the rest.",
    type: "website",
    url: "https://quill.ai",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quill AI — Your Personal AI Agent",
    description: "Research, write, code, and execute complex tasks autonomously.",
  },
  alternates: {
    canonical: "https://quill.ai",
  },
};

const capabilities = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    title: "Deep Research",
    description: "Quill searches the web, reads pages, and synthesizes intelligence from dozens of sources — in seconds.",
    color: "#F87171",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    title: "Code & Build",
    description: "Generate full applications, components, scripts, and automation pipelines with production-quality code.",
    color: "#F87171",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    title: "Write & Create",
    description: "Blog posts, emails, reports, presentations, and more — written in your voice with expert-level quality.",
    color: "#34d399",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    title: "Analyze Data",
    description: "Upload spreadsheets, CSVs, or PDFs and get instant insights, charts, and actionable recommendations.",
    color: "#fbbf24",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
      </svg>
    ),
    title: "Generate Images",
    description: "Create stunning visuals, illustrations, and graphics from simple text prompts using Imagen.",
    color: "#f87171",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z" />
        <path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
        <path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z" />
        <path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z" />
        <path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z" />
        <path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z" />
        <path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z" />
        <path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z" />
      </svg>
    ),
    title: "Specialist Agents",
    description: "Switch between expert modes — Code Wizard, Deep Dive researcher, Pen Master writer, and more.",
    color: "#FCA5A5",
  },
];

const exampleTasks = [
  "Research all Series A AI startups from Q1 2026 and create a competitive landscape report",
  "Build me a full Next.js landing page with Tailwind, animations, and a waitlist form",
  "Analyze my Q4 sales CSV and identify the top 3 revenue growth opportunities",
  "Write 5 cold email variants for my B2B SaaS product targeting CTOs",
  "Find the top 20 newsletters in the productivity space and their subscriber counts",
  "Create a 30-day social media content calendar for my AI startup",
];

const stats = [
  { value: "6+", label: "Specialist Agents" },
  { value: "3", label: "AI Model Modes" },
  { value: "∞", label: "Tasks, no limits" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-quill-bg text-quill-text overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-quill-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <QuillLogo size={24} />
            <span className="text-base font-semibold gradient-text tracking-tight">Quill AI</span>
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm text-quill-muted">
            <a href="#features" className="hover:text-quill-text transition-colors">Features</a>
            <a href="#agents" className="hover:text-quill-text transition-colors">Agents</a>
            <a href="#how-it-works" className="hover:text-quill-text transition-colors">How it works</a>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="max-sm:hidden flex items-center h-9 px-3 rounded-xl text-sm text-quill-muted hover:text-quill-text hover:bg-quill-border transition-all"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="flex items-center h-9 px-4 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white text-sm font-medium transition-all shadow-lg shadow-[rgba(239,68,68,0.25)] active:scale-95"
            >
              Try Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-28 sm:pt-32 pb-16 sm:pb-24 px-4 sm:px-6 flex flex-col items-center text-center overflow-hidden">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-150 sm:w-200 h-100 sm:h-125 rounded-full opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, rgba(239,68,68,0.6) 0%, transparent 70%)", filter: "blur(60px)" }}
        />

        {/* Badge */}
        <div className="relative flex items-center gap-2 px-4 py-1.5 rounded-full border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] text-[#F87171] text-xs font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F87171] animate-pulse" />
          Now available · No credit card required
        </div>

        <h1 className="relative text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.08] max-w-4xl">
          Your{" "}<span className="gradient-text">AI Agent</span>
          <br />
          That Gets Things Done
        </h1>

        <p className="relative mt-5 sm:mt-6 text-base sm:text-xl text-quill-muted max-w-2xl leading-relaxed px-2">
          Quill researches, writes, codes, and executes complex tasks autonomously.
          Give it a goal — it figures out the rest.
        </p>

        <div className="relative flex flex-col items-center gap-4 mt-8 sm:mt-10 w-full px-4 sm:px-0">
          <HeroInput />
          <p className="text-xs text-[#4a4a6a]">
            Already have an account?{" "}
            <Link href="/login" className="text-[#F87171] hover:text-[#fca5a5] transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        {/* Stats */}
        <div className="relative flex items-center gap-8 sm:gap-12 mt-12 sm:mt-16">
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
            <div className="w-3 h-3 rounded-full bg-[#f87171]/60" />
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
              <div className="max-w-xs sm:max-w-lg px-4 py-3 rounded-2xl rounded-tr-sm bg-[#EF4444] text-white text-sm leading-relaxed">
                Research the top 10 AI agent companies in 2026 and create a competitive analysis report
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-quill-surface border border-quill-border flex items-center justify-center shrink-0 mt-0.5">
                <QuillLogo size={16} />
              </div>
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                {[
                  { tool: "Web Search", desc: 'Searching "top AI agent companies 2026"', status: "done", color: "#34d399" },
                  { tool: "Browser", desc: "Reading TechCrunch, Forbes, Crunchbase...", status: "done", color: "#34d399" },
                  { tool: "Analyze", desc: "Synthesizing competitive data", status: "running", color: "#EF4444" },
                ].map((t) => (
                  <div key={t.tool} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-quill-border bg-quill-surface text-xs min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: t.color }} />
                    <span className="font-semibold text-quill-text shrink-0">{t.tool}</span>
                    <span className="text-quill-muted truncate hidden sm:block">{t.desc}</span>
                    {t.status === "running" && (
                      <span className="ml-auto text-[#EF4444] text-[10px] font-medium bg-[rgba(239,68,68,0.1)] px-2 py-0.5 rounded-full shrink-0">
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
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Everything your AI agent needs</h2>
          <p className="mt-4 text-quill-muted text-base sm:text-lg max-w-xl mx-auto">
            Quill is equipped with a powerful toolkit to handle any task you throw at it.
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.08)] text-[#F87171] text-xs font-medium mb-4">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L22 12L12 22L2 12Z" /></svg>
              Specialist Agents
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Switch to the right expert instantly</h2>
            <p className="mt-4 text-quill-muted text-base sm:text-lg max-w-xl mx-auto">
              Each agent is fine-tuned for a specific domain — no prompt engineering required.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {KILLERS.map((killer) => (
              <Link
                key={killer.id}
                href={`/agent?killer=${killer.id}`}
                className="flex items-start gap-4 p-5 rounded-2xl border transition-all duration-200 group hover:scale-[1.02]"
                style={{ borderColor: `${killer.accent}25`, background: `${killer.accent}06` }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${killer.accent}18`, border: `1px solid ${killer.accent}35`, color: killer.accent }}>
                  <KillerSvgIcon iconKey={killer.iconKey} size={20} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-quill-text group-hover:text-white transition-colors" style={{ color: killer.accent }}>{killer.name}</p>
                  <p className="text-sm text-quill-muted mt-0.5">{killer.tagline}</p>
                  <p className="text-xs text-[#4a4a6a] mt-1.5 leading-relaxed line-clamp-2">{killer.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-4 sm:px-6 py-16 sm:py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">How Quill works</h2>
            <p className="mt-4 text-quill-muted text-base sm:text-lg">From idea to done — in three steps.</p>
          </div>

          {/* Steps — vertical on mobile, horizontal on desktop */}
          <div className="flex flex-col md:flex-row gap-4 md:gap-0 items-stretch">
            {[
              {
                step: "1",
                title: "Describe your goal",
                desc: "Type anything in plain English. No special prompts, no setup — just tell Quill what you need.",
                example: '"Research competitors and write a strategy doc"',
                color: "#EF4444",
              },
              {
                step: "2",
                title: "Quill plans & executes",
                desc: "Quill breaks your goal into steps, picks the right tools, and autonomously works through each one.",
                example: "Searching → Reading → Analyzing → Writing…",
                color: "#f59e0b",
              },
              {
                step: "3",
                title: "Review & refine",
                desc: "See every action taken, review the result, ask follow-up questions, or kick off the next task.",
                example: '"Make it shorter and more aggressive in tone"',
                color: "#10b981",
              },
            ].map((item, i) => (
              <div key={item.step} className="flex flex-col md:flex-row md:flex-1 items-stretch">
                {/* Card */}
                <div
                  className="flex-1 relative flex flex-col gap-4 p-6 sm:p-7 rounded-2xl border bg-quill-surface-2 transition-all duration-200 hover:scale-[1.01]"
                  style={{ borderColor: `${item.color}30` }}
                >
                  {/* Step badge */}
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

                  {/* Example callout */}
                  <div
                    className="mt-auto pt-4 border-t text-xs font-mono text-quill-muted italic leading-relaxed"
                    style={{ borderColor: `${item.color}20` }}
                  >
                    {item.example}
                  </div>

                  {/* Glow bottom accent */}
                  <div
                    className="absolute bottom-0 left-6 right-6 h-px rounded-full opacity-60"
                    style={{ background: `linear-gradient(to right, transparent, ${item.color}, transparent)` }}
                  />
                </div>

                {/* Connector arrow between cards (desktop only) */}
                {i < 2 && (
                  <div className="hidden md:flex items-center justify-center w-10 shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2a2a3e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </div>
                )}
                {/* Connector arrow (mobile only) */}
                {i < 2 && (
                  <div className="flex md:hidden items-center justify-center h-8 shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2a2a3e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <polyline points="5 12 12 19 19 12" />
                    </svg>
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
              See Pricings
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>

        </div>
      </section>

      {/* Example tasks */}
      <section id="examples" className="px-4 sm:px-6 py-16 sm:py-24 bg-quill-surface-2 border-y border-quill-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">What can you ask Quill?</h2>
            <p className="mt-4 text-quill-muted text-base sm:text-lg">Real tasks real people are running right now.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {exampleTasks.map((task) => (
              <Link
                key={task}
                href="/login"
                className="flex items-center gap-4 px-4 sm:px-5 py-4 rounded-2xl border border-quill-border bg-quill-bg hover:border-[rgba(239,68,68,0.4)] hover:bg-[rgba(239,68,68,0.04)] transition-all duration-200 group text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-[rgba(239,68,68,0.1)] flex items-center justify-center shrink-0 text-[#EF4444] group-hover:bg-[rgba(239,68,68,0.2)] transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </div>
                <p className="text-sm text-quill-text-2 group-hover:text-quill-text transition-colors leading-snug">{task}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 py-16 sm:py-24 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(239,68,68,0.8) 0%, transparent 70%)" }} />
        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-5 sm:mb-6">
            Start your first task <span className="gradient-text">now</span>
          </h2>
          <p className="text-quill-muted text-base sm:text-lg mb-8 sm:mb-10">
            No setup. No credit card. Just describe what you need and let Quill handle the rest.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2.5 px-7 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-[#EF4444] hover:bg-[#DC2626] text-white font-semibold text-base sm:text-lg transition-all shadow-2xl shadow-[rgba(239,68,68,0.4)] active:scale-95"
          >
            <QuillLogo size={20} />
            Launch Quill AI — It&apos;s free
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
          <p className="text-xs text-quill-muted text-center">© 2026 Quill AI. Your personal AI agent.</p>
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
