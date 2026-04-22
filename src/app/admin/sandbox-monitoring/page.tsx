import type { Metadata } from "next";
import { QuillLogo } from "@/components/ui/QuillLogo";

export const metadata: Metadata = {
  title: "Sandbox Monitoring — Quill AI",
  description: "Enhanced sandbox validation and execution monitoring dashboard for security and performance.",
};

export default function SandboxMonitoringPage() {
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
          <button className="text-sm px-3 py-1 border border-quill-border rounded-lg hover:bg-quill-border">
            Reset Stats
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Dashboard Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-quill-text mb-2">Sandbox Monitoring Dashboard</h1>
          <p className="text-quill-muted">
            Monitor enhanced validation metrics, security warnings, and execution performance.
          </p>
        </div>

        {/* Security Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-[#0d0d15] rounded-2xl border border-quill-border p-6">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-quill-muted mb-2">
              Low Risk Executions
            </h3>
            <div className="text-2xl font-bold text-green-400">0</div>
            <p className="text-xs text-[#6F737A] mt-1">24-hour baseline</p>
          </div>

          <div className="bg-[#0d0d15] rounded-2xl border border-quill-border p-6">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-quill-muted mb-2">
              Medium Risk Alerts
            </h3>
            <div className="text-2xl font-bold text-yellow-400">0</div>
            <p className="text-xs text-[#6F737A] mt-1">Review required</p>
          </div>

          <div className="bg-[#0d0d15] rounded-2xl border border-quill-border p-6">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-quill-muted mb-2">
              Security Blocks
            </h3>
            <div className="text-2xl font-bold text-red-400">0</div>
            <p className="text-xs text-[#6F737A] mt-1">Prevented execution</p>
          </div>

          <div className="bg-[#0d0d15] rounded-2xl border border-quill-border p-6">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-quill-muted mb-2">
              Avg Validation Time
            </h3>
            <div className="text-2xl font-bold text-blue-400">0ms</div>
            <p className="text-xs text-[#6F737A] mt-1">Pre-execution latency</p>
          </div>
        </div>

        {/* Security Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Recent Security Events */}
          <div className="bg-[#0d0d15] rounded-2xl border border-quill-border p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-quill-text">Recent Security Events</h3>
              <button className="text-xs px-3 py-1 border border-quill-border rounded-lg hover:bg-quill-border">
                View All
              </button>
            </div>

            <div className="space-y-3">
              {[
                {
                  type: 'critical',
                  message: 'Potential OS command injection detected',
                  timestamp: '2 minutes ago',
                  code: 'os.system(frm tempfile...)'
                },
                {
                  type: 'error',
                  message: 'Network requests not allowed',
                  timestamp: '5 minutes ago',
                  code: 'requests.get(api)'
                },
                {
                  type: 'warning',
                  message: 'High complexity code detected',
                  timestamp: '12 minutes ago',
                  code: 'nested_function_calls'
                },
                {
                  type: 'warning',
                  message: 'Resource consumption concerns',
                  timestamp: '24 minutes ago',
                  code: 'large_list_operations'
                }
              ].map((event, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border border-quill-border rounded-lg">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    event.type === 'critical' ? 'bg-red-500' :
                    event.type === 'error' ? 'bg-red-400' :
                    'bg-yellow-400'
                  }`}></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-quill-text">{event.message}</div>
                    <div className="text-xs text-[#6F737A] mt-1">
                      {event.timestamp} • {event.code}
                    </div>
                  </div>
                  <button className="text-xs text-quill-muted hover:text-quill-text">
                    Details
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-[#0d0d15] rounded-2xl border border-quill-border p-6">
            <h3 className="text-lg font-semibold text-quill-text mb-4">Performance Analytics</h3>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm text-quill-muted mb-2">
                  <span>Execution Success Rate</span>
                  <span>98.5%</span>
                </div>
                <div className="h-3 bg-quill-surface rounded-full overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: '98.5%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm text-quill-muted mb-2">
                  <span>Avg Validation Time</span>
                  <span>45ms</span>
                </div>
                <div className="h-3 bg-quill-surface rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: '25%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm text-quill-muted mb-2">
                  <span>Code Complexity Average</span>
                  <span>6.8/10</span>
                </div>
                <div className="h-3 bg-quill-surface rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500" style={{ width: '68%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm text-quill-muted mb-2">
                  <span>Resource Violations</span>
                  <span>2.3%</span>
                </div>
                <div className="h-3 bg-quill-surface rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500" style={{ width: '2.3%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Language Statistics */}
        <div className="bg-[#0d0d15] rounded-2xl border border-quill-border p-6 mb-8">
          <h3 className="text-lg font-semibold text-quill-text mb-4">Language Usage Statistics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { language: 'Python', executions: 1245, successRate: 98.2, avgTime: 120 },
              { language: 'JavaScript', executions: 876, successRate: 96.8, avgTime: 95 },
              { language: 'TypeScript', executions: 423, successRate: 99.1, avgTime: 150 },
              { language: 'SQL', executions: 312, successRate: 97.5, avgTime: 80 },
              { language: 'Bash', executions: 234, successRate: 94.1, avgTime: 60 },
              { language: 'Go', executions: 156, successRate: 99.3, avgTime: 200 },
            ].map((lang, index) => (
              <div key={index} className="border border-quill-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-semibold text-quill-text">{lang.language}</div>
                    <div className="text-xs text-[#6F737A]">{lang.executions} executions</div>
                  </div>
                  <div className="text-lg font-bold text-green-400">{lang.successRate}%</div>
                </div>
                <div className="text-xs text-quill-muted">
                  Avg: {lang.avgTime}ms | Best: Python
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resource Usage Analysis */}
        <div className="bg-[#0d0d15] rounded-2xl border border-quill-border p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-quill-text">Resource Usage Analysis</h3>
            <div className="flex gap-2">
              <button className="text-xs px-3 py-1 border border-quill-border rounded-lg hover:bg-quill-border">
                Export Report
              </button>
              <button className="text-xs px-3 py-1 border border-quill-border rounded-lg hover:bg-quill-border">
                Adjust Limits
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-quill-muted mb-3">Memory Usage Trends</h4>
              <div className="h-32 bg-quill-surface rounded-lg flex items-center justify-center">
                <span className="text-xs text-[#6F737A]">Memory usage chart loading...</span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-quill-muted mb-3">Execution Timeline</h4>
              <div className="h-32 bg-quill-surface rounded-lg flex items-center justify-center">
                <span className="text-xs text-[#6F737A]">Execution timeline chart loading...</span>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { metric: 'Peak Memory', value: '512MB', status: 'healthy' },
              { metric: 'Avg CPU', value: '45%', status: 'optimal' },
              { metric: 'Timeout Rate', value: '2.1%', status: 'stable' },
              { metric: 'Error Rate', value: '1.3%', status: 'excellent' },
            ].map((item, index) => (
              <div key={index} className="border border-quill-border rounded-lg p-3">
                <div className="text-xs text-quill-muted">{item.metric}</div>
                <div className="text-lg font-bold text-quill-text">{item.value}</div>
                <div className="text-xs text-green-400">{item.status}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Configuration Panel */}
        <div className="bg-[#0d0d15] rounded-2xl border border-quill-border p-6">
          <h3 className="text-lg font-semibold text-quill-text mb-4">Sandbox Configuration</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-quill-muted">Security Settings</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-quill-text">Enable OS Command Detection</span>
                  <div className="w-10 h-6 bg-blue-500 rounded-full relative">
                    <div className="w-4 h-4 bg-white rounded-full absolute right-1 top-1"></div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-quill-text">Network Request Scanning</span>
                  <div className="w-10 h-6 bg-blue-500 rounded-full relative">
                    <div className="w-4 h-4 bg-white rounded-full absolute right-1 top-1"></div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-quill-text">File System Access Control</span>
                  <div className="w-10 h-6 bg-gray-600 rounded-full relative">
                    <div className="w-4 h-4 bg-white rounded-full absolute left-1 top-1"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium text-quill-muted">Performance Settings</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-quill-text">Max Execution Time</label>
                  <div className="text-xs text-[#6F737A]">30 seconds</div>
                </div>
                <div>
                  <label className="text-sm text-quill-text">Max Code Size</label>
                  <div className="text-xs text-[#6F737A]">50KB</div>
                </div>
                <div>
                  <label className="text-sm text-quill-text">Max Lines</label>
                  <div className="text-xs text-[#6F737A]">1000 lines</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
