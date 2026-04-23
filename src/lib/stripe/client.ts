import "server-only";
import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

function ensureStripe(): Stripe {
  if (stripeInstance) return stripeInstance;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY environment variable");
  }
  stripeInstance = new Stripe(key, {
    apiVersion: "2025-08-27.basil",
    typescript: true,
  });
  return stripeInstance;
}

export const stripeClient = {
  // note: Stripe is created lazily to avoid build-time throws when env vars are absent

  createCustomer: async (user: { id: string; email?: string; name?: string }) => {
    const stripe = ensureStripe();
    return stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: {
        userId: user.id,
      },
    });
  },

  createCheckoutSession: async (params: {
    userId: string;
    customerEmail?: string;
    priceId: string;
    mode: "subscription" | "payment";
    successUrl: string;
    cancelUrl: string;
  }) => {
    const { userId, customerEmail, priceId, mode, successUrl, cancelUrl } = params;

    const stripe = ensureStripe();
    let customerId: string | undefined;

    if (customerEmail) {
      const existingCustomer = await stripe.customers.list({
        email: customerEmail,
        limit: 1,
      });

      if (existingCustomer.data.length > 0) {
        customerId = existingCustomer.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: customerEmail,
          metadata: {
            userId,
          },
        });
        customerId = customer.id;
      }
    }

    return stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : customerEmail,
      mode,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
      },
    });
  },

  createPortalSession: async (params: { customerId: string; returnUrl: string }) => {
    const stripe = ensureStripe();
    return stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    });
  },
};
