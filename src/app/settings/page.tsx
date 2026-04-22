import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { QuillLogo } from "@/components/ui/QuillLogo";
import { Button } from "@/components/ui/button";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { auth } from "@/lib/auth/server";
import { db } from "@/db";
import { userApiKeys, userSkills } from "@/db/schema";
import { getGoogleConnectionByUserId, getMcpServersByUserId, getUserEntitlementByUserId } from "@/lib/data/db-helpers";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Settings — Quill AI",
  description: "Manage your account settings and billing information.",
};

function formatDate(value: Date | null | undefined): string {
  if (!value) return "—";
  return value.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function planLabel(plan: string): string {
  if (plan === "team") return "Team Ops";
  if (plan === "pro") return "Pro Control";
  if (plan === "trial") return "Trial";
  return "Free";
}

type IntegrationStatus = "configured" | "not-configured" | "managed";

function statusClasses(status: IntegrationStatus): string {
  if (status === "configured") return "bg-green-900/30 text-green-400";
  if (status === "managed") return "bg-blue-900/30 text-blue-300";
  return "bg-zinc-800 text-zinc-300";
}

function statusLabel(status: IntegrationStatus): string {
  if (status === "configured") return "Configured";
  if (status === "managed") return "Managed";
  return "Not configured";
}

function IntegrationRow({
  name,
  description,
  status,
  href,
  cta = "Manage",
}: {
  name: string;
  description: string;
  status: IntegrationStatus;
  href: string;
  cta?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-quill-border bg-quill-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{name}</p>
          <span className={`px-2 py-0.5 text-[11px] rounded-full ${statusClasses(status)}`}>{statusLabel(status)}</span>
        </div>
        <p className="text-xs text-quill-muted mt-0.5">{description}</p>
      </div>
      <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  );
}

export default async function SettingsPage() {
  const sessionData = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
  if (!sessionData?.user?.id) {
    redirect("/login?callbackUrl=/settings");
  }

  const userId = sessionData.user.id;

  const [
    entitlement,
    googleConnection,
    mcpServers,
    installedSkills,
    apiKeys,
  ] = await Promise.all([
    getUserEntitlementByUserId(userId),
    getGoogleConnectionByUserId(userId),
    getMcpServersByUserId(userId),
    db.query.userSkills.findMany({ where: eq(userSkills.userId, userId) }),
    db.query.userApiKeys.findMany({ where: eq(userApiKeys.userId, userId) }),
  ]);

  const activePlan = entitlement?.plan ?? "free";
  const activeStatus = entitlement?.status ?? "active";
  const billingDate = entitlement?.paidEndsAt ?? entitlement?.trialEndsAt ?? null;
  const canManageBilling = Boolean(entitlement?.stripeCustomerId);
  const configuredSkillIds = new Set(installedSkills.filter((skill) => skill.enabled).map((skill) => skill.skillId));

  const googleStatus: IntegrationStatus = googleConnection ? "configured" : "not-configured";
  const notionStatus: IntegrationStatus = configuredSkillIds.has("notion") ? "configured" : "not-configured";
  const githubStatus: IntegrationStatus = configuredSkillIds.has("github") ? "configured" : "not-configured";
  const slackStatus: IntegrationStatus = configuredSkillIds.has("slack") ? "configured" : "not-configured";
  const linearStatus: IntegrationStatus = configuredSkillIds.has("linear") ? "configured" : "not-configured";
  const mcpStatus: IntegrationStatus = mcpServers.length > 0 ? "configured" : "not-configured";
  const apiKeyStatus: IntegrationStatus = apiKeys.length > 0 ? "configured" : "not-configured";
  const mcpConnectedCount = mcpServers.filter((server) => server.status === "connected").length;

  return (
    <div className="min-h-screen bg-quill-bg text-quill-text">
      {/* Header */}
      <nav className="border-b border-quill-border px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/agent" className="flex items-center gap-2.5">
          <QuillLogo size={22} />
          <span className="text-sm font-semibold gradient-text tracking-tight">Quill AI</span>
        </Link>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/agent">Back to Quill</Link>
          </Button>
          <AccountMenu compact />
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Billing Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Billing & Subscription</h2>

          <div className="bg-[#0d0d15] rounded-2xl border border-quill-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">{planLabel(activePlan)} plan</h3>
                <p className="text-sm text-quill-muted">
                  {activePlan === "free" ? "$0/month" : activePlan === "team" ? "$99/month" : "$29/month"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    activeStatus === "active"
                      ? "bg-green-900/30 text-green-400"
                      : activeStatus === "past_due"
                        ? "bg-amber-900/30 text-amber-400"
                        : "bg-zinc-800 text-zinc-300"
                  }`}
                >
                  {activeStatus}
                </span>
                <Button asChild variant="outline" size="sm" disabled={!canManageBilling}>
                  <Link href={canManageBilling ? "/api/stripe/portal" : "#"}>Manage</Link>
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-quill-muted">Next billing date</span>
                <span className="text-sm">{formatDate(billingDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-quill-muted">Payment method</span>
                <span className="text-sm">Managed in Stripe portal</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-quill-muted">Billing email</span>
                <span className="text-sm">{sessionData.user.email ?? "—"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Account Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Account</h2>

          <div className="bg-[#0d0d15] rounded-2xl border border-quill-border p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Email</h3>
              <p className="text-sm text-quill-muted">{sessionData.user.email ?? "—"}</p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Account created</h3>
              <p className="text-sm text-quill-muted">
                {formatDate(sessionData.user.createdAt ? new Date(sessionData.user.createdAt) : null)}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Subscription status</h3>
              <p className="text-sm text-quill-muted">
                {planLabel(activePlan)} plan {activeStatus}
              </p>
            </div>
          </div>
        </div>

        {/* Connections Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-2">Connections</h2>
          <p className="text-sm text-quill-muted mb-6">All integration and channel settings in one place.</p>

          <div className="bg-[#0d0d15] rounded-2xl border border-quill-border p-6 space-y-8">
            <div>
              <h3 className="text-lg font-semibold mb-3">Messaging Channels</h3>
              <div className="space-y-3">
                <IntegrationRow
                  name="Telegram"
                  description="Connect your Telegram bot through OpenClaw or Hermes bridge"
                  status="managed"
                  href="/agent?connect=openclaw"
                />
                <IntegrationRow
                  name="Discord"
                  description="Route Discord workflows through your external agent bridge"
                  status="managed"
                  href="/agent?connect=hermes"
                />
                <IntegrationRow
                  name="Slack"
                  description="Channel automation via Skills and bridge tooling"
                  status={slackStatus}
                  href="/skills"
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Productivity</h3>
              <div className="space-y-3">
                <IntegrationRow
                  name="Google Account"
                  description="Access Gmail, Calendar, and Docs from Workspace"
                  status={googleStatus}
                  href="/workspace"
                />
                <IntegrationRow
                  name="Notion"
                  description="Read and update Notion pages and databases"
                  status={notionStatus}
                  href="/skills"
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Developer Tools</h3>
              <div className="space-y-3">
                <IntegrationRow
                  name="GitHub"
                  description="Code operations and repository workflows"
                  status={githubStatus}
                  href="/skills"
                />
                <IntegrationRow
                  name="Linear"
                  description="Issue tracking and cycle workflows"
                  status={linearStatus}
                  href="/skills"
                />
                <IntegrationRow
                  name="MCP Servers"
                  description={`${mcpConnectedCount} connected of ${mcpServers.length} configured`}
                  status={mcpStatus}
                  href="/mcp"
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Secrets and Keys</h3>
              <div className="space-y-3">
                <IntegrationRow
                  name="Mission API Keys"
                  description={`${apiKeys.length} key${apiKeys.length === 1 ? "" : "s"} available for agent ingest`}
                  status={apiKeyStatus}
                  href="/missions"
                  cta="Open Missions"
                />
                <IntegrationRow
                  name="Webhooks and Triggers"
                  description="Configure trigger flows through autopilot and external bridges"
                  status="managed"
                  href="/autopilot"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-red-400">Danger Zone</h2>

          <div className="bg-[#0d0d15] rounded-2xl border border-quill-border p-6 space-y-4">
            <Button asChild variant="destructive" className="w-full" disabled={!canManageBilling}>
              <Link href={canManageBilling ? "/api/stripe/portal" : "#"}>Cancel Subscription</Link>
            </Button>

            <div className="text-xs text-[#6F737A]">
              Your plan remains active until the end of your current billing period. You can cancel or update billing in
              Stripe.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
