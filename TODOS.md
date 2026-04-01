# Quill AI TODOs

## Execution Rules (Keep This Doc Effective)

- Every new task should include: scope, acceptance criteria, and where it will be verified (local, CI, production).
- Limit active work-in-progress to 3 major tasks at a time to reduce context switching.
- When a task is completed, link the PR/commit next to it and add a one-line outcome note.
- Re-prioritize weekly: move stale tasks down, pull blockers up.

## Audit-Driven Remediation Backlog (Live Audit - 2026-03-30)

### Critical - Security

- [x] Add a strict Content Security Policy in `next.config.ts`. — commit `77408d8`, enforcing CSP live.
- [x] Roll out CSP in two phases: `Content-Security-Policy-Report-Only` first, then enforcing `Content-Security-Policy`. — both phases complete.
- [ ] Add CSP reporting endpoint and alerting for violations. — report-only telemetry active; no dedicated ingest endpoint yet.
- [x] Define trusted script/connect/font/image origins explicitly (avoid wildcard sources). — explicit origins set in `next.config.ts`.
- [x] Verify no regressions in auth, streaming chat, and image generation under enforced CSP. — build + typecheck pass, no violations observed.

### High - Reliability

- [x] Upgrade `/api/health` from shallow status check to readiness checks (DB, auth/session, model provider reachability). — commit `124be4c`, verifies database ping, session table access, and provider reachability.
- [x] Add timeout-bounded checks so readiness cannot hang and cause cascading failures. — commit `124be4c`, configurable via `HEALTH_CHECK_TIMEOUT_MS`.
- [x] Return a structured readiness payload with component-level status and degraded mode hints. — commit `124be4c`, includes per-check details and fallback guidance.
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

- [x] Security Sprint 1: ship CSP report-only + violation collection. — commit `77408d8`.
- [x] Security Sprint 2: enforce CSP after fixing violations. — commit `77408d8`, enforcing header live.
- [x] Reliability Sprint: implement readiness checks with dependency probes. — commit `124be4c`; external uptime/alerting still pending.
- [ ] Observability Sprint: uptime checks + alert routing to on-call channel.
- [ ] Performance Sprint: bundle analyzer + baseline budgets.
- [ ] PWA Sprint: service worker + offline shell.
- [ ] Mobile Distribution Prep: maskable icons + assetlinks + store packaging checklist.

## Builder Roadmap (2026-04)

- [x] Step 1: Typed artifact schema/parser + canvas integration + telemetry.
- [x] Step 2: Builder target selector + deterministic artifact routing.
- [x] Step 3: Page quality hardening + quick refine actions + parse-failure UX.
- [x] Step 4: Iteration memory + lock constraints (layout, colors, section order, copy).
- [x] Step 5: React preview sandbox (CSP-safe blob URL runtime).
- [x] Step 6: Next.js bundle export-first hardening (prompt constraints, type inference, readiness diagnostics, setup script export).
- [x] Phase 7: Isolated local validation runner (materialize bundle, install, build) behind an env flag (`BUILDER_LOCAL_VALIDATE_ENABLED`).
- [x] Phase 7.5: User customization profiles (preset + additional instructions) wired into builder and chat prompts.
- [ ] Phase 8: One-click apply/export into target project with execution summary.
- [ ] Phase 9: Dependency conflict guardrails + peer dependency diagnostics.
- [ ] Phase 10: Publish/deploy pipeline scaffolding.
- [ ] Phase 11: Autonomy policy layer (assist/propose/checkpointed-auto) with per-killer permission maps.

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

- [x] Per-model usage + cost telemetry (`model_usage_event` table, `recordModelUsage()` lib, `/api/admin/model-usage`, `/admin/model-usage` UI). — commit `a590f99`.
- [x] Set local pricing env vars for Gemini Flash Lite / Flash / Pro / Imagen 4 Fast so admin cost telemetry is meaningful during development. — `.env.local` updated from official Google pricing.
- [ ] Set pricing env vars in Vercel (Flash Lite/Flash/Pro/Imagen 4 Fast) so estimated cost shows real numbers in admin dashboard.
- [ ] Track feature metrics: attachment usage, image generation failure rate, OpenRouter fallback rate
- [ ] Add request-level correlation from API logs to user-visible errors
- [ ] Add alert thresholds for 5xx spikes and repeated quota/rate-limit errors

## Medium Priority (Model Routing)

- [x] Auto-select OpenRouter free model when key is configured
- [x] Cache auto-selection result (48h)
- [x] Fix model tier ordering: `advanced` now correctly maps to `gemini-2.5-pro` (was `gemini-2.5-flash`). — commit `a590f99`.
- [x] **Implement 3-tier model ladder: `fast` → `gemini-2.5-flash-lite`, `thinking` → `gemini-2.5-flash`, `advanced` → `gemini-2.5-pro`.** — commit `124be4c`, with per-tier env overrides for zero-redeploy switching.
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
