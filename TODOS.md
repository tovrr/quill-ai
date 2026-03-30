# Quill AI TODOs

## Execution Rules (Keep This Doc Effective)

- Every new task should include: scope, acceptance criteria, and where it will be verified (local, CI, production).
- Limit active work-in-progress to 3 major tasks at a time to reduce context switching.
- When a task is completed, link the PR/commit next to it and add a one-line outcome note.
- Re-prioritize weekly: move stale tasks down, pull blockers up.

## Audit-Driven Remediation Backlog (Live Audit - 2026-03-30)

### Critical - Security

- [ ] Add a strict Content Security Policy in `next.config.ts`.
- [ ] Roll out CSP in two phases: `Content-Security-Policy-Report-Only` first, then enforcing `Content-Security-Policy`.
- [ ] Add CSP reporting endpoint and alerting for violations.
- [ ] Define trusted script/connect/font/image origins explicitly (avoid wildcard sources).
- [ ] Verify no regressions in auth, streaming chat, and image generation under enforced CSP.

### High - Reliability

- [ ] Upgrade `/api/health` from shallow status check to readiness checks (DB, auth/session, model provider reachability).
- [ ] Add timeout-bounded checks so readiness cannot hang and cause cascading failures.
- [ ] Return a structured readiness payload with component-level status and degraded mode hints.
- [ ] Add external uptime + latency monitoring (e.g., Better Stack/UptimeRobot) for `/`, `/agent`, `/api/health`, `/api/chat`.
- [ ] Define and document SLO targets (availability, p95 latency) and alert thresholds.

### High - Maintainability

- [ ] Add bundle analysis in CI (`@next/bundle-analyzer`) with per-route JS/CSS budgets.
- [ ] Fail CI when budgets regress beyond agreed thresholds.
- [ ] Add dependency security checks (`npm audit` gate or equivalent) with an explicit policy for moderate/high vulnerabilities.
- [ ] Create a quarterly dependency upgrade routine for Next.js/AI SDK/Auth stack.

### PWA/App Readiness (from audit)

- [ ] Add service worker + offline fallback strategy for critical routes.
- [ ] Add maskable icon entry in `manifest.ts` with `purpose: "maskable"`.
- [ ] Add `.well-known/assetlinks.json` for Android Trusted Web Activity readiness.
- [ ] Validate installability and offline behavior using Lighthouse PWA audits in CI.

## Next 7 Execution Targets

- [ ] Security Sprint 1: ship CSP report-only + violation collection.
- [ ] Security Sprint 2: enforce CSP after fixing violations.
- [ ] Reliability Sprint: implement readiness checks with dependency probes.
- [ ] Observability Sprint: uptime checks + alert routing to on-call channel.
- [ ] Performance Sprint: bundle analyzer + baseline budgets.
- [ ] PWA Sprint: service worker + offline shell.
- [ ] Mobile Distribution Prep: maskable icons + assetlinks + store packaging checklist.

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

## PWA & App Store

- [ ] Keep this section focused on distribution packaging tasks; implementation tasks are tracked in "Audit-Driven Remediation Backlog"
- [ ] **Google Play Store**: wrap the PWA as a TWA (Trusted Web Activity) using Bubblewrap — requires offline support first
- [ ] **Apple App Store**: wrap with Capacitor or Expo — Apple does not accept bare PWAs in the store
- [ ] Add `assetlinks.json` validation in release pipeline for TWA verification
- [ ] Add store-release checklist with signing, screenshots, privacy labels, and rollback steps

## Release Readiness Checklist

- [ ] Verify all required env vars are set in hosting platform
- [ ] Run typecheck and lint in CI and pre-merge
- [ ] Run API smoke tests on every push/PR
- [ ] Verify metrics endpoint auth in production
- [ ] Perform post-deploy smoke: chat, attachments, image generation, share, delete
- [ ] Verify CSP is enforced with no critical violations
- [ ] Verify readiness endpoint reports dependency health (DB, auth, provider)
- [ ] Verify external uptime checks and alert routing are active
