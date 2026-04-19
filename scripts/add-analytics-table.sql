-- Migration: Add analytics_events table
-- Run this script to add the analytics tracking table to your database

-- Add the analytics_events table
CREATE TABLE IF NOT EXISTS "analytics_event" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "sessionId" varchar NOT NULL,
  "chatId" text REFERENCES "chat"("id") ON DELETE SET NULL,
  "eventType" varchar NOT NULL,
  "properties" jsonb,
  "mode" varchar,
  "provider" varchar,
  "model" varchar,
  "artifactType" varchar,
  "duration" integer,
  "error" text,
  "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "analytics_event_user_id_idx" ON "analytics_event"("userId");
CREATE INDEX IF NOT EXISTS "analytics_event_session_id_idx" ON "analytics_event"("sessionId");
CREATE INDEX IF NOT EXISTS "analytics_event_chat_id_idx" ON "analytics_event"("chatId");
CREATE INDEX IF NOT EXISTS "analytics_event_type_idx" ON "analytics_event"("eventType");
CREATE INDEX IF NOT EXISTS "analytics_event_created_at_idx" ON "analytics_event"("createdAt");

-- Verify table creation
SELECT COUNT(*) as total_records FROM "analytics_event";
