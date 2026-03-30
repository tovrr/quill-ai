"use client";

import { useEffect, useState } from "react";

type ModelSummary = {
  provider: string;
  model: string;
  calls: number;
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  imageCount: number;
};

type ModelUsageEvent = {
  id: string;
  feature: "chat" | "image";
  mode: "fast" | "thinking" | "advanced" | null;
  provider: string;
  model: string;
  estimatedCostUsd: number | null;
  totalTokens: number | null;
  imageCount: number;
  createdAt: string;
  route: string;
};

type UsagePayload = {
  totals: {
    eventCount: number;
    estimatedCostUsd: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    imageCount: number;
  };
  byModel: ModelSummary[];
  recent: ModelUsageEvent[];
};

const STORAGE_KEY = "quill_admin_metrics_token";

function formatUsd(value: number | null | undefined) {
  if (value == null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatNum(value: number | null | undefined) {
  if (value == null) return "-";
  return new Intl.NumberFormat("en-US").format(value);
}

export default function AdminModelUsagePage() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<UsagePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setToken(stored);
    } catch {
      // ignore
    }
  }, []);

  const load = async (nextToken = token) => {
    if (!nextToken.trim()) {
      setError("Metrics token is required.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      localStorage.setItem(STORAGE_KEY, nextToken);
    } catch {
      // ignore
    }

    try {
      const res = await fetch("/api/admin/model-usage?limit=200", {
        headers: {
          "x-metrics-token": nextToken,
        },
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? `Request failed (${res.status})`);
      }

      setData(payload as UsagePayload);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Failed to load model usage");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-quill-bg text-quill-text px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Admin Model Usage</h1>
          <p className="text-sm text-quill-muted">
            Inspect exact model/provider usage and estimated spend. This page requires the same token used for /api/metrics.
          </p>
        </div>

        <div className="rounded-2xl border border-quill-border bg-quill-surface p-4 md:p-5 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="flex-1 space-y-2">
              <span className="text-sm text-quill-muted">Metrics token</span>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full rounded-xl border border-quill-border bg-quill-bg px-3 py-2 text-sm outline-none focus:border-quill-border-2"
                placeholder="Paste API_METRICS_TOKEN"
              />
            </label>
            <button
              onClick={() => void load()}
              disabled={loading}
              className="rounded-xl border border-quill-border px-4 py-2 text-sm text-quill-text hover:border-quill-border-2 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Load usage"}
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}
        </div>

        {data && (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card label="Estimated cost" value={formatUsd(data.totals.estimatedCostUsd)} />
              <Card label="Total tokens" value={formatNum(data.totals.totalTokens)} />
              <Card label="Image count" value={formatNum(data.totals.imageCount)} />
              <Card label="Events" value={formatNum(data.totals.eventCount)} />
            </div>

            <section className="rounded-2xl border border-quill-border bg-quill-surface p-4 md:p-5">
              <h2 className="text-lg font-medium mb-4">By model</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-quill-muted">
                    <tr>
                      <th className="pb-3 pr-4">Provider</th>
                      <th className="pb-3 pr-4">Model</th>
                      <th className="pb-3 pr-4">Calls</th>
                      <th className="pb-3 pr-4">Tokens</th>
                      <th className="pb-3 pr-4">Images</th>
                      <th className="pb-3">Est. cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byModel.map((row) => (
                      <tr key={`${row.provider}:${row.model}`} className="border-t border-quill-border/70">
                        <td className="py-3 pr-4 text-quill-muted">{row.provider}</td>
                        <td className="py-3 pr-4 font-medium">{row.model}</td>
                        <td className="py-3 pr-4">{formatNum(row.calls)}</td>
                        <td className="py-3 pr-4">{formatNum(row.totalTokens)}</td>
                        <td className="py-3 pr-4">{formatNum(row.imageCount)}</td>
                        <td className="py-3">{formatUsd(row.estimatedCostUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-quill-border bg-quill-surface p-4 md:p-5">
              <h2 className="text-lg font-medium mb-4">Recent events</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-quill-muted">
                    <tr>
                      <th className="pb-3 pr-4">When</th>
                      <th className="pb-3 pr-4">Feature</th>
                      <th className="pb-3 pr-4">Mode</th>
                      <th className="pb-3 pr-4">Provider</th>
                      <th className="pb-3 pr-4">Model</th>
                      <th className="pb-3 pr-4">Tokens</th>
                      <th className="pb-3">Est. cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((event) => (
                      <tr key={event.id} className="border-t border-quill-border/70">
                        <td className="py-3 pr-4 text-quill-muted">{new Date(event.createdAt).toLocaleString()}</td>
                        <td className="py-3 pr-4">{event.feature}</td>
                        <td className="py-3 pr-4">{event.mode ?? "-"}</td>
                        <td className="py-3 pr-4 text-quill-muted">{event.provider}</td>
                        <td className="py-3 pr-4 font-medium">{event.model}</td>
                        <td className="py-3 pr-4">{formatNum(event.totalTokens)}</td>
                        <td className="py-3">{formatUsd(event.estimatedCostUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-quill-border bg-quill-surface p-4">
      <div className="text-sm text-quill-muted">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}
