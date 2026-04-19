/**
 * API Warmup Endpoint
 *
 * This endpoint is designed to be called periodically (e.g., via cron)
 * to keep the serverless functions warm and reduce cold start latency.
 *
 * Usage:
 * - Call this endpoint every 5-10 minutes to prevent cold starts
 * - Can be called from a cron job or monitoring service
 * - Returns quickly with minimal processing
 */

import { NextRequest } from "next/server";

// Cache for warmup state
const warmupState = {
  lastWarmup: 0,
  warmupCount: 0,
  initialized: false,
};

/**
 * Initialize expensive resources that benefit from pre-warming
 */
function initializeResources(): void {
  if (warmupState.initialized) return;

  // Pre-load environment variables
  const _ = [
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.OPENROUTER_API_KEY,
    process.env.DATABASE_URL,
    process.env.BETTER_AUTH_SECRET,
  ];

  // Trigger any lazy initializations
  // This helps reduce cold start time for subsequent requests

  warmupState.initialized = true;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify this is an internal request (optional security)
    const authHeader = request.headers.get("authorization");
    const warmupToken = process.env.WARMUP_TOKEN;

    if (warmupToken && authHeader !== `Bearer ${warmupToken}`) {
      // Allow requests without token in development
      if (process.env.NODE_ENV === "production") {
        return Response.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    // Initialize resources
    initializeResources();

    // Perform lightweight operations to warm up the runtime
    const healthCheck = {
      envLoaded: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      databaseUrl: !!process.env.DATABASE_URL,
      authSecret: !!process.env.BETTER_AUTH_SECRET,
    };

    const duration = Date.now() - startTime;

    warmupState.lastWarmup = Date.now();
    warmupState.warmupCount++;

    return Response.json({
      status: "warm",
      duration: `${duration}ms`,
      health: healthCheck,
      warmupCount: warmupState.warmupCount,
      lastWarmup: new Date(warmupState.lastWarmup).toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    return Response.json({
      status: "error",
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // POST handler for warmup (some services prefer POST)
  return GET(request);
}

/**
 * Get warmup statistics
 */
export async function DELETE() {
  // Reset warmup state (useful for testing)
  warmupState.lastWarmup = 0;
  warmupState.warmupCount = 0;
  warmupState.initialized = false;

  return Response.json({
    status: "reset",
    message: "Warmup state has been reset",
  });
}
