# Quill AI TODOs

## High Priority (Production Safety)

- [ ] Replace in-memory rate limiting with distributed rate limiting (Redis/Upstash)
- [ ] Keep current API rate-limit headers and 429 behavior unchanged after migration
- [ ] Add env vars for distributed limiter and document fail-open/fail-closed behavior
- [ ] Add monitoring for rate-limit hits by route and user/IP key

## High Priority (Storage and Performance)

- [ ] Stop storing generated images as data URLs in chat text
- [ ] Upload generated images to object storage (S3/R2 or equivalent)
- [ ] Persist only image URLs and metadata in messages
- [ ] Add migration strategy for existing data-URL messages if needed

## Medium Priority (Upload Reliability)

- [ ] Add upload guardrails: max file size, max files per message, allowed MIME types
- [ ] Add clear user-facing validation errors before send
- [ ] Add server-side validation for attachments to mirror client checks
- [ ] Add telemetry for attachment validation failures

## Medium Priority (Chat UX)

- [x] Separate Attach action from mode selector
- [x] Remove Attach option from dropdown
- [x] Move mode selector next to Send button
- [x] Make non-image attachments clickable/downloadable in message bubble
- [x] Persist useful fallback content for file-only user turns
- [ ] Show explicit in-chat confirmation that files were sent to model
- [ ] Add richer file preview cards (type, size, open/download)

## Medium Priority (Observability)

- [ ] Track feature metrics: attachment usage, image generation failure rate, OpenRouter fallback rate
- [ ] Add request-level correlation from API logs to user-visible errors
- [ ] Add alert thresholds for 5xx spikes and repeated quota/rate-limit errors

## Medium Priority (Model Routing)

- [x] Auto-select OpenRouter free model when key is configured
- [x] Cache auto-selection result (48h)
- [ ] Add optional health check to proactively rotate to next-best free model on provider failures
- [ ] Add manual allowlist/denylist for free model candidates
- [ ] Keep the paid-user workflow documented around `PAID_USER_EMAILS`, since paid access is currently managed by email
- [ ] Add admin flow to discover/copy current user IDs for `PAID_USER_IDS` without manual guessing when ID-based overrides are needed
- [ ] Move entitlements from env vars to a DB billing/subscription table so plan changes do not require a redeploy

## Low Priority (Data Model Hardening)

- [ ] Add DB-level constraint/enum for message role values
- [ ] Add targeted indexes for verification lookups if usage grows
- [ ] Add periodic cleanup policy for stale sessions/verifications

## Release Readiness Checklist

- [ ] Verify all required env vars are set in hosting platform
- [ ] Run typecheck and lint in CI and pre-merge
- [ ] Run API smoke tests on every push/PR
- [ ] Verify metrics endpoint auth in production
- [ ] Perform post-deploy smoke: chat, attachments, image generation, share, delete
