import type { Metadata } from "next";
import Link from "next/link";
import { QuillLogo } from "@/components/ui/QuillLogo";
import { stripeClient } from "@/lib/stripe/client";
import { getPlanFromStripePriceId } from "@/lib/stripe/types";

export const metadata: Metadata = {
  title: "Success — Quill AI",
  description: "Thank you for upgrading your Quill AI plan.",
};

type SearchParams = {
  session_id?: string | string[];
};

type SuccessState = {
  planName: string;
  confirmed: boolean;
  message: string;
};

async function resolveSuccessState(searchParams?: SearchParams): Promise<SuccessState> {
  const raw = searchParams?.session_id;
  const sessionId = Array.isArray(raw) ? raw[0] : raw;

  if (!sessionId) {
    return {
      planName: "your new plan",
      confirmed: false,
      message:
        "Your payment is being finalized. If this page was opened manually, check Billing in Settings for the latest status.",
    };
  }

  try {
    const checkout = await stripeClient.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price"],
    });

    const lineItem = checkout.line_items?.data?.[0];
    const stripePriceId = typeof lineItem?.price === "string" ? lineItem.price : lineItem?.price?.id;
    const plan = getPlanFromStripePriceId(stripePriceId);
    const planName = plan === "team" ? "Team Ops" : "Pro Control";

    const confirmed = checkout.payment_status === "paid" || checkout.status === "complete";
    return {
      planName,
      confirmed,
      message: confirmed
        ? `Your ${planName} subscription is now active.`
        : "Your payment is processing. It can take a moment for billing status to refresh.",
    };
  } catch {
    return {
      planName: "your new plan",
      confirmed: false,
      message: "We could not verify this checkout session yet. Visit Settings to confirm subscription status.",
    };
  }
}

export default async function SuccessPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const state = await resolveSuccessState(resolvedSearchParams);

  return (
    <div className="min-h-screen bg-quill-bg text-quill-text flex items-center justify-center">
      <div className="max-w-md mx-auto text-center p-8">
        <QuillLogo size={48} />

        <div className="mt-8">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              state.confirmed ? "bg-green-500/20" : "bg-amber-500/20"
            }`}
          >
            <svg
              className={`w-8 h-8 ${state.confirmed ? "text-green-400" : "text-amber-400"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-quill-text mb-2">
            {state.confirmed ? `Welcome to ${state.planName}!` : "Checkout received"}
          </h1>

          <p className="text-quill-muted mb-8">{state.message}</p>

          <div className="space-y-4">
            <div className="bg-[#0d0d15] rounded-xl border border-quill-border p-4">
              <h3 className="font-semibold text-quill-text mb-2">Your new features</h3>
              <ul className="text-sm text-quill-muted space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-[#EF4444] rounded-full"></span>
                  Unlimited providers and environments
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-[#EF4444] rounded-full"></span>
                  Advanced policy and rules
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-[#EF4444] rounded-full"></span>
                  Fast + Balanced + Reasoning profiles
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-[#EF4444] rounded-full"></span>
                  Priority email support
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/agent"
                className="flex-1 flex items-center justify-center h-10 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white text-sm font-semibold transition-all"
              >
                Start Building with Quill
              </Link>

              <Link
                href="/settings"
                className="flex-1 flex items-center justify-center h-10 rounded-xl border border-quill-border text-sm font-medium text-quill-text hover:bg-quill-border transition-all"
              >
                Manage Subscription
              </Link>
            </div>
          </div>
        </div>

        <p className="text-xs text-[#6F737A] mt-12">Your billing confirmation has been sent to your email address.</p>
      </div>
    </div>
  );
}
