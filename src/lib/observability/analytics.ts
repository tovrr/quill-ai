/**
 * User Behavior Analytics System
 *
 * Tracks key user interactions to understand product usage patterns,
 * identify friction points, and optimize the user experience.
 *
 * Events tracked:
 * - chat_started: User initiates a new chat
 * - chat_message_sent: User sends a message
 * - chat_response_received: AI response completed
 * - artifact_generated: Builder artifact created
 * - artifact_previewed: User views artifact in canvas
 * - artifact_exported: User exports artifact
 * - mode_switched: User changes chat mode
 * - feature_used: Generic feature usage tracking
 * - error_encountered: User-facing errors
 * - session_started: User session begins
 * - session_ended: User session ends
 */

// Mock database for analytics (no database required)
const mockAnalyticsEvents = new Map<string, any>();

export type AnalyticsEventType =
  | "chat_started"
  | "chat_message_sent"
  | "chat_response_received"
  | "artifact_generated"
  | "artifact_previewed"
  | "artifact_exported"
  | "mode_switched"
  | "feature_used"
  | "error_encountered"
  | "session_started"
  | "session_ended"
  | "auth_signup"
  | "auth_login"
  | "auth_logout"
  | "image_generated"
  | "web_search_used"
  | "code_executed"
  | "knowledge_base_searched";

export type AnalyticsEventInput = {
  userId: string;
  eventType: AnalyticsEventType;
  chatId?: string;
  sessionId?: string;
  properties?: Record<string, unknown>;
  metadata?: {
    mode?: string;
    provider?: string;
    model?: string;
    artifactType?: string;
    duration?: number;
    error?: string;
  };
};

type UserSession = {
  sessionId: string;
  userId: string;
  startedAt: number;
  lastActivity: number;
  activityCount: number;
};

// Global session store for tracking active sessions
const globalStore = globalThis as typeof globalThis & {
  __quillAnalyticsSessions__?: Map<string, UserSession>;
};

const sessionStore = globalStore.__quillAnalyticsSessions__ ?? new Map<string, UserSession>();
globalStore.__quillAnalyticsSessions__ = sessionStore;

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get or create a session for a user
 */
export function getOrCreateSession(userId: string): string {
  // Find existing active session (within last 30 minutes)
  const existingSession = Array.from(sessionStore.values()).find(
    (session) =>
      session.userId === userId &&
      Date.now() - session.lastActivity < 30 * 60 * 1000
  );

  if (existingSession) {
    existingSession.lastActivity = Date.now();
    existingSession.activityCount++;
    return existingSession.sessionId;
  }

  // Create new session
  const sessionId = generateSessionId();
  const session: UserSession = {
    sessionId,
    userId,
    startedAt: Date.now(),
    lastActivity: Date.now(),
    activityCount: 1,
  };

  sessionStore.set(sessionId, session);
  return sessionId;
}

/**
 * Record an analytics event
 */
