import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { isWebSearchConfigured } from "@/lib/web-search";

export const dynamic = "force-dynamic";

function parseCsvEnv(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
  );
}

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

  const allowAll = process.env.ALLOW_ALL_AUTH_MODES === "true";
  const paidUserIds = parseCsvEnv(process.env.PAID_USER_IDS);
  const paidUserEmails = parseCsvEnv(process.env.PAID_USER_EMAILS);

  const userId = sessionData.user.id.toLowerCase();
  const userEmail = (sessionData.user.email ?? "").toLowerCase();
  const canUsePaidModes =
    allowAll || paidUserIds.has(userId) || (userEmail ? paidUserEmails.has(userEmail) : false);

  return NextResponse.json(
    {
      authenticated: true,
      userId: sessionData.user.id,
      email: sessionData.user.email ?? "",
      canUsePaidModes,
      planLabel: canUsePaidModes ? "Paid access" : "Free",
      canUseWebSearch: webSearchConfigured,
      webSearchState: webSearchConfigured ? "available" : "coming-soon",
    },
    { status: 200 }
  );
}
