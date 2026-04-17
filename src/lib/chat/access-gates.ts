import { countUserMessagesToday } from "@/lib/data/db-helpers";
import { resolveUserEntitlements } from "@/lib/entitlements";
import { checkRateLimit } from "@/lib/observability/rate-limit";
import { isWebSearchConfigured } from "@/lib/integrations/web-search";
import { getDailyLimitForMode, type ChatMode } from "@/lib/chat/model-selection";

export type ChatAccessFailure = {
  status: number;
  errorCode: string;
  message: string;
};

export type ChatAccessEvaluationResult = {
  hasPaidAccess: boolean;
  failure?: ChatAccessFailure;
};

type EvaluateChatAccessInput = {
  userId: string;
  userEmail: string;
  shouldPersist: boolean;
  selectedMode: ChatMode;
  effectiveWebSearchRequested: boolean;
};

export async function evaluateChatAccess(input: EvaluateChatAccessInput): Promise<ChatAccessEvaluationResult> {
  const { userId, userEmail, shouldPersist, selectedMode, effectiveWebSearchRequested } = input;

  const entitlement = shouldPersist
    ? await resolveUserEntitlements({ userId, email: userEmail })
    : null;
  const hasPaidAccess = shouldPersist && Boolean(entitlement?.canUsePaidModes);

  // Guest users are limited to free mode; auth is required for think/pro tiers.
  if (!shouldPersist && selectedMode !== "fast") {
    return {
      hasPaidAccess,
      failure: {
        status: 401,
        errorCode: "auth_required_mode",
        message: "Sign in to use Think and Pro modes.",
      },
    };
  }

  if (effectiveWebSearchRequested && !shouldPersist) {
    return {
      hasPaidAccess,
      failure: {
        status: 401,
        errorCode: "auth_required_web_search",
        message: "Sign in to use web search.",
      },
    };
  }

  if (effectiveWebSearchRequested && !isWebSearchConfigured()) {
    return {
      hasPaidAccess,
      failure: {
        status: 503,
        errorCode: "web_search_not_configured",
        message: "Web search is not configured yet.",
      },
    };
  }

  if (effectiveWebSearchRequested && shouldPersist) {
    const freeDailySearches = Number(process.env.WEB_SEARCH_DAILY_REQUESTS_FREE ?? "20");
    const paidDailySearches = Number(process.env.WEB_SEARCH_DAILY_REQUESTS_PAID ?? "100");
    const dailySearchLimit = hasPaidAccess ? paidDailySearches : freeDailySearches;

    const searchQuota = await checkRateLimit({
      key: `websearch:daily:user:${userId}`,
      max: dailySearchLimit,
      windowMs: 86_400_000,
    });

    if (!searchQuota.allowed) {
      return {
        hasPaidAccess,
        failure: {
          status: 429,
          errorCode: "web_search_daily_quota_reached",
          message: `Daily web search limit reached (${dailySearchLimit}/day).`,
        },
      };
    }
  }

  // Paid mode enforcement for authenticated users.
  if (shouldPersist && selectedMode !== "fast" && !hasPaidAccess) {
    return {
      hasPaidAccess,
      failure: {
        status: 402,
        errorCode: "paid_mode_required",
        message: "Think and Pro are paid modes. Upgrade your account to use them.",
      },
    };
  }

  if (shouldPersist) {
    const usedToday = await countUserMessagesToday(userId);
    const dailyLimit = getDailyLimitForMode(selectedMode);
    if (usedToday >= dailyLimit) {
      return {
        hasPaidAccess,
        failure: {
          status: 429,
          errorCode: "daily_quota_reached",
          message: `Daily limit reached for this mode (${dailyLimit} messages/day).`,
        },
      };
    }
  }

  return { hasPaidAccess };
}
