"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { QuillLogo } from "@/components/ui/QuillLogo";

const navItems = [
  {
    label: "New Task",
    href: "/agent",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  {
    label: "History",
    href: "/history",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="12 8 12 12 14 14" />
        <path d="M3.05 11a9 9 0 1 1 .5 4" />
        <polyline points="3 16 3 11 8 11" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        <path d="M4.93 4.93a10 10 0 0 0 0 14.14" />
      </svg>
    ),
  },
];

const recentTasks = [
  { id: "1", title: "Research competitors for SaaS product", status: "done" },
  { id: "2", title: "Write blog post about AI trends 2026", status: "done" },
  { id: "3", title: "Build a full landing page mockup", status: "done" },
  { id: "4", title: "Analyze sales data from Q1 CSV", status: "running" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col w-64 h-full bg-[#0d0d15] border-r border-[#1e1e2e] shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[#1e1e2e]">
        <QuillLogo size={28} />
        <span className="text-lg font-semibold gradient-text tracking-tight">
          Quill AI
        </span>
      </div>

      {/* New task button */}
      <div className="px-3 pt-4">
        <Link
          href="/agent"
          className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl bg-[#7c6af7] hover:bg-[#6b58e8] text-white text-sm font-medium transition-all duration-150 shadow-lg shadow-[rgba(124,106,247,0.25)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Task
        </Link>
      </div>

      {/* Nav */}
      <nav className="px-3 pt-4 flex flex-col gap-0.5">
        {navItems.slice(1).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
              pathname === item.href
                ? "bg-[#1e1e2e] text-[#e8e8f0]"
                : "text-[#6b6b8a] hover:text-[#e8e8f0] hover:bg-[#16161f]"
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Recent tasks */}
      <div className="flex-1 overflow-y-auto px-3 pt-6">
        <p className="px-3 pb-2 text-xs font-medium text-[#6b6b8a] uppercase tracking-wider">
          Recent
        </p>
        <div className="flex flex-col gap-0.5">
          {recentTasks.map((task) => (
            <Link
              key={task.id}
              href={`/agent?task=${task.id}`}
              className="group flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-[#16161f] transition-all duration-150"
            >
              <span className="mt-1 shrink-0">
                {task.status === "running" ? (
                  <span className="block w-1.5 h-1.5 rounded-full bg-[#7c6af7] animate-pulse-glow" />
                ) : (
                  <span className="block w-1.5 h-1.5 rounded-full bg-[#2a2a3e]" />
                )}
              </span>
              <span className="text-[13px] text-[#6b6b8a] group-hover:text-[#b8b8d0] leading-snug line-clamp-2 transition-colors">
                {task.title}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* User profile */}
      <div className="px-3 py-3 border-t border-[#1e1e2e]">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#16161f] transition-all cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#a78bfa] to-[#60a5fa] flex items-center justify-center text-xs font-bold text-white shrink-0">
            U
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#e8e8f0] truncate">User</p>
            <p className="text-xs text-[#6b6b8a] truncate">Free plan</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
