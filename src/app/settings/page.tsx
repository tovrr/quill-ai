import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { QuillLogo } from "@/components/ui/QuillLogo";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth/server";
import { getUserEntitlementByUserId } from "@/lib/data/db-helpers";

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

export default async function SettingsPage() {
  const sessionData = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
  if (!sessionData?.user?.id) {
    redirect("/login?callbackUrl=/settings");
  }

  const entitlement = await getUserEntitlementByUserId(sessionData.user.id);
  const activePlan = entitlement?.plan ?? "free";
  const activeStatus = entitlement?.status ?? "active";
  const billingDate = entitlement?.paidEndsAt ?? entitlement?.trialEndsAt ?? null;
  const canManageBilling = Boolean(entitlement?.stripeCustomerId);

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
