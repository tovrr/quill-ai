import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { countUserMessagesToday } from "@/lib/db-helpers";
import { isWebSearchConfigured } from "@/lib/web-search";
import { resolveUserEntitlements } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

function getLimits() {
  return {
    fast: Number(process.env.FREE_DAILY_MESSAGES ?? "60"),
    thinking: Number(process.env.THINK_DAILY_MESSAGES ?? "30"),
    advanced: Number(process.env.PRO_DAILY_MESSAGES ?? "100"),
  };
}

export async function GET() {
  const sessionData = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
  if (!sessionData?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entitlement = await resolveUserEntitlements({
    userId: sessionData.user.id,
    email: sessionData.user.email ?? "",
  });
  const canUsePaidModes = entitlement.canUsePaidModes;

  const limits = getLimits();
  const messagesUsedToday = await countUserMessagesToday(sessionData.user.id);
  const recommendedDailyLimit = canUsePaidModes ? limits.advanced : limits.fast;
  const usagePercent = Math.min(100, Math.round((messagesUsedToday / Math.max(1, recommendedDailyLimit)) * 100));
  const webSearchConfigured = isWebSearchConfigured();

  return NextResponse.json(
    {
      authenticated: true,
      planLabel: entitlement.planLabel,
      canUsePaidModes,
      trialEndsAt: entitlement.trialEndsAt,
      trialDaysLeft: entitlement.trialDaysLeft,
      entitlementsSource: entitlement.source,
      messagesUsedToday,
      recommendedDailyLimit,
      usagePercent,
      limits,
      canUseWebSearch: webSearchConfigured,
      webSearchState: webSearchConfigured ? "available" : "coming-soon",
      imageGenerationState: "auth-required",
    },
    { status: 200 }
  );
}