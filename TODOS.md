# Quill AI TODOs

## Execution Rules (Keep This Doc Effective)

- Every new task should include: scope, acceptance criteria, and where it will be verified (local, CI, production).
- Limit active work-in-progress to 3 major tasks at a time to reduce context switching.
- When a task is completed, link the PR/commit next to it and add a one-line outcome note.
- Re-prioritize weekly: move stale tasks down, pull blockers up.

## 🔴 Critical Business Blockers (Product Viability - Found in 2026-04-01 Skeptic Review)

These are the 6 foundational gaps blocking product viability. **Must be completed before scaling user acquisition.**

- [ ] **Implement payment processor (Stripe / Paddle / Lemon Squeezy)**
  - Scope: Add Stripe checkout session → webhook handler → plan activation flow. Update entitlements model to track `stripeCustomerId` + `stripeSubscriptionId`. Wire billing portal link in settings.
  - Acceptance: User can purchase $12 or $29 plan from pricing page, entitlements update on webhook, portal link works in settings.
  - Verification: Run end-to-end purchase flow in Stripe test mode on staging; verify DB reflects purchase; confirm paid features unlock immediately.

- [x] **Stream the two-pass builder to prevent UI blocking**
  - Scope: Swap builder pipeline from blocking `generateText` calls to `streamText` with real-time artifact updates. Show "Draft" → "Critic review" → "Final" progression in UI.
  - Acceptance: Complex page builds show streaming progress instead of blank canvas; draft appears in editor within 5 seconds.
  - Verification: Build a SaaS landing page in agent UI; verify timestamps on each phase appear in console; no 30+ second blank periods.

- [x] **Fix message persistence: stop losing images and file attachments**
  - Scope: Add `partsJson` column to `message` table to store full `UIMessagePart[]` structure (not flattened text). Migrate persisted messages. Update `saveMessage()` to serialize parts; `getMessagesByChatId()` to deserialize.
  - Acceptance: Reload a chat that contains images → images reappear. File attachments show correct file type badge + size.
  - Verification: Upload 3 images + PDF to a chat, save it, reload it, inspect message history in DevTools — all media present.
- [ ] **Add OAuth / social login (Google minimum)**
  - Scope: Wire Google OAuth provider into Better Auth. Add Google Sign In button on login/registration pages. Update auth server/client.
  - Acceptance: User can sign up and log in via Google accounts. Email/password still works as fallback.
  - Verification: Create test Google project, test sign-up flow, verify session created, test subsequent login.

- [ ] **Remove sandbox false claims OR implement real code executor**
  - Decision point: Either (A) remove `sandbox: required` + executor hints from Code Wizard, downgrade autonomy to `propose`, update system prompt to remove execution language; OR (B) implement a working code-execution backend (Docker container or VM executor stub).
  - If A: Scope is UI/prompt updates only (~2 hours). Update Code Wizard killer definition + system prompt to drop container language.
  - If B: Scope is building executor adapter, sandboxing, and error handling (~3-5 days). Start with local container validation, move to remote executor post-MVP.
  - Acceptance (A): Code Wizard personality updated to propose/review code, not execute. System prompt never claims execution capability.
  - Acceptance (B): `/api/sandbox/execute` endpoint works locally; Coder killer can request code runs and get real output (or structured error).
  - Verification (A): Audit system prompt for false claims. (B): Coder killer generates a test function, requests execution, receives output.

- [x] **Distribute rate limiting from in-memory to Redis (Upstash recommended)** — `src/lib/rate-limit.ts` now uses Upstash Redis pipeline (INCR/EXPIRE/PTTL) with 1500ms timeout and in-memory fallback on Redis errors. All callers (`/api/chat`, `/api/generate-image`, `/api/preview`, `/api/validate-bundle`) updated to `await checkRateLimit()`.

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

**NOTE: Escalated to "Critical Business Blockers" section above. See "Distribute rate limiting from in-memory to Redis" for full specs. Keeping this line for cross-reference:**

- [ ] Replace in-memory rate limiting with distributed rate limiting (Redis/Upstash) — see blocker section for acceptance criteria
- [ ] Keep current API rate-limit headers and 429 behavior unchanged after migration
- [ ] Add env vars for distributed limiter and document fail-open/fail-closed behavior
- [ ] Add monitoring for rate-limit hits by route and user/IP key

## High Priority (Storage and Performance)

**NOTE: This is subsumed by the "Fix message persistence" blocker above. Unified implementation:**

- [ ] Add `partsJson` column to store full `UIMessagePart[]` structures (not flattened text)
- [ ] Stop storing generated images as data URLs; upload to S3/R2 or equivalent
- [ ] Persist only image URLs and metadata; deserialize on chat reload
- [ ] Add migration script for existing data-URL messages
- [ ] Verify file attachments (PDF, CSV, etc.) also deserialize and show proper badges

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

## Medium Priority (URL & Navigation UX - 2026 Assessment)

- [ ] Migrate primary chat identity from query param to path segment (`/agent/[chatId]`) while preserving backward compatibility for existing `/agent?chat=<id>` links
  - Scope: Introduce dynamic App Router route for chat sessions, keep query-param support with canonical redirect/replaceState for old links
  - Acceptance: Opening a chat from history lands on `/agent/<chatId>`; existing shared/internal links using `?chat=` still resolve correctly
  - Verification: Open 10 historical chats from sidebar and direct-paste old `?chat=` URLs; all resolve to the same chat and canonicalize URL
- [ ] Keep query params for transient UI state only (mode, draft, panel), not primary resource identity
  - Scope: Audit `page.tsx` URL sync logic and remove `chat` as canonical query field once path migration is complete
  - Acceptance: `chatId` is derived from route segment, not query param; query params only represent optional view state
  - Verification: Trigger send/new-chat/share/refresh flows and confirm stable route-based chat identity
- [ ] Add canonical URL policy for chat routes and document it in developer docs
  - Scope: Define route conventions for internal navigation, share URLs, and migration behavior to avoid route drift
  - Acceptance: Route policy is documented and followed by sidebar navigation + chat page URL sync
  - Verification: Code review checklist includes route policy item; no new `?chat=` links introduced in new features

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

## Community Growth (Later)

- [ ] Execute post-blocker community plan in `launch/COMMUNITY_MASTERPLAN_30D.md` after critical business blockers are stabilized
- [ ] Replace README demo placeholder with a real GIF before major social distribution
- [ ] Enable and seed GitHub Discussions with pinned starter threads (show and tell, feature requests, bugs)
- [ ] Open and maintain 5 `good first issue` / `help wanted` tickets with explicit acceptance criteria
- [ ] Start weekly KPI review (stars delta, discussion participants, external PRs, response SLA)

## Release Readiness Checklist

- [ ] Verify all required env vars are set in hosting platform
- [ ] Run typecheck and lint in CI and pre-merge
- [ ] Run API smoke tests on every push/PR
- [ ] Verify metrics endpoint auth in production
- [ ] Perform post-deploy smoke: chat, attachments, image generation, share, delete
- [ ] Verify CSP is enforced with no critical violations
- [ ] Verify readiness endpoint reports dependency health (DB, auth, provider)
- [ ] Verify external uptime checks and alert routing are active
