import { createUserEntitlement, getUserEntitlementByUserId, updateUserEntitlement } from "@/lib/data/db-helpers";

type ResolvedEntitlement = {
  canUsePaidModes: boolean;
  planLabel: string;
  source: "env" | "db";
  trialEndsAt?: string;
  trialDaysLeft?: number;
};

function parseCsvEnv(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
  );
}

function getTrialDays(): number {
  const parsed = Number(process.env.PAID_TRIAL_DAYS ?? "7");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
}

function strictEntitlementsEnabled(): boolean {
  return process.env.ENTITLEMENTS_STRICT_MODE === "true";
}

function resolveFromEnv(userId: string, email?: string): ResolvedEntitlement {
  const allowAll = process.env.ALLOW_ALL_AUTH_MODES === "true";
  const paidUserIds = parseCsvEnv(process.env.PAID_USER_IDS);
  const paidUserEmails = parseCsvEnv(process.env.PAID_USER_EMAILS);

  const userIdLower = userId.toLowerCase();
  const userEmailLower = (email ?? "").toLowerCase();
  const canUsePaidModes =
    allowAll || paidUserIds.has(userIdLower) || (userEmailLower ? paidUserEmails.has(userEmailLower) : false);

  return {
    canUsePaidModes,
    planLabel: canUsePaidModes ? "Paid access" : "Free",
    source: "env",
  };
}

export async function resolveUserEntitlements(input: { userId: string; email?: string }): Promise<ResolvedEntitlement> {
  const envEntitlement = resolveFromEnv(input.userId, input.email);

  if (envEntitlement.canUsePaidModes) {
    return envEntitlement;
  }

  const now = new Date();
  const trialDays = getTrialDays();

  try {
    let record = await getUserEntitlementByUserId(input.userId);

    if (!record) {
      const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
      try {
        record = await createUserEntitlement({
          userId: input.userId,
          plan: "trial",
          status: "active",
          trialStartedAt: now,
          trialEndsAt,
        });
      } catch {
        // Concurrent first-request race: another request may have created it.
        record = await getUserEntitlementByUserId(input.userId);
      }
    }

    if (!record) {
      return {
        canUsePaidModes: false,
        planLabel: "Free",
        source: "db",
      };
    }

    if ((record.plan === "pro" || record.plan === "team") && record.status === "active") {
      return {
        canUsePaidModes: true,
        planLabel: record.plan === "team" ? "Team" : "Pro",
        source: "db",
      };
    }

    if (record.plan === "trial" && record.status === "active" && record.trialEndsAt) {
      const msLeft = record.trialEndsAt.getTime() - now.getTime();
      const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));

      if (msLeft > 0) {
        return {
          canUsePaidModes: true,
          planLabel: `Trial (${daysLeft}d left)`,
          source: "db",
          trialEndsAt: record.trialEndsAt.toISOString(),
          trialDaysLeft: daysLeft,
        };
      }

      const downgraded = await updateUserEntitlement(input.userId, {
        plan: "free",
        status: "expired",
      });

      return {
        canUsePaidModes: false,
        planLabel: downgraded?.status === "expired" ? "Free (trial ended)" : "Free",
        source: "db",
      };
    }

    return {
      canUsePaidModes: false,
      planLabel: record.status === "expired" ? "Free (trial ended)" : "Free",
      source: "db",
      trialEndsAt: record.trialEndsAt?.toISOString(),
    };
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "entitlements.resolve.failed",
        userId: input.userId,
        strict: strictEntitlementsEnabled(),
        message: error instanceof Error ? error.message : "unknown",
      }),
    );

    if (strictEntitlementsEnabled()) {
      return {
        canUsePaidModes: false,
        planLabel: "Free (entitlements unavailable)",
        source: "env",
      };
    }

    // Non-strict mode fallback for migration windows.
    return envEntitlement;
  }
}
