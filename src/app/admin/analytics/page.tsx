import type { Metadata } from "next";
import { QuillLogo } from "@/components/ui/QuillLogo";

export const metadata: Metadata = {
  title: "Analytics Dashboard — Quill AI",
  description: "Comprehensive analytics and monitoring dashboard for system performance and user behavior.",
};

export default function AnalyticsDashboardPage() {
  return (
    <div className="min-h-screen bg-quill-bg text-quill-text">
      {/* Header */}
      <nav className="border-b border-quill-border px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <QuillLogo size={22} />
          <span className="text-sm font-semibold gradient-text tracking-tight">Quill AI</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="/admin" className="text-sm text-quill-muted hover:text-quill-text">
            Back to Admin
          </a>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Dashboard Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-quill-text mb-2">Analytics Dashboard</h1>
          <p className="text-quill-muted">
            Monitor system performance, user behavior, and feature usage across Quill AI.
          </p>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-[#0d0d15] rounded-2xl border border-quill-border p-6">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-quill-muted mb-2">Active Users</h3>
            <div className="text-2xl font-bold text-[#3b82f6]">0</div>
            <p className="text-xs text-[#6F737A] mt-1">Last 24 hours</p>
          </div>

          <div className="bg-[#0d0d15] rounded-2xl border border-quill-border p-6">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-quill-muted mb-2">Avg Response Time</h3>
            <div className="text-2xl font-bold text-[#10b981]">0ms</div>
            <p className="text-xs text-[#6F737A] mt-1">System performance</p>
          </div>

          <div className="bg-[#0d0d15] rounded-2xl border border-quill-border p-6">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-quill-muted mb-2">Error Rate</h3>
            <div className="text-2xl font-bold text-[#f59e0b]">0%</div>
            <p className="text-xs text-[#6F737A] mt-1">24-hour baseline</p>
          </div>

          <div className="bg-[#0d0d15] rounded-2xl border border-quill-border p-6">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-quill-muted mb-2">Total Messages</h3>
            <div className="text-2xl font-bold text-[#8b5cf6]">0</div>
            <p className="text-xs text-[#6F737A] mt-1">Last 24 hours</p>
          </div>
        </div>

        {/* Analytics Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* System Performance */}
          <div className="bg-[#0d0d15] rounded-2xl border border-quill-border p-6">
            <h3 className="text-lg font-semibold text-quill-text mb-4">System Performance</h3>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm text-quill-muted mb-2">
                  <span>Response Time</span>
                  <span>Avg: 0ms</span>
                </div>
                <div className="h-16 bg-quill-surface rounded-lg flex items-center justify-center">
                  <span className="text-xs text-[#6F737A]">Performance chart loading...</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm text-quill-muted mb-2">
                  <span>Server Uptime</span>
                  <span>100%</span>
                </div>
                <div className="h-2 bg-quill-surface rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 w-full"></div>
                </div>
              </div>
            </div>
          </div>

          {/* User Activity */}
          <div className="bg-[#0d0d15] rounded-2xl border border-quill-border p-6">
            <h3 className="text-lg font-semibold text-quill-text mb-4">User Activity</h3>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm text-quill-muted mb-2">
                  <span>Active Sessions</span>
                  <span>0</span>
                </div>
                <div className="h-16 bg-quill-surface rounded-lg flex items-center justify-center">
                  <span className="text-xs text-[#6F737A]">Activity chart loading...</span>
                </div>
              </div>

              <div>
                <div className="text-sm text-quill-muted mb-2">Weekly Growth</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-green-400">+12%</span>
                  <span className="text-xs text-[#6F737A]">vs last week</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Usage Analytics */}
        <div className="bg-[#0d0d15] rounded-2xl border border-quill-border p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-quill-text">Feature Usage Analytics</h3>
            <div className="flex gap-2">
              <button className="text-xs px-3 py-1 border border-quill-border rounded-lg text-quill-muted hover:bg-quill-border">
                Last 7 days
              </button>
              <button className="text-xs px-3 py-1 border border-quill-border rounded-lg text-quill-muted hover:bg-quill-border">
                Last 30 days
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { feature: "Chat (Fast Mode)", usage: 1245, users: 456, growth: "+8%" },
              { feature: "Chat (Thinking Mode)", usage: 876, users: 234, growth: "+15%" },
              { feature: "Chat (Advanced Mode)", usage: 234, users: 89, growth: "+22%" },
              { feature: "Image Generation", usage: 567, users: 178, growth: "+5%" },
              { feature: "Web Search", usage: 445, users: 123, growth: "+12%" },
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between py-3 border-b border-quill-border">
                <div>
                  <div className="font-medium text-quill-text">{item.feature}</div>
                  <div className="text-xs text-[#6F737A]">{item.users} unique users</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-quill-text">{item.usage}</div>
                  <div className={`text-xs ${item.growth.startsWith("+") ? "text-green-400" : "text-red-400"}`}>
                    {item.growth}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Maintenance Section */}
        <div className="bg-[#0d0d15] rounded-2xl border border-quill-border p-6">
          <h3 className="text-lg font-semibold text-quill-text mb-4">System Maintenance</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button className="flex items-center gap-3 p-4 border border-quill-border rounded-lg hover:bg-quill-border transition-all">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <div className="text-left">
                <div className="font-medium text-quill-text">Export Analytics</div>
                <div className="text-xs text-[#6F737A]">Download metrics and reports</div>
              </div>
            </button>

            <button className="flex items-center gap-3 p-4 border border-quill-border rounded-lg hover:bg-quill-border transition-all">
              <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>
              <div className="text-left">
                <div className="font-medium text-quill-text">Cleanup Data</div>
                <div className="text-xs text-[#6F737A]">Remove old metric records</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
