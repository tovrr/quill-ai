import {
  createUserEntitlement,
  getUserEntitlementByUserId,
  updateUserEntitlement,
} from "@/lib/db-helpers";

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
      .filter(Boolean)
  );
}

function getTrialDays(): number {
  const parsed = Number(process.env.PAID_TRIAL_DAYS ?? "7");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
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

export async function resolveUserEntitlements(input: {
  userId: string;
  email?: string;
}): Promise<ResolvedEntitlement> {
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
      record = await createUserEntitlement({
        userId: input.userId,
        plan: "trial",
        status: "active",
        trialStartedAt: now,
        trialEndsAt,
      });
    }

    if (record.plan === "paid" && record.status === "active") {
      return {
        canUsePaidModes: true,
        planLabel: "Paid",
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
  } catch {
    // Safe fallback while the new table is not migrated yet.
    return envEntitlement;
  }
}
