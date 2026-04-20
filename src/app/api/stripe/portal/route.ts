import { NextRequest, NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth/server";
import { getUserEntitlementByUserId } from "@/lib/data/db-helpers";
import { stripeClient } from "@/lib/stripe/client";

export async function GET(req: NextRequest) {
  try {
    const sessionData = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
    if (!sessionData?.user?.id) {
      const loginUrl = new URL("/login", req.nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", "/settings");
      return NextResponse.redirect(loginUrl);
    }

    const entitlement = await getUserEntitlementByUserId(sessionData.user.id);
    const customerId = entitlement?.stripeCustomerId;

    if (!customerId) {
      return NextResponse.redirect(new URL("/settings?billing=missing", req.nextUrl.origin));
    }

    const portalSession = await stripeClient.createPortalSession({
      customerId,
      returnUrl: `${req.nextUrl.origin}/settings`,
    });

    return NextResponse.redirect(portalSession.url);
  } catch (error) {
    console.error("Billing portal route error:", error);
    return NextResponse.redirect(new URL("/settings?billing=error", req.nextUrl.origin));
  }
}
