import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db";
import { userEntitlements } from "@/db/schema";
import { eq } from "drizzle-orm";
import { stripeClient } from "@/lib/stripe/client";
import { getPlanFromStripePriceId } from "@/lib/stripe/types";

const WH_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

function asString(value: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined): string | null {
  if (typeof value === "string") return value;
  if (value && "id" in value && typeof value.id === "string") return value.id;
  return null;
}

function getUnixTimestamp(record: unknown, key: string): number | null {
  const value = (record as Record<string, unknown>)[key];
  return typeof value === "number" ? value : null;
}

async function handleCheckoutCompleted(event: Stripe.Event) {
  const checkoutSession = event.data.object as Stripe.Checkout.Session;
  const userId = checkoutSession.metadata?.userId;

  if (!userId || checkoutSession.mode !== "subscription" || !checkoutSession.subscription) {
    return { received: true };
  }

  const subscriptionId =
    typeof checkoutSession.subscription === "string" ? checkoutSession.subscription : checkoutSession.subscription.id;
  const subscription = (await stripeClient.stripe.subscriptions.retrieve(
    subscriptionId,
  )) as unknown as Stripe.Subscription;
  const customerId = asString(subscription.customer);
  const periodStart = getUnixTimestamp(subscription, "current_period_start");
  const periodEnd = getUnixTimestamp(subscription, "current_period_end");
  const stripePriceId = subscription.items.data[0]?.price.id ?? null;
  const inferredPlan = getPlanFromStripePriceId(stripePriceId) ?? "pro";

  const values = {
    plan: inferredPlan,
    status: (subscription.status === "active" ? "active" : "past_due") as "active" | "past_due",
    paidStartsAt: periodStart ? new Date(periodStart * 1000) : null,
    paidEndsAt: periodEnd ? new Date(periodEnd * 1000) : null,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId,
    stripeInvoiceId: null,
    webhookProcessedAt: new Date(),
    updatedAt: new Date(),
  };

  await db.transaction(async (tx) => {
    const existing = await tx.query.userEntitlements.findFirst({
      where: eq(userEntitlements.userId, userId),
    });

    if (!existing) {
      await tx.insert(userEntitlements).values({ userId, ...values });
      return;
    }

    await tx.update(userEntitlements).set(values).where(eq(userEntitlements.userId, userId));
  });

  return { received: true };
}

async function handleInvoicePaid(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };
  const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;

  if (!subscriptionId) {
    return { received: true };
  }

  const subscription = (await stripeClient.stripe.subscriptions.retrieve(
    subscriptionId,
  )) as unknown as Stripe.Subscription;
  const periodStart = getUnixTimestamp(subscription, "current_period_start");
  const periodEnd = getUnixTimestamp(subscription, "current_period_end");
  await db
    .update(userEntitlements)
    .set({
      status: "active",
      paidStartsAt: periodStart ? new Date(periodStart * 1000) : null,
      paidEndsAt: periodEnd ? new Date(periodEnd * 1000) : null,
      stripeInvoiceId: invoice.id,
      webhookProcessedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(userEntitlements.stripeSubscriptionId, subscription.id));

  return { received: true };
}

async function handleInvoicePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };
  const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;

  if (!subscriptionId) {
    return { received: true };
  }

  await db
    .update(userEntitlements)
    .set({
      status: "past_due",
      stripeInvoiceId: invoice.id,
      webhookProcessedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(userEntitlements.stripeSubscriptionId, subscriptionId));

  return { received: true };
}

async function handleSubscriptionDeleted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;

  await db
    .update(userEntitlements)
    .set({
      status: "canceled",
      webhookProcessedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(userEntitlements.stripeSubscriptionId, subscription.id));

  return { received: true };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature || !WH_SECRET) {
      return NextResponse.json({ error: "Missing webhook signature or secret" }, { status: 400 });
    }

    const event = stripeClient.stripe.webhooks.constructEvent(body, signature, WH_SECRET);

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaid(event);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event);
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
