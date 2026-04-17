/**
 * POST /api/apex/chat
 * 
 * Proxy endpoint for Apex /chat endpoint.
 * Accepts { question, mots_max?, context? } and returns { response, usage? }
 * 
 * Security: API key injected server-side, never exposed to client.
 */

import { NextRequest, NextResponse } from "next/server";
import { callApexChat, ApexClientError } from "@/lib/apex-client";
import { z } from "zod";

export const maxDuration = 60;

// Request validation schema
const ApexChatRequestSchema = z.object({
  question: z.string().min(1, "question is required").trim(),
  mots_max: z.number().int().min(1).max(500).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

type ApexChatRequest = z.infer<typeof ApexChatRequestSchema>;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validRequest = ApexChatRequestSchema.safeParse(body);

    if (!validRequest.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: validRequest.error.flatten(),
        },
        { status: 400 }
      );
    }

    // Call Apex backend
    const result = await callApexChat(validRequest.data);

    return NextResponse.json(result, { status: 200 });
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

    console.error("[apex/chat] Unexpected error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
