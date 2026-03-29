import Link from "next/link";
import { QuillLogo } from "@/components/ui/QuillLogo";

interface Section {
  title: string;
  content: string | string[];
}

interface LegalLayoutProps {
  title: string;
  subtitle: string;
  lastUpdated: string;
  sections: Section[];
}

export function LegalLayout({ title, subtitle, lastUpdated, sections }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e8e8f0]">
      {/* Nav */}
      <nav className="border-b border-[#1e1e2e] px-4 sm:px-6 h-14 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="flex items-center gap-2.5">
          <QuillLogo size={22} />
          <span className="text-sm font-semibold gradient-text tracking-tight">Quill AI</span>
        </Link>
        <Link href="/" className="text-xs text-[#6b6b8a] hover:text-[#e8e8f0] transition-colors">
          ← Back to home
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Header */}
        <div className="mb-10 pb-8 border-b border-[#1e1e2e]">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">{title}</h1>
          <p className="text-[#6b6b8a] text-base">{subtitle}</p>
          <p className="text-xs text-[#4a4a6a] mt-3">Last updated: {lastUpdated}</p>
        </div>

        {/* Sections */}
        <div className="space-y-10">
          {sections.map((section, i) => (
            <section key={i}>
              <h2 className="text-lg font-semibold text-[#e8e8f0] mb-3 flex items-center gap-2">
                <span
                  className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0"
                  style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.25)" }}
                >
                  {i + 1}
                </span>
                {section.title}
              </h2>
              {Array.isArray(section.content) ? (
                <ul className="space-y-2">
                  {section.content.map((item, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm text-[#8a8aa0] leading-relaxed">
                      <span className="w-1 h-1 rounded-full bg-[#EF4444] shrink-0 mt-2" />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[#8a8aa0] leading-relaxed">{section.content}</p>
              )}
            </section>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-16 pt-8 border-t border-[#1e1e2e]">
          <p className="text-xs text-[#4a4a6a] leading-relaxed">
            Questions? Contact us at{" "}
            <a href="mailto:legal@quill.ai" className="text-[#EF4444] hover:underline">
              legal@quill.ai
            </a>
          </p>
          <div className="flex gap-4 mt-4">
            <Link href="/privacy" className="text-xs text-[#6b6b8a] hover:text-[#e8e8f0] transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-xs text-[#6b6b8a] hover:text-[#e8e8f0] transition-colors">Terms of Service</Link>
            <Link href="/docs" className="text-xs text-[#6b6b8a] hover:text-[#e8e8f0] transition-colors">Documentation</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
