export interface StripePrice {
  id: string;
  unit_amount: number;
  currency: "usd";
  recurring?: {
    interval: "month" | "year";
    interval_count: number;
  };
  product: {
    name: string;
    description?: string;
  };
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: "active" | "past_due" | "canceled" | "unpaid" | "incomplete";
  current_period_end: number;
  current_period_start: number;
  items: {
    price: StripePrice;
  }[];
  cancel_at_period_end: boolean;
}

export interface StripeCustomer {
  id: string;
  email?: string;
  name?: string;
  metadata?: {
    userId: string;
  };
}

export interface StripeCheckoutSession {
  id: string;
  url?: string;
  mode: "payment" | "subscription";
  customer: string;
  subscription?: string;
  payment_intent?: string;
  line_items: Array<{
    price: string;
    quantity?: number;
  }>;
}

export interface PaymentIntent {
  id: string;
  client_secret: string;
  status:
    | "succeeded"
    | "requires_payment_method"
    | "requires_confirmation"
    | "requires_action"
    | "processing"
    | "canceled";
  amount: number;
  currency: string;
}

export const PLANS = {
  FREE: {
    id: "free",
    name: "Free",
    price: 0,
    features: [
      "Up to 2 connected providers",
      "Cloud + local routing support",
      "Basic policy templates",
      "Personal workspace",
      "Fast + Balanced route profiles",
      "Daily usage quotas",
      "Community support",
    ],
  },
  PRO: {
    id: "pro",
    name: "Pro Control",
    price: 29,
    features: [
      "Unlimited providers and environments",
      "Advanced boundary and policy rules",
      "Key isolation + project-level quotas",
      "Fast + Balanced + Reasoning profiles",
      "Budget caps and route overrides",
      "90-day audit timeline",
      "Priority email support",
    ],
  },
  TEAM: {
    id: "team",
    name: "Team Ops",
    price: 99,
    features: [
      "Everything in Pro Control",
      "Multi-user workspace + role controls",
      "Shared policy packs",
      "Team analytics by provider and route",
      "1-year audit retention + exports",
      "Onboarding guidance for small teams",
      "Priority support SLA",
    ],
  },
} as const;

export type PlanType = keyof typeof PLANS;
export type PlanId = "free" | "trial" | "pro" | "team";

export function getStripePriceId(plan: "pro" | "team"): string | null {
  if (plan === "pro") {
    return process.env.STRIPE_PRICE_ID_PRO?.trim() || null;
  }

  return process.env.STRIPE_PRICE_ID_TEAM?.trim() || null;
}

export function getPlanFromStripePriceId(priceId: string | null | undefined): "pro" | "team" | null {
  if (!priceId) return null;

  const pro = process.env.STRIPE_PRICE_ID_PRO?.trim();
  const team = process.env.STRIPE_PRICE_ID_TEAM?.trim();

  if (pro && priceId === pro) return "pro";
  if (team && priceId === team) return "team";

  return null;
}
