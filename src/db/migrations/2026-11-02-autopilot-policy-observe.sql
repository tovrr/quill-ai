-- Autopilot: tool-policy hash, observe mode, run reason codes (PR "loop guards + policy hash").
--
-- Equivalent of `npm run db:push` for this change; the owner runs one or the other
-- BEFORE the code is merged and deployed (the cron and the Autopilot API select every
-- column of these tables). Every statement is additive and idempotent.
--
-- Existing rows:
--   * autopilot_workflow."mode" is NOT NULL DEFAULT 'active': every workflow that exists
--     today becomes 'active' and keeps running as before.
--   * autopilot_workflow."policyHash" stays NULL: the code reads NULL as "approved while
--     Autopilot had no tools", which is the policy in force today, so these workflows are
--     not refused. No backfill is needed.
--   * autopilot_run."mode" is 'active' for past runs; "reasonCode" and "toolCalls" are NULL.

ALTER TABLE "autopilot_workflow" ADD COLUMN IF NOT EXISTS "mode" varchar NOT NULL DEFAULT 'active';
ALTER TABLE "autopilot_workflow" ADD COLUMN IF NOT EXISTS "policyHash" varchar;

ALTER TABLE "autopilot_run" ADD COLUMN IF NOT EXISTS "mode" varchar NOT NULL DEFAULT 'active';
ALTER TABLE "autopilot_run" ADD COLUMN IF NOT EXISTS "reasonCode" varchar;
ALTER TABLE "autopilot_run" ADD COLUMN IF NOT EXISTS "toolCalls" jsonb;
