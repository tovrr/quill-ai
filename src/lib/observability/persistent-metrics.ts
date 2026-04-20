import { db } from "@/db";
import { and, eq, gte, sql } from "drizzle-orm";
import { chats, messages, modelUsageEvents, sessions, userEntitlements } from "@/db/schema";

// Enhanced metric types with persistence support
interface PersistentMetric {
  id: string;
  metricType: string;
  userId?: string;
  route?: string;
  feature?: string;
  value: number;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  createdAt: Date;
}

interface UserAnalytics {
  userId: string;
  totalRequests: number;
  totalTokens: number;
  preferredMode: string;
  lastActive: Date;
  subscriptionTier: string;
  featuresUsed: string[];
}

interface SystemMetrics {
  timestamp: Date;
  uptime: number;
  responseTimeAvg: number;
  errorRate: number;
  activeUsers: number;
  totalChats: number;
  totalMessages: number;
}

export class PersistentMetricsService {
  async recordMetric(metric: Omit<PersistentMetric, "id" | "createdAt">) {
    this.storeInMemory(metric.userId ?? "anonymous", metric);
    return true;
  }

  // Record user activity
  async recordUserActivity(
    userId: string,
    activity: {
      route?: string;
      feature?: string;
      value?: number;
      metadata?: Record<string, unknown>;
    },
  ) {
    const metric: Omit<PersistentMetric, "id" | "createdAt"> = {
      metricType: "user_activity",
      userId,
      route: activity.route,
      feature: activity.feature,
      value: activity.value || 1,
      metadata: activity.metadata,
      timestamp: new Date(),
    };
    await this.recordMetric(metric);
  }

  // Get user analytics
  async getUserAnalytics(userId: string, days: number = 30): Promise<UserAnalytics | null> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const usageRows = await db
        .select({
          feature: modelUsageEvents.feature,
          mode: modelUsageEvents.mode,
          inputTokens: modelUsageEvents.inputTokens,
          outputTokens: modelUsageEvents.outputTokens,
          createdAt: modelUsageEvents.createdAt,
        })
        .from(modelUsageEvents)
        .where(and(eq(modelUsageEvents.userId, userId), gte(modelUsageEvents.createdAt, startDate)));

      const cachedMetrics = this.getInMemoryMetrics(userId).filter((metric) => metric.timestamp >= startDate);

      if (usageRows.length === 0 && cachedMetrics.length === 0) return null;

      const totalRequests = usageRows.length + cachedMetrics.length;
      const totalTokens = usageRows.reduce((sum, row) => sum + (row.inputTokens ?? 0) + (row.outputTokens ?? 0), 0);

      const entitlement = await db.query.userEntitlements.findFirst({
        where: eq(userEntitlements.userId, userId),
      });

      const preferredMode = this.calculatePreferredMode(usageRows);
      const featuresUsed = this.extractFeaturesUsed(
        cachedMetrics,
        usageRows.map((row) => row.feature ?? undefined),
      );
      const timestamps = [
        ...usageRows.map((row) => row.createdAt?.getTime() ?? 0),
        ...cachedMetrics.map((metric) => metric.timestamp.getTime()),
      ].filter((value) => value > 0);

