import Link from "next/link";
import { QuillLogo } from "@/components/ui/QuillLogo";

const capabilities = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    title: "Deep Research",
    description:
      "Quill searches the web, reads pages, and synthesizes intelligence from dozens of sources — in seconds.",
    color: "#a78bfa",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    title: "Code & Build",
    description:
      "Generate full applications, components, scripts, and automation pipelines with production-quality code.",
    color: "#60a5fa",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    title: "Write & Create",
    description:
      "Blog posts, emails, reports, presentations, and more — written in your voice with expert-level quality.",
    color: "#34d399",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    title: "Analyze Data",
    description:
      "Upload spreadsheets, CSVs, or PDFs and get instant insights, charts, and actionable recommendations.",
    color: "#fbbf24",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    title: "Browse the Web",
    description:
      "Navigate sites, fill forms, extract data, and complete browser-based tasks with full autonomy.",
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
    title: "Multi-Step Planning",
    description:
      "Complex goals broken into clear, executable plans — with full visibility into every action taken.",
    color: "#c084fc",
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
  { value: "50+", label: "Integrated Tools" },
  { value: "10×", label: "Faster than manual work" },
  { value: "∞", label: "Tasks, no limits" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e8e8f0] overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-[#1e1e2e]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <QuillLogo size={24} />
            <span className="text-base font-semibold gradient-text tracking-tight">
              Quill AI
            </span>
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm text-[#6b6b8a]">
            <a href="#features" className="hover:text-[#e8e8f0] transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-[#e8e8f0] transition-colors">How it works</a>
            <a href="#examples" className="hover:text-[#e8e8f0] transition-colors">Examples</a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/agent"
              className="text-sm text-[#6b6b8a] hover:text-[#e8e8f0] transition-colors hidden sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/agent"
              className="px-4 py-2 rounded-xl bg-[#7c6af7] hover:bg-[#6b58e8] text-white text-sm font-medium transition-all duration-150 shadow-lg shadow-[rgba(124,106,247,0.25)] active:scale-95"
            >
              Try Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 flex flex-col items-center text-center overflow-hidden">
        {/* Background glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full opacity-20 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(124,106,247,0.6) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />

        {/* Badge */}
        <div className="relative flex items-center gap-2 px-4 py-1.5 rounded-full border border-[rgba(124,106,247,0.3)] bg-[rgba(124,106,247,0.08)] text-[#a78bfa] text-xs font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] animate-pulse" />
          Now available · No credit card required
        </div>

        <h1 className="relative text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.08] max-w-4xl">
          Your{" "}
          <span className="gradient-text">AI Agent</span>
          <br />
          That Gets Things Done
        </h1>

        <p className="relative mt-6 text-lg sm:text-xl text-[#6b6b8a] max-w-2xl leading-relaxed">
          Quill researches, writes, codes, and executes complex tasks autonomously.
          Give it a goal — it figures out the rest.
        </p>

        <div className="relative flex flex-col sm:flex-row items-center gap-3 mt-10">
          <Link
            href="/agent"
            className="flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-[#7c6af7] hover:bg-[#6b58e8] text-white font-semibold text-base transition-all duration-150 shadow-xl shadow-[rgba(124,106,247,0.3)] active:scale-95"
          >
            Start for free
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
          <a
            href="#how-it-works"
            className="flex items-center gap-2 px-7 py-3.5 rounded-2xl border border-[#1e1e2e] hover:border-[#2a2a3e] text-[#a8a8c0] hover:text-[#e8e8f0] font-medium text-base transition-all duration-150"
          >
            See how it works
          </a>
        </div>

        {/* Stats */}
        <div className="relative flex items-center gap-10 mt-16">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold gradient-text">{stat.value}</div>
              <div className="text-xs text-[#6b6b8a] mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Demo preview */}
      <section className="px-6 pb-24 max-w-5xl mx-auto">
        <div className="relative rounded-3xl border border-[#1e1e2e] bg-[#0d0d15] overflow-hidden shadow-2xl shadow-black/50">
          {/* Window chrome */}
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[#1e1e2e] bg-[#0a0a0f]">
            <div className="w-3 h-3 rounded-full bg-[#f87171]/60" />
            <div className="w-3 h-3 rounded-full bg-[#fbbf24]/60" />
            <div className="w-3 h-3 rounded-full bg-[#34d399]/60" />
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-[#111118] border border-[#1e1e2e] text-xs text-[#6b6b8a]">
                <QuillLogo size={12} />
                quill.ai/agent
              </div>
            </div>
          </div>

          {/* Mock chat */}
          <div className="p-6 space-y-5">
            {/* User message */}
            <div className="flex justify-end">
              <div className="max-w-lg px-4 py-3 rounded-2xl rounded-tr-sm bg-[#7c6af7] text-white text-sm leading-relaxed">
                Research the top 10 AI agent companies in 2026 and create a competitive analysis report
              </div>
            </div>

            {/* Tool calls */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-[#111118] border border-[#1e1e2e] flex items-center justify-center shrink-0 mt-0.5">
                <QuillLogo size={16} />
              </div>
              <div className="flex-1 flex flex-col gap-2">
                {[
                  { tool: "Web Search", desc: 'Searching "top AI agent companies 2026"', status: "done", color: "#34d399" },
                  { tool: "Browser", desc: "Reading TechCrunch, Forbes, Crunchbase...", status: "done", color: "#34d399" },
                  { tool: "Analyze", desc: "Synthesizing competitive data", status: "running", color: "#7c6af7" },
                ].map((t) => (
                  <div
                    key={t.tool}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-[#1e1e2e] bg-[#111118] text-xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: t.color }} />
                    <span className="font-semibold text-[#e8e8f0]">{t.tool}</span>
                    <span className="text-[#6b6b8a] truncate">{t.desc}</span>
                    {t.status === "running" && (
                      <span className="ml-auto text-[#7c6af7] text-[10px] font-medium bg-[rgba(124,106,247,0.1)] px-2 py-0.5 rounded-full shrink-0">
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
      <section id="features" className="px-6 py-24 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold tracking-tight">
            Everything your AI agent needs
          </h2>
          <p className="mt-4 text-[#6b6b8a] text-lg max-w-xl mx-auto">
            Quill is equipped with a powerful toolkit to handle any task you throw at it.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {capabilities.map((cap) => (
            <div
              key={cap.title}
              className="p-6 rounded-2xl border border-[#1e1e2e] bg-[#0d0d15] hover:border-[#2a2a3e] transition-all duration-200 group"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all group-hover:scale-110"
                style={{ background: `${cap.color}15`, color: cap.color }}
              >
                {cap.icon}
              </div>
              <h3 className="font-semibold text-[#e8e8f0] mb-2">{cap.title}</h3>
              <p className="text-sm text-[#6b6b8a] leading-relaxed">{cap.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-6 py-24 bg-[#0d0d15] border-y border-[#1e1e2e]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold tracking-tight">How Quill works</h2>
            <p className="mt-4 text-[#6b6b8a] text-lg">
              Three simple steps. Unlimited complexity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Describe your goal",
                desc: "Tell Quill what you want in plain English. No prompting expertise needed.",
                color: "#7c6af7",
              },
              {
                step: "02",
                title: "Quill plans & acts",
                desc: "Quill breaks your goal into steps, picks the right tools, and executes autonomously.",
                color: "#60a5fa",
              },
              {
                step: "03",
                title: "Review & iterate",
                desc: "See every action taken. Refine results, ask follow-ups, or start a new task.",
                color: "#34d399",
              },
            ].map((item) => (
              <div key={item.step} className="flex flex-col gap-4">
                <div
                  className="text-4xl font-black tabular-nums"
                  style={{ color: `${item.color}40` }}
                >
                  {item.step}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#e8e8f0] mb-2">{item.title}</h3>
                  <p className="text-sm text-[#6b6b8a] leading-relaxed">{item.desc}</p>
                </div>
                <div
                  className="h-0.5 rounded-full w-12"
                  style={{ background: item.color }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Example tasks */}
      <section id="examples" className="px-6 py-24 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold tracking-tight">
            What can you ask Quill?
          </h2>
          <p className="mt-4 text-[#6b6b8a] text-lg">
            Real tasks real people are running right now.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {exampleTasks.map((task) => (
            <Link
              key={task}
              href="/agent"
              className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-[#1e1e2e] bg-[#0d0d15] hover:border-[rgba(124,106,247,0.4)] hover:bg-[rgba(124,106,247,0.04)] transition-all duration-200 group text-left"
            >
              <div className="w-8 h-8 rounded-xl bg-[rgba(124,106,247,0.1)] flex items-center justify-center shrink-0 text-[#7c6af7] group-hover:bg-[rgba(124,106,247,0.2)] transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
              <p className="text-sm text-[#a8a8c0] group-hover:text-[#e8e8f0] transition-colors leading-snug">
                {task}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 50% 50%, rgba(124,106,247,0.8) 0%, transparent 70%)",
          }}
        />
        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-5xl font-bold tracking-tight mb-6">
            Start your first task <span className="gradient-text">now</span>
          </h2>
          <p className="text-[#6b6b8a] text-lg mb-10">
            No setup. No credit card. Just describe what you need and let Quill handle the rest.
          </p>
          <Link
            href="/agent"
            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-[#7c6af7] hover:bg-[#6b58e8] text-white font-semibold text-lg transition-all duration-150 shadow-2xl shadow-[rgba(124,106,247,0.4)] active:scale-95"
          >
            <QuillLogo size={20} />
            Launch Quill AI — It&apos;s free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1e1e2e] px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <QuillLogo size={18} />
            <span className="text-sm font-semibold gradient-text">Quill AI</span>
          </div>
          <p className="text-xs text-[#6b6b8a]">
            © 2026 Quill AI. Your personal AI agent.
          </p>
          <div className="flex gap-5 text-xs text-[#6b6b8a]">
            <a href="#" className="hover:text-[#e8e8f0] transition-colors">Privacy</a>
            <a href="#" className="hover:text-[#e8e8f0] transition-colors">Terms</a>
            <a href="#" className="hover:text-[#e8e8f0] transition-colors">Docs</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
