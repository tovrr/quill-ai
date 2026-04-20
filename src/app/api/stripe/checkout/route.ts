import { NextRequest, NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth/server";
import { stripeClient } from "@/lib/stripe/client";
import { getStripePriceId, type PlanId } from "@/lib/stripe/types";

type CheckoutRequestBody = {
  plan?: PlanId;
};

export async function POST(req: NextRequest) {
  try {
    const sessionData = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
    if (!sessionData?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as CheckoutRequestBody;
    const plan = body.plan;

    if (plan !== "pro" && plan !== "team") {
      return NextResponse.json({ error: "Invalid plan selection" }, { status: 400 });
    }

    const priceId = getStripePriceId(plan);
    if (!priceId) {
      return NextResponse.json({ error: "Plan is not configured for checkout" }, { status: 503 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
    const checkoutSession = await stripeClient.createCheckoutSession({
      userId: sessionData.user.id,
      customerEmail: sessionData.user.email ?? undefined,
      priceId,
      mode: "subscription",
      successUrl: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/pricing`,
    });

    if (!checkoutSession.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 502 });
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Checkout route error:", error);
    return NextResponse.json({ error: "Checkout session creation failed" }, { status: 500 });
  }
}
