import { db } from "@/db";
import { userEntitlements } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface UserEntitlement {
  id: string;
  userId: string;
  plan: "free" | "trial" | "pro" | "team";
  status: "active" | "expired" | "canceled" | "past_due";
  paidStartsAt?: Date;
  paidEndsAt?: Date;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  stripeInvoiceId?: string;
  webhookProcessedAt?: Date;
}

export interface EntitlementsService {
  getUserEntitlement: (userId: string) => Promise<UserEntitlement | null>;
  checkEntitlement: (userId: string, requiredPlan: "free" | "trial" | "pro" | "team") => Promise<boolean>;
  createEntitlement: (userId: string, plan: UserEntitlement["plan"]) => Promise<UserEntitlement>;
  updateEntitlement: (userId: string, updates: Partial<UserEntitlement>) => Promise<UserEntitlement>;
  canAccessFeature: (userId: string, feature: keyof typeof FEATURE_REQUIREMENTS) => Promise<boolean>;
}

export const FEATURE_REQUIREMENTS = {
  // Basic features
  basic_chat: "free",
  message_history: "free",
  provider_connections: "free",

  // Pro features
  advanced_policy: "pro",
  reasoning_profiles: "pro",
  budget_controls: "pro",
  extended_audit: "pro",
  priority_support: "pro",

  // Team features
  multi_user: "team",
  shared_policies: "team",
  team_analytics: "team",
  extended_retention: "team",
} as const;

export class EntitlementsServiceImpl implements EntitlementsService {
  async getUserEntitlement(userId: string): Promise<UserEntitlement | null> {
    const entitlement = await db.query.userEntitlements.findFirst({
      where: eq(userEntitlements.userId, userId),
    });

    if (!entitlement) {
      return null;
    }

    return {
      id: entitlement.id,
      userId: entitlement.userId,
      plan: entitlement.plan,
      status: entitlement.status,
      paidStartsAt: entitlement.paidStartsAt ? new Date(entitlement.paidStartsAt) : undefined,
      paidEndsAt: entitlement.paidEndsAt ? new Date(entitlement.paidEndsAt) : undefined,
      stripeCustomerId: entitlement.stripeCustomerId ?? undefined,
      stripeSubscriptionId: entitlement.stripeSubscriptionId ?? undefined,
      stripePriceId: entitlement.stripePriceId ?? undefined,
      stripeInvoiceId: entitlement.stripeInvoiceId ?? undefined,
      webhookProcessedAt: entitlement.webhookProcessedAt ? new Date(entitlement.webhookProcessedAt) : undefined,
    };
  }

  async checkEntitlement(userId: string, requiredPlan: UserEntitlement["plan"]): Promise<boolean> {
    const entitlement = await this.getUserEntitlement(userId);

    if (!entitlement) {
      return requiredPlan === "free";
    }

    // Check if subscription is active and not expired
    if (entitlement.status === "active" && entitlement.paidEndsAt) {
      const now = new Date();
      if (entitlement.paidEndsAt > now) {
        // Check if current plan meets or exceeds required plan
        const planLevels = ["free", "trial", "pro", "team"] as const;
        const currentPlanIndex = planLevels.indexOf(entitlement.plan);
        const requiredPlanIndex = planLevels.indexOf(requiredPlan);
        return currentPlanIndex >= requiredPlanIndex;
      }
    }

    // Check trial status
    if (entitlement.plan === "trial" && entitlement.paidEndsAt) {
      return new Date() < entitlement.paidEndsAt;
    }

    return false;
  }

  async createEntitlement(userId: string, plan: UserEntitlement["plan"]): Promise<UserEntitlement> {
    let entitlement: UserEntitlement = {
      id: crypto.randomUUID(),
      userId,
      plan,
      status: "active",
    };

    // Set trial dates for trial plan
    if (plan === "trial") {
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30); // 30 day trial
      entitlement.paidStartsAt = new Date();
      entitlement.paidEndsAt = trialEndDate;
    }

    // Insert into database
    await db.insert(userEntitlements).values(entitlement);

    const created = await this.getUserEntitlement(userId);
    if (!created) {
      throw new Error("Failed to create user entitlement");
    }

    return created;
  }

  async updateEntitlement(userId: string, updates: Partial<UserEntitlement>): Promise<UserEntitlement> {
    const current = await this.getUserEntitlement(userId);
    if (!current) {
      throw new Error("User entitlement not found");
    }

    const updated = {
      ...current,
      ...updates,
      // Convert timestamps appropriately
      paidStartsAt: updates.paidStartsAt ? new Date(updates.paidStartsAt) : current.paidStartsAt,
      paidEndsAt: updates.paidEndsAt ? new Date(updates.paidEndsAt) : current.paidEndsAt,
      webhookProcessedAt: updates.webhookProcessedAt
        ? new Date(updates.webhookProcessedAt)
        : current.webhookProcessedAt,
    };

    await db
      .update(userEntitlements)
      .set({
        plan: updated.plan,
        status: updated.status,
        paidStartsAt: updated.paidStartsAt,
        paidEndsAt: updated.paidEndsAt,
        stripeCustomerId: updated.stripeCustomerId,
        stripeSubscriptionId: updated.stripeSubscriptionId,
        stripePriceId: updated.stripePriceId,
        webhookProcessedAt: updated.webhookProcessedAt,
        updatedAt: new Date(),
      })
      .where(eq(userEntitlements.userId, userId));

    return updated;
  }

  async canAccessFeature(userId: string, feature: keyof typeof FEATURE_REQUIREMENTS): Promise<boolean> {
    const requiredPlan = FEATURE_REQUIREMENTS[feature];
    return this.checkEntitlement(userId, requiredPlan);
  }
}

// Global service instance
export const entitlementsService = new EntitlementsServiceImpl();

// Convenience functions
export const ensureEntitlement = async (userId: string, requiredPlan: "free" | "trial" | "pro" | "team") => {
  const hasAccess = await entitlementsService.checkEntitlement(userId, requiredPlan);

  if (!hasAccess) {
    throw new Error(`Insufficient plan: ${requiredPlan} plan required`);
  }

  return true;
};

export const getCurrentPlan = async (userId: string): Promise<UserEntitlement["plan"] | null> => {
  const entitlement = await entitlementsService.getUserEntitlement(userId);

  if (!entitlement) {
    return "free";
  }

  // Check if subscription is active
  if (entitlement.status === "active" && entitlement.paidEndsAt) {
    const now = new Date();
    if (entitlement.paidEndsAt > now) {
      return entitlement.plan;
    }
  }

  return "free";
};
