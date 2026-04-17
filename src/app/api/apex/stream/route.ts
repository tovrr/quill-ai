/**
 * POST /api/apex/stream
 * 
 * Proxy endpoint for Apex /chat/stream endpoint (Server-Sent Events).
 * Streams responses line-by-line as they arrive from Apex.
 * 
 * Security: API key injected server-side, never exposed to client.
 */

import { NextRequest, NextResponse } from "next/server";
import { streamApexChat, ApexClientError } from "@/lib/apex-client";
import { z } from "zod";

export const maxDuration = 300; // 5 minutes for streaming

// Request validation schema (same as chat endpoint)
const ApexStreamRequestSchema = z.object({
  question: z.string().min(1, "question is required").trim(),
  mots_max: z.number().int().min(1).max(500).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

type ApexStreamRequest = z.infer<typeof ApexStreamRequestSchema>;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validRequest = ApexStreamRequestSchema.safeParse(body);

    if (!validRequest.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: validRequest.error.flatten(),
        },
        { status: 400 }
      );
    }

    // Get streaming body from Apex
    const apexStream = await streamApexChat(validRequest.data);

    // Return stream with proper SSE headers
    return new NextResponse(apexStream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        // Allow CORS for streaming if needed
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    if (error instanceof ApexClientError) {
      const details = typeof error.details === "string" ? error.details : JSON.stringify(error.details);
      return NextResponse.json(
        {
          error: error.message,
          status: error.statusCode,
          ...(details && { details }),
        },
        { status: error.statusCode }
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: "Invalid JSON in request body",
        },
        { status: 400 }
      );
    }

    console.error("[apex/stream] Unexpected error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
