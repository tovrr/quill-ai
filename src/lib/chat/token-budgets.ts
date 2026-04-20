import { db } from '@/db';
import { modelUsageEvents } from '@/db/schema';
import { sql } from 'drizzle-orm';

/**
 * Token Budgets - Prevent abuse and control costs
 * 
 * Free tier: 100k tokens/day, 2M tokens/month
 * Pro tier: 1M tokens/day, 20M tokens/month
 * 
 * These are generous limits that prevent abuse while allowing normal usage.
 */

export const TOKEN_BUDGETS = {
  free: { daily: 100_000, monthly: 2_000_000 },
  pro: { daily: 1_000_000, monthly: 20_000_000 },
};

export type UserTier = 'free' | 'pro';

/**
 * Check if user has remaining token budget for this request
 */
export async function checkTokenBudget(
  userId: string,
  tier: UserTier,
  estimatedTokens: number
): Promise<{ allowed: boolean; reason?: string; dailyUsed?: number; monthlyUsed?: number }> {
  const budget = TOKEN_BUDGETS[tier];
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.slice(0, 7); // YYYY-MM
  
  try {
    // Check daily usage
    const [dailyUsage] = await db
      .select({
        total: sql<number>`COALESCE(SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)), 0)`,
      })
      .from(modelUsageEvents)
      .where(sql`user_id = ${userId} AND DATE(created_at) = ${today}`);
    
    const dailyUsed = Number(dailyUsage?.total || 0);
    
    if (dailyUsed + estimatedTokens > budget.daily) {
      return {
        allowed: false,
        reason: `Daily token limit reached (${dailyUsed.toLocaleString()} / ${budget.daily.toLocaleString()}). ${tier === 'free' ? 'Upgrade to Pro for 10x higher limits.' : 'Try again tomorrow.'}`,
        dailyUsed,
        monthlyUsed: 0,
      };
    }
    
    // Check monthly usage
    const [monthlyUsage] = await db
      .select({
        total: sql<number>`COALESCE(SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)), 0)`,
      })
      .from(modelUsageEvents)
      .where(sql`user_id = ${userId} AND DATE_TRUNC('month', created_at) = ${thisMonth}-01`);
    
    const monthlyUsed = Number(monthlyUsage?.total || 0);
    
    if (monthlyUsed + estimatedTokens > budget.monthly) {
      return {
        allowed: false,
        reason: `Monthly token limit reached (${monthlyUsed.toLocaleString()} / ${budget.monthly.toLocaleString()}).`,
        dailyUsed,
        monthlyUsed,
      };
    }
    
    return {
      allowed: true,
      dailyUsed,
      monthlyUsed,
    };
  } catch (error) {
    // Fail open - if DB is unavailable, allow the request but log warning
    console.error('[token-budget] Database error:', error instanceof Error ? error.message : error);
    return {
      allowed: true,
      dailyUsed: 0,
      monthlyUsed: 0,
    };
  }
}

/**
 * Get user's current token usage statistics
 */
export async function getTokenUsageStats(userId: string): Promise<{
  daily: { used: number; limit: number; remaining: number };
  monthly: { used: number; limit: number; remaining: number };
  tier: UserTier;
}> {
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.slice(0, 7);
  
  // Get user's tier from auth system (simplified - you'd integrate with your auth)
  // For now, assume free tier - in production, fetch from user record
  const tier: UserTier = 'free';
  const budget = TOKEN_BUDGETS[tier];
  
  const [dailyUsage] = await db
    .select({
      total: sql<number>`COALESCE(SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)), 0)`,
    })
    .from(modelUsageEvents)
    .where(sql`user_id = ${userId} AND DATE(created_at) = ${today}`);
  
  const [monthlyUsage] = await db
    .select({
      total: sql<number>`COALESCE(SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)), 0)`,
    })
    .from(modelUsageEvents)
    .where(sql`user_id = ${userId} AND DATE_TRUNC('month', created_at) = ${thisMonth}-01`);
  
  const dailyUsed = Number(dailyUsage?.total || 0);
  const monthlyUsed = Number(monthlyUsage?.total || 0);
  
  return {
    daily: {
      used: dailyUsed,
      limit: budget.daily,
      remaining: Math.max(0, budget.daily - dailyUsed),
    },
    monthly: {
      used: monthlyUsed,
      limit: budget.monthly,
      remaining: Math.max(0, budget.monthly - monthlyUsed),
    },
    tier,
  };
}
