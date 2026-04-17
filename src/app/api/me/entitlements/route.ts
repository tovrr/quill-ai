import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { isWebSearchConfigured } from "@/lib/integrations/web-search";
import { resolveUserEntitlements } from "@/lib/auth/entitlements";

export const dynamic = "force-dynamic";

export async function GET() {
  const webSearchConfigured = isWebSearchConfigured();

  const sessionData = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);

  if (!sessionData?.user?.id) {
    return NextResponse.json(
      {
        authenticated: false,
        canUsePaidModes: false,
        planLabel: "Guest",
        canUseWebSearch: false,
        webSearchState: webSearchConfigured ? "auth-required" : "coming-soon",
      },
      { status: 200 }
    );
  }

  const entitlement = await resolveUserEntitlements({
    userId: sessionData.user.id,
    email: sessionData.user.email ?? "",
  });

  return NextResponse.json(
    {
      authenticated: true,
      userId: sessionData.user.id,
      email: sessionData.user.email ?? "",
      canUsePaidModes: entitlement.canUsePaidModes,
      planLabel: entitlement.planLabel,
      trialEndsAt: entitlement.trialEndsAt,
      trialDaysLeft: entitlement.trialDaysLeft,
      entitlementsSource: entitlement.source,
      canUseWebSearch: webSearchConfigured,
      webSearchState: webSearchConfigured ? "available" : "coming-soon",
    },
    { status: 200 }
  );
}