export async function recordAnalyticsEvent(input: AnalyticsEventInput): Promise<void> {
  try {
    const sessionId = input.sessionId || getOrCreateSession(input.userId);

    // Mock database insertion
    const event = {
      userId: input.userId,
      sessionId,
      chatId: input.chatId,
      eventType: input.eventType,
      properties: input.properties,
      mode: input.metadata?.mode,
      provider: input.metadata?.provider,
      model: input.metadata?.model,
      artifactType: input.metadata?.artifactType,
      duration: input.metadata?.duration,
      error: input.metadata?.error,
      createdAt: new Date(),
    };

    // Store in mock database
    const key = `${input.userId}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    mockAnalyticsEvents.set(key, event);

    console.log("[analytics] Recorded event:", event);
  } catch (error) {
    // Analytics should never break the main flow
    console.warn("[analytics] Failed to record event:", error instanceof Error ? error.message : error);
  }
}

/**
 * Track chat-related events
 */
export async function trackChatEvent(
  userId: string,
  chatId: string,
  eventType: "started" | "message_sent" | "response_received",
  metadata?: {
    mode?: string;
    provider?: string;
    model?: string;
    duration?: number;
    error?: string;
  }
): Promise<void> {
  await recordAnalyticsEvent({
    userId,
    eventType: `chat_${eventType}` as AnalyticsEventType,
    chatId,
    metadata,
  });
}

/**
 * Track artifact-related events
 */
export async function trackArtifactEvent(
  userId: string,
  chatId: string,
  eventType: "generated" | "previewed" | "exported",
  artifactType: "page" | "document" | "react-app" | "nextjs-bundle",
  metadata?: {
    duration?: number;
  }
): Promise<void> {
  await recordAnalyticsEvent({
    userId,
    eventType: `artifact_${eventType}` as AnalyticsEventType,
    chatId,
    metadata: {
      artifactType,
      ...metadata,
    },
  });
}

/**
 * Track feature usage
 */
export async function trackFeatureUsage(
  userId: string,
  feature: "image_generation" | "web_search" | "code_execution" | "knowledge_base",
  chatId?: string,
  metadata?: {
    duration?: number;
    error?: string;
  }
): Promise<void> {
  const eventTypeMap = {
    image_generation: "image_generated",
    web_search: "web_search_used",
    code_execution: "code_executed",
    knowledge_base: "knowledge_base_searched",
  } as const;

  await recordAnalyticsEvent({
    userId,
    eventType: eventTypeMap[feature],
    chatId,
    metadata,
  });
}

/**
 * Track user errors
 */
export async function trackError(
  userId: string,
  error: string,
  context?: {
    route?: string;
    chatId?: string;
    feature?: string;
  }
): Promise<void> {
  await recordAnalyticsEvent({
    userId,
    eventType: "error_encountered",
    chatId: context?.chatId,
    properties: {
      route: context?.route,
      feature: context?.feature,
    },
    metadata: {
      error,
    },
  });
}

/**
 * Get user analytics summary
 */
export async function getUserAnalyticsSummary(userId: string, days = 7): Promise<{
  totalChats: number;
  totalMessages: number;
  totalArtifacts: number;
  averageSessionDuration: number;
  mostUsedMode: string | null;
  mostUsedFeature: string | null;
  errorRate: number;
}> {
  try {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get events from mock database
    const events = Array.from(mockAnalyticsEvents.values()).filter(
      (e) => e.userId === userId && new Date(e.createdAt) > cutoffDate
    );

    const chatStartedCount = events.filter((e) => e.eventType === "chat_started").length;
    const messageCount = events.filter((e) => e.eventType === "chat_message_sent").length;
    const artifactCount = events.filter((e) => e.eventType === "artifact_generated").length;
    const errorCount = events.filter((e) => e.eventType === "error_encountered").length;

    // Calculate average session duration
    const sessions = Array.from(sessionStore.values()).filter(
      (s) => s.userId === userId && s.startedAt > cutoffDate.getTime()
    );
    const avgSessionDuration =
      sessions.length > 0
        ? sessions.reduce((acc, s) => acc + (s.lastActivity - s.startedAt), 0) / sessions.length
        : 0;

    // Find most used mode
    const modeCounts = new Map<string, number>();
    events.forEach((e) => {
      if (e.mode) {
        modeCounts.set(e.mode, (modeCounts.get(e.mode) || 0) + 1);
      }
    });
    const mostUsedMode = modeCounts.size > 0 ? Array.from(modeCounts.entries()).sort((a, b) => b[1] - a[1])[0][0] : null;

    // Find most used feature
    const featureEvents = ["image_generated", "web_search_used", "code_executed", "knowledge_base_searched"] as const;
    const featureCounts = new Map<string, number>();
    events.forEach((e) => {
      if (featureEvents.includes(e.eventType as typeof featureEvents[number])) {
        const feature = e.eventType.replace("_used", "").replace("_generated", "").replace("_executed", "").replace("_searched", "");
        featureCounts.set(feature, (featureCounts.get(feature) || 0) + 1);
      }
    });
    const mostUsedFeature = featureCounts.size > 0 ? Array.from(featureCounts.entries()).sort((a, b) => b[1] - a[1])[0][0] : null;

    const errorRate = messageCount > 0 ? errorCount / messageCount : 0;

    return {
      totalChats: chatStartedCount,
      totalMessages: messageCount,
      totalArtifacts: artifactCount,
      averageSessionDuration: avgSessionDuration,
      mostUsedMode,
      mostUsedFeature,
      errorRate,
    };
  } catch (error) {
    console.warn("[analytics] Failed to get user summary:", error instanceof Error ? error.message : error);
    return {
      totalChats: 0,
      totalMessages: 0,
      totalArtifacts: 0,
      averageSessionDuration: 0,
      mostUsedMode: null,
      mostUsedFeature: null,
      errorRate: 0,
    };
  }
}

/**
 * Clean up old sessions (call periodically)
 */
export function cleanupOldSessions(maxAgeMs = 24 * 60 * 60 * 1000): void {
  const now = Date.now();
  for (const [sessionId, session] of sessionStore.entries()) {
    if (now - session.lastActivity > maxAgeMs) {
      sessionStore.delete(sessionId);
    }
  }
}