      return {
        userId,
        totalRequests,
        totalTokens,
        preferredMode,
        lastActive: new Date(Math.max(...timestamps)),
        subscriptionTier: entitlement?.plan || "free",
        featuresUsed,
      };
    } catch (error) {
      console.error("Failed to get user analytics:", error);
      return null;
    }
  }

  // Get system metrics
  async getSystemMetrics(hours: number = 24): Promise<SystemMetrics[]> {
    try {
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - hours);

      const [sessionData, messageStats, chatStats] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(sessions)
          .where(gte(sessions.updatedAt, startDate)),
        db
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(gte(messages.createdAt, startDate)),
        db
          .select({ count: sql<number>`count(*)` })
          .from(chats)
          .where(gte(chats.createdAt, startDate)),
      ]);

      return [
        {
          timestamp: new Date(),
          uptime: process.env.UPTIME_SECS ? parseInt(process.env.UPTIME_SECS) : 3600,
          responseTimeAvg: 0,
          errorRate: 0,
          activeUsers: Number(sessionData[0]?.count || 0),
          totalChats: Number(chatStats[0]?.count || 0),
          totalMessages: Number(messageStats[0]?.count || 0),
        },
      ];
    } catch (error) {
      console.error("Failed to get system metrics:", error);
      return [];
    }
  }

  // Get feature usage analytics
  async getFeatureUsageAnalytics(days: number = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const featureRows = await db
        .select({ userId: modelUsageEvents.userId, feature: modelUsageEvents.feature })
        .from(modelUsageEvents)
        .where(gte(modelUsageEvents.createdAt, startDate));

      const cachedMetrics = this.getAllInMemoryMetrics().filter((metric) => metric.timestamp >= startDate);

      const featureUsage: Record<string, { count: number; users: Set<string> }> = {};

      for (const metric of cachedMetrics) {
        if (metric.feature) {
          if (!featureUsage[metric.feature]) {
            featureUsage[metric.feature] = { count: 0, users: new Set() };
          }
          featureUsage[metric.feature].count++;
          if (metric.userId) {
            featureUsage[metric.feature].users.add(metric.userId);
          }
        }
      }

      for (const row of featureRows) {
        if (!row.feature) {
          continue;
        }

        if (!featureUsage[row.feature]) {
          featureUsage[row.feature] = { count: 0, users: new Set() };
        }

        featureUsage[row.feature].count++;
        if (row.userId) {
          featureUsage[row.feature].users.add(row.userId);
        }
      }

      return Object.entries(featureUsage)
        .map(([feature, data]) => ({
          feature,
          usageCount: data.count,
          uniqueUsers: data.users.size,
          averageUsage: data.users.size > 0 ? data.count / data.users.size : data.count,
        }))
        .sort((a, b) => b.usageCount - a.usageCount);
    } catch (error) {
      console.error("Failed to get feature usage analytics:", error);
      return [];
    }
  }

  // Data retention cleanup
  async cleanupOldData(daysToKeep: number = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const cache = this.getCache();
      let deletedRows = 0;

      for (const [userId, items] of cache.entries()) {
        const filteredItems = items.filter((item) => item.timestamp >= cutoffDate);
        deletedRows += items.length - filteredItems.length;
        cache.set(userId, filteredItems);
      }

      console.log(`Cleaned up ${deletedRows} old metric records`);
      return deletedRows;
    } catch (error) {
      console.error("Failed to cleanup old data:", error);
      return 0;
    }
  }

  private getCache() {
    const globalMetrics = globalThis as typeof globalThis & {
      __quillMetricsCache__?: Map<string, PersistentMetric[]>;
    };

    if (!globalMetrics.__quillMetricsCache__) {
      globalMetrics.__quillMetricsCache__ = new Map();
    }

    return globalMetrics.__quillMetricsCache__;
  }

  private getInMemoryMetrics(userId: string) {
    return this.getCache().get(userId) ?? [];
  }

  private getAllInMemoryMetrics() {
    return [...this.getCache().values()].flat();
  }

  private storeInMemory(userId: string, metric: Omit<PersistentMetric, "id" | "createdAt">) {
    const cache = this.getCache();
    const userMetrics = cache.get(userId) || [];
    userMetrics.push({
      ...metric,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    });
    cache.set(userId, userMetrics);
  }

  private calculatePreferredMode(messages: Array<{ mode: string | null }>): string {
    if (messages.length === 0) return "fast";

    const modeCounts = messages.reduce<Record<string, number>>((acc, message) => {
      const mode = message.mode || "fast";
      acc[mode] = (acc[mode] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "fast";
  }

  private extractFeaturesUsed(
    metrics: Array<{ feature?: string }>,
    featuresFromUsage: Array<string | undefined>,
  ): string[] {
    const values = new Set<string>();

    for (const metric of metrics) {
      if (metric.feature) {
        values.add(metric.feature);
      }
    }

    for (const feature of featuresFromUsage) {
      if (feature) {
        values.add(feature);
      }
    }

    return [...values];
  }
}

// Global service instance
export const persistentMetricsService = new PersistentMetricsService();
