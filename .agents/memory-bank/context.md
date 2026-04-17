# Active Context: Quill AI — Personal AI Agent App

## Current State

**App Status**: ✅ Fully built and deployed

Quill AI is a personal AI agent application (Manus AI-style) built on Next.js 16, TypeScript, and Tailwind CSS 4. It features a stunning dark-themed landing page and a fully interactive agent chat interface.

## Recently Completed

- [x] Completed remaining Phase 2 domain migrations (batch 7): moved builder/auth/models files to `src/lib/builder/*`, `src/lib/auth/*`, and `src/lib/models/openrouter.ts` with full import rewiring and no stale legacy import paths
- [x] Started and executed Phase 4 validation pass: `npm run typecheck` + `npm run build` + `npm run test:agent-remediation` passed; `npm run test:execution` import path was fixed for moved execution module and now fails only when local Docker daemon is unavailable
- [x] Continued Phase 2 code reorganization (batch 6): moved observability modules into `src/lib/observability/` (`metrics.ts`, `logging.ts`, `rate-limit.ts`) and rewired imports across chat/health/admin/artifacts/skills/google/mcp routes with passing typecheck and build
- [x] Continued Phase 2 code reorganization (batch 5): moved extensions modules into `src/lib/extensions/` (`mcp-registry.ts`, `skills.ts`, `autopilot.ts`, `customization.ts`) and rewired imports across agent/chat/autopilot/mcp/skills/settings callers with passing typecheck and build
- [x] Continued Phase 2 code reorganization (batch 4): moved integration modules into `src/lib/integrations/` (`google-api.ts`, `web-search.ts`) and rewired imports across chat/google/me/lib callers with passing typecheck and build
- [x] Continued Phase 2 code reorganization (batch 3): moved data modules into `src/lib/data/` (`db-helpers.ts`, `audit-log.ts`) and rewired imports across API routes/share page/lib with passing typecheck and build
- [x] Continued Phase 2 code reorganization (batch 2): moved execution modules into `src/lib/execution/` (`service.ts`, `docker.ts`, `providers.ts`) and rewired imports across chat/runtime/sandbox entry points with passing typecheck and build
- [x] Started Phase 2 code reorganization (batch 1): moved AI domain modules into `src/lib/ai/` (`assistant-message-utils.ts`, `killer-autonomy.ts`, `killers.ts`) and rewired imports across route/UI/lib callers with passing typecheck and build
- [x] Executed Phase 1 documentation rollout for repository structure: created `CHANGELOG.md`, added API governance docs (`docs/api/DESIGN_GUIDE.md`, `docs/api/TAXONOMY.md`), added modularity guide (`docs/patterns/MODULARITY.md`), and seeded ADR set (`docs/decisions/001`-`010` + template)
- [x] Standardized architecture decision tracking under `docs/decisions/` to reduce decision drift and make major technical choices reviewable
- [x] Base Next.js 16 setup with App Router
- [x] TypeScript configuration with strict mode
- [x] Tailwind CSS 4 integration
- [x] ESLint configuration
- [x] Memory bank documentation
- [x] Recipe system for common features
- [x] **Quill AI landing page** — hero, features grid (6 capabilities), how-it-works, example tasks, CTA, footer
- [x] **Agent chat interface** at `/agent` — sidebar, chat window, message bubbles, tool call cards
- [x] **AgentStatusBar** — live task status with step counter and progress bar
- [x] **TaskInput** — auto-resize textarea, keyboard shortcuts, quick suggestion chips
- [x] **ToolCallCard** — expandable tool call results with status indicators (pending/running/done/error)
- [x] **Agent simulator** — realistic multi-step responses for research/write/code/analyze tasks
- [x] Custom design system: dark theme (#0a0a0f), red accent (#EF4444), animations, glassmorphism
- [x] Inter font, gradient text, glow borders, typing indicator, custom scrollbars
- [x] **Migrated database from SQLite to Neon PostgreSQL** — updated schema (pg-core), driver (@neondatabase/serverless), drizzle config, and db helpers
- [x] Added db scripts: `db:generate`, `db:push`, `db:studio`
- [x] **3 model modes**: Fast (OpenRouter free model when available, otherwise `gemini-2.5-flash-lite`), Think (`gemini-2.5-flash`), Pro (`gemini-2.5-pro`)
- [x] **File upload**: multimodal file/image attachments via AI SDK `sendMessage({ text, files })`
- [x] **Image generation**: `/api/generate-image` route using Imagen 4, dedicated image mode toggle in TaskInput
- [x] **Canvas mode**: split-pane document view (CanvasPanel) showing last AI response in clean document format
- [x] Fixed chatId not being sent to API (was using `id` field, now injected via `prepareSendMessagesRequest`)
- [x] Fixed chat payload and provider runtime issues (valid Gemini model mapping + robust message extraction)
- [x] Added guest-safe chat behavior (no DB persistence for unauthenticated users)
- [x] Added authenticated chat deletion flow (API endpoint + sidebar actions + confirmation)
- [x] Added daily per-mode quotas (Free/Think/Pro) and guest fast-mode restriction
- [x] Added optional OpenRouter fast-mode routing (`OPENROUTER_API_KEY`, `OPENROUTER_FREE_MODEL`)
- [x] Migrated key UI files from raw color classes to Tailwind v4 Quill tokens to remove diagnostics noise
- [x] Added share page auth + ownership validation (login required, non-owner chats return 404)
- [x] Added shared in-memory API rate limiter utility for production hardening
- [x] Added request-ID observability helpers (`x-request-id`, structured start/complete logs)
- [x] Applied per-minute route limits to `/api/chat` and `/api/generate-image`
- [x] Added protected `/api/metrics` endpoint (token-gated) for route/status/error counters
- [x] Added CI API smoke workflow (`.github/workflows/ci-smoke.yml`) and smoke script
- [x] Tuned production defaults for daily quotas and per-minute burst limits in `.env.example`
- [x] Added OpenRouter best-free-model auto-selection with 48h caching
- [x] Added per-tier model overrides (`FAST_MODEL_OVERRIDE`, `THINKING_MODEL_OVERRIDE`, `ADVANCED_MODEL_OVERRIDE`) for zero-redeploy routing changes
- [x] Added Neon foreign-key indexes for auth/chat/message relations and verified them live
- [x] Refined chat input UX: separate attach button, mode selector near send, clickable non-image attachments
- [x] Preserved attachment parts end-to-end for multimodal requests and improved file-only persistence fallbacks
- [x] Added `/api/me/entitlements` and enforced paid-mode access for Think/Pro on both client and server
- [x] Updated mode selector to keep paid tiers visible but locked for non-paid users, plus refreshed TODO and deployment docs
- [x] Added Tavily-backed live web search for signed-in users, with entitlement-aware UI states (available/login required/coming soon)
- [x] Updated visible plan labels in sidebar/settings to use entitlements instead of hardcoded Free placeholders
- [x] **Full mobile responsive overhaul**: all breakpoints standardised to `md` (768px); header Share/New-chat become icon-only `size-8` squares; TaskInput toolbar collapses to icon-only below md (attach→+, search→globe, image→sparkles)
- [x] **Killer short names**: added `shortName` field to Killer interface; header badge swaps between shortName (mobile) and full name (desktop) at md breakpoint
- [x] **UI remediation Phase 2 completed**: migrated remaining product inline SVG icons across agent/docs/pricing/share surfaces to canonical Heroicons; only `src/components/ui/QuillLogo.tsx` retains inline SVG as the explicit brand-logo exception
- [x] **HeroInput component** (`src/components/HeroInput.tsx`): animated typewriter cycling 6 task placeholders at 28ms/char; submits directly to `/agent?q=<task>`; no login required
- [x] **Homepage hero CTA** replaced with HeroInput widget + "Already have account? Sign in" micro-link (higher conversion, zero-friction start)
- [x] **Agent page auto-fire**: reads `?q=` URL param on mount and sends it as first message with 120ms delay (one-shot via `heroTaskFiredRef`)
- [x] **Sidebar guest CTA**: unauthenticated users see a "Sign in to save and access your conversation history" prompt with Sign in button in the history section
- [x] **Image button icon**: replaced landscape icon with sparkles SVG; unauthenticated state shows "Login" pill badge (mirrors Search button pattern)
- [x] **CI native binary fixes**: added `lightningcss-linux-x64-gnu/musl` and `@tailwindcss/oxide-linux-x64-gnu/musl` to `optionalDependencies`; CI force-installs each separately with `|| true` fallback
- [x] **Tailwind token cleanup**: replaced all 62 hardcoded hex colors in `page.tsx` and `HeroInput.tsx` with canonical `quill-*` design tokens
- [x] **Icon consistency**: replaced placeholder "A" favicon with actual feather quill logo across all icon sizes; added `scripts/generate-icons.mjs` to regenerate PNGs from SVG via `sharp`
- [x] Added guest-session persistence and automatic guest-to-login chat import so one active guest conversation survives reloads and is moved into history after sign-in
- [x] Added DB-backed model usage telemetry with `/admin/model-usage` dashboard and local pricing env support for Gemini Flash Lite / Flash / Pro / Imagen 4 Fast
- [x] Upgraded `/api/health` into a readiness endpoint with DB ping, auth session-store probe, real provider reachability checks, timeout bounds, and degraded-mode hints
- [x] Shipped builder artifacts V1-V5: typed parser (`builder-artifacts.ts`), target modes (auto/page/react-app/nextjs-bundle), iteration locks, refinement memory, and artifact metrics
- [x] Fixed builder reliability regressions: OpenRouter fast mode is opt-in (`OPENROUTER_FAST_ENABLED`), parser now salvages loose file maps, and chat bubbles summarize artifacts instead of dumping raw code
- [x] Added CSP-safe React preview sandbox: `/api/preview` generates runtime HTML and Canvas loads it via blob URL iframe
- [x] Completed Step 6 export-first hardening for `nextjs-bundle`: stricter generation rules, inferred bundle typing from file maps, export-readiness diagnostics in Canvas, and downloadable PowerShell setup script
- [x] Added section-level partial regeneration for page artifacts using stable section IDs
- [x] Added optional local Next.js bundle validator endpoint (`/api/validate-bundle`) gated by `BUILDER_LOCAL_VALIDATE_ENABLED`
- [x] Added user customization profiles (preset + additional instructions) in settings and prompt injection path
- [x] Added Killer autonomy scaffolding: autonomy levels, per-Killer permission maps, and execution policy interface with future sandbox provider hook support
- [x] Enforced Killer autonomy policy in `/api/chat` for current execution-shaped actions: web search and builder activation
- [x] Exposed Killer autonomy level and capability summary in sidebar selection UI and active agent UI
- [x] Added sandbox provider registry and adapter boundary; chat route now resolves provider availability/runtime status for future container/VM handoff
- [x] Simplified the agent UI for lower cognitive load: all 5 Killers stay visible in the sidebar, but cards are reduced to icon/name/tagline; builder target is separated from the model dropdown; page refine/lock controls are collapsed into quiet details panels; desktop canvas now opens as a softer overlay drawer instead of a permanent split pane
- [x] Tightened generation UX: mobile composer safe-area padding increased, empty streamed assistant bubbles suppressed, fallback loading bubble now shows `Thinking...`, and TaskInput now swaps to a stop button with a working-status pill while requests are active
- [x] Hardened assistant message rendering pipeline: `assistant-message-utils.ts` (new) centralises part normalisation, renderable-content checks, and canonical display extraction; `RealMessageBubble` uses explicit branch classification (text/reasoning/file/tool/other) with plain-text `<p>` path for non-markdown replies
- [x] Fixed root-cause empty assistant bubble bug: `ArtifactSummary` was called as JSX (always non-null), so the `??` fallback to `MarkdownText`/plain-text never ran — fixed by checking `parseBuilderArtifact()` return value directly before rendering
- [x] Hardened builder artifact contract in chat prompt: only `page`, `document`, `react-app`, and `nextjs-bundle` are allowed as `artifact.type` values to prevent unsupported custom types from breaking Canvas expectations
- [x] Distributed rate limiting: `src/lib/rate-limit.ts` now uses Upstash Redis (INCR/EXPIRE/PTTL pipeline, 1500ms timeout) with automatic in-memory fallback; all API routes updated to `await checkRateLimit()`
- [x] Added guest-session persistence: one active conversation survives page reloads for unauthenticated users (localStorage, 24h TTL); auto-imported into DB history after sign-in
- [x] Updated Canvas interaction to match modern builder apps: force Code view while artifact generation is active, suppress parse-failed banner during streaming partials, and auto-switch to Preview once generation completes and preview is available
- [x] Added public-repo credibility scaffolding: README, MIT license, contributing/security/code-of-conduct docs, issue templates, PR template, and package metadata fields (homepage/repository/bugs/keywords/license)
- [x] Set project release version to 1.0.0 for public launch positioning (instead of 0.1.0 beta signaling)
- [x] Fixed the `/agent` bundle budget regression by extracting lightweight canvas helpers into `canvas-utils.ts` and lazy-loading `CanvasPanel`; measured result: largest JS chunk dropped from 670.23 KB to 635.18 KB and `npm run bundle:check` now passes
- [x] Began splitting the chat backend god-route: extracted the two-pass builder streaming flow into `src/lib/chat/two-pass-builder.ts`, leaving `/api/chat` to orchestrate request handling while preserving the same builder persistence and usage tracking behavior
- [x] Continued chat-route decomposition by extracting request validation and message normalization helpers into `src/lib/chat/request-utils.ts` (`parseChatRequestBody`, model-message extraction, last-user summary/parts helpers), keeping `/api/chat` focused on orchestration
- [x] Continued chat-route decomposition by extracting mode limits + provider/model selection into `src/lib/chat/model-selection.ts` (`getDailyLimitForMode`, `resolveModelForMode`) and wiring `/api/chat` to consume it
- [x] Continued chat-route decomposition by extracting entitlement and quota checks into `src/lib/chat/access-gates.ts` (`evaluateChatAccess`) and replacing in-route guard branches with a single orchestration call
- [x] Continued chat-route decomposition by extracting killer permission + sandbox runtime derivation into `src/lib/chat/policy-runtime.ts` (`evaluatePolicyRuntime`) and replacing in-route branching with a single computed runtime payload
- [x] Updated anti-hallucination documentation for the decomposed chat backend across `AGENTS.md`, `README.md`, `.agents/development.md`, and `.agents/memory-bank/architecture.md` with explicit module ownership and route orchestration rules
- [x] Added reviewer-facing chat guardrails to `CONTRIBUTING.md` and `.github/pull_request_template.md` so PRs enforce module ownership for `/api/chat` changes

## Current Structure

- `src/app/page.tsx`: Landing page (Quill AI homepage) — ✅ Built
- `src/app/agent/page.tsx`: Agent chat interface — ✅ Built
- `src/app/layout.tsx`: Root layout with Inter font — ✅ Built
- `src/app/globals.css`: Design tokens, animations, custom classes — ✅ Built
- `src/components/ui/QuillLogo.tsx`: SVG feather quill logo — ✅ Built
- `src/components/HeroInput.tsx`: Animated typewriter hero input, submits to `/agent?q=` — ✅ Built
- `src/components/layout/Sidebar.tsx`: Sidebar with nav, recent chats, guest login CTA — ✅ Built
- `src/components/agent/ChatWindow.tsx`: Scrollable message list — ✅ Built
- `src/components/agent/MessageBubble.tsx`: User/assistant message bubbles — ✅ Built
- `src/components/agent/ToolCallCard.tsx`: Tool call status cards — ✅ Built
- `src/components/agent/TaskInput.tsx`: Task input with mode pills, file upload, image gen toggle — ✅ Built
- `src/components/agent/AgentStatusBar.tsx`: Live agent status bar — ✅ Built
- `src/components/agent/CanvasPanel.tsx`: Split-pane document canvas view — ✅ Built
- `src/app/api/generate-image/route.ts`: Imagen 4 image generation endpoint — ✅ Built
- `src/lib/agentSimulator.ts`: Mock agent response simulator (legacy/unused) — ✅ Built

## Current Focus

Current priorities:

1. Add a real execution handoff path that uses the sandbox registry for validated tasks
2. Push local builder/autonomy batch after approval
3. Replace env-based paid entitlements with a DB billing/subscription model
4. Replace in-memory rate limiting with a distributed limiter
5. Add external uptime monitoring + alerting for `/`, `/agent`, `/api/health`, and `/api/chat`
6. PWA offline support (service worker) — required before any app store submission
7. Validate the simplified agent UX in-browser across desktop and mobile, especially stop-state behavior and streaming feedback

## Quick Start Guide

### To add a new page

Create a file at `src/app/[route]/page.tsx`:

```tsx
export default function NewPage() {
  return <div>New page content</div>;
}
```

### To add components

Create `src/components/` directory and add components:

```tsx
// src/components/ui/Button.tsx
export function Button({ children }: { children: React.ReactNode }) {
  return <button className="px-4 py-2 bg-blue-600 text-white rounded">{children}</button>;
}
```

### To add a database

Follow `.kilocode/recipes/add-database.md`

### To add API routes

Create `src/app/api/[route]/route.ts`:

```tsx
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Hello" });
}
```

## Available Recipes

- Add Database: `.kilocode/recipes/add-database.md` — Data persistence with Drizzle + PostgreSQL

## Pending Improvements

- [ ] Add more recipes (auth, email, etc.)
- [ ] Add example components
- [ ] Add testing setup recipe

## Session History

- 2026-04-17: Completed remaining Phase 2 migrations and started Phase 4 validation closure: moved `src/lib/builder-artifacts.ts`, `src/lib/api-metrics.ts`, `src/lib/api-security.ts`, `src/lib/entitlements.ts`, and `src/lib/openrouter-models.ts` into `src/lib/builder/`, `src/lib/auth/`, and `src/lib/models/` with history-preserving renames and import rewiring; verified no stale legacy import paths remain. Validation results: `npm run typecheck` pass, `npm run build` pass, `npm run test:agent-remediation` pass, and `npm run test:execution` now executes with corrected import path but reports local Docker daemon unavailable.

- 2026-04-17: Continued Phase 2 with observability-domain migration (batch 6): moved `src/lib/model-usage.ts`, `src/lib/observability.ts`, and `src/lib/rate-limit.ts` to `src/lib/observability/` as `metrics.ts`, `logging.ts`, and `rate-limit.ts` using history-preserving moves, rewired all affected imports across API/chat/lib modules, corrected one nested import rewrite edge-case, and revalidated with passing `npm run typecheck` and `npm run build`.

- 2026-04-17: Continued Phase 2 with extensions-domain migration (batch 5): moved `src/lib/mcp-registry.ts`, `src/lib/skills-registry.ts`, `src/lib/autopilot-utils.ts`, and `src/lib/user-customization.ts` to `src/lib/extensions/` using history-preserving moves, rewired all affected imports in agent/chat/autopilot/mcp/skills/settings callers, and revalidated with passing `npm run typecheck` and `npm run build`.

- 2026-04-17: Continued Phase 2 with integrations-domain migration (batch 4): moved `src/lib/google-api.ts` and `src/lib/web-search.ts` to `src/lib/integrations/` using history-preserving moves, rewired all affected imports in chat/google/me/lib modules, and revalidated with passing `npm run typecheck` and `npm run build`.

- 2026-04-17: Continued Phase 2 with data-domain migration (batch 3): moved `src/lib/db-helpers.ts` and `src/lib/audit-log.ts` to `src/lib/data/` using history-preserving moves, rewired all affected imports across API routes/share/lib modules, and revalidated with passing `npm run typecheck` and `npm run build`.

- 2026-04-17: Continued Phase 2 with execution-domain migration (batch 2): moved `src/lib/execution-service.ts`, `src/lib/docker-executor.ts`, and `src/lib/sandbox-providers.ts` into `src/lib/execution/` as `service.ts`, `docker.ts`, and `providers.ts` using history-preserving moves, rewired all impacted imports, and revalidated with passing `npm run typecheck` and `npm run build`.

- 2026-04-17: Began Phase 2 implementation with the first low-risk migration batch: moved `src/lib/assistant-message-utils.ts`, `src/lib/killer-autonomy.ts`, and `src/lib/killers.ts` to `src/lib/ai/` using history-preserving moves, rewired all impacted imports in app/components/lib, and revalidated with passing `npm run typecheck` and `npm run build`.

- 2026-04-17: Executed Phase 1 of repository-structure plan after Phase 0 skeleton: created and committed changelog (`CHANGELOG.md`), API documentation (`docs/api/DESIGN_GUIDE.md`, `docs/api/TAXONOMY.md`), modularity conventions (`docs/patterns/MODULARITY.md`), and 10 architecture decision records plus ADR template under `docs/decisions/`. Revalidated with passing `npm run typecheck`.

- 2026-04-17: Reorganized memory bank from `.kilocode/rules/memory-bank/` to `.agents/memory-bank/` to align with agent-focused codebase structure. Updated all references in AGENTS.md and development documentation.

- 2026-04-17: Created and committed execution roadmap artifact `EXECUTION_PLAN_QUILL_PARITY.md` for Quill feature catch-up (M1-M5) and executed Milestone 1 foundation: added curated MCP registry source (`src/lib/mcp-registry.ts`), shipped auth-gated search/list API (`GET /api/mcp/registry`), and integrated one-click registry install flow in MCP UI (`src/app/mcp/page.tsx`) that pre-fills add-server form with registry metadata. Revalidated with passing `npm run typecheck` and `npm run build`.

- 2026-04-17: Completed Next.js/Vercel architecture Phase 2 corrections: removed cookie-presence redirect logic from `src/proxy.ts` and moved login redirect to session-validity checks in `src/app/login/page.tsx`; made metadata host resolution environment-driven in `src/app/layout.tsx` (`NEXT_PUBLIC_APP_URL`/`VERCEL_URL` with local/prod fallbacks); adopted Vercel-native frontend telemetry by adding `@vercel/analytics` + `@vercel/speed-insights` and mounting `Analytics`/`SpeedInsights` in root layout. Updated Phase 2 TODO items to done and revalidated with passing `npm run typecheck` and `npm run build`.

- 2026-04-16: Completed connector hardening pass for new Artifact History, MCP Catalog, and Google Workspace APIs: added shared `api-security` helpers (bounded ints, sanitized Drive query, safe upstream error truncation), added structured audit events (`audit-log.ts`) for mutating actions (artifact create/delete, MCP create/update/delete/connect, Google connect/disconnect), upgraded routes to use request observability helpers (`x-request-id`, start/complete metrics logs), validated MCP URL protocol checks, and tightened Google OAuth callback with session-bound nonce state cookie verification before token exchange. Revalidated with passing `npm run typecheck` and `npm run build`.
- 2026-04-16: Shipped Autopilot v1: `autopilot_workflow` + `autopilot_run` DB tables (Drizzle/Postgres), `/api/autopilot/workflows` CRUD + pause/resume, `/api/autopilot/workflows/[id]/run` manual trigger, `/api/autopilot/runs` run history, `src/lib/autopilot-utils.ts` validation, `/autopilot` page UI (create form with cron templates, workflow cards with status/actions, run history feed), sidebar "Autopilot" nav link. All auth-gated, typecheck + build pass. No external scheduler wired yet — runs are triggered manually or via future cron hook. Deferred: cloning Coworker repo as monorepo (partner suggestion) — rejected as architecturally incompatible stacks (Bun/Mastra vs Node/Next.js). Features are being reimplemented natively instead.

- Initial: Template created with base setup
- 2026-03-28: Built Quill AI full personal AI agent app with landing page, agent chat UI, tool call cards, and mock simulator
- 2026-03-28: Migrated database from SQLite to Neon PostgreSQL with @neondatabase/serverless driver
- 2026-03-28: Added 3 model modes (Fast/Think/Pro), file upload, image generation (Imagen 4), and canvas mode
- 2026-03-29: Stabilized chat pipeline (payload/model fixes), guest-safe persistence, and sidebar delete-with-confirm
- 2026-03-29: Added daily mode quotas and optional OpenRouter free-model path
- 2026-03-29: Cleared major Tailwind v4 token diagnostics in agent/docs/login/status UI
- 2026-03-29: Enforced share route auth and ownership checks; cleaned remaining lint warnings to green
- 2026-03-29: Added API request IDs, structured API completion logs, per-minute route limits, and deployment checklist
- 2026-03-29: Added token-gated `/api/metrics`, CI API smoke tests, and tuned production env defaults for quotas/rate limits
- 2026-03-29: Added OpenRouter auto-selection, audited Neon indexes, and improved multimodal attachment handling
- 2026-03-29: Added entitlement endpoint and paid-mode enforcement; updated selector UX to show locked paid tiers for free users
- 2026-03-29: Implemented live web search with Tavily retrieval, auth gating, and entitlement-driven search button states
- 2026-03-31: Added guest session persistence, guest-to-login import, and fixed hero `?q=` reload replay
- 2026-03-31: Added model usage telemetry, `/admin/model-usage`, Flash Lite / Flash / Pro tiering, and provider-aware readiness checks
- 2026-04-01: Builder marathon completed through Step 6 (typed artifacts, locks, refine actions, parser fallbacks, CSP-safe React preview sandbox, export readiness)
- 2026-04-01: Added section-level partial regenerate actions, optional local bundle validation endpoint, and settings-driven user customization profiles
- 2026-04-01: Added autonomy-policy scaffolding for Killers with future container/VM sandbox hook support
- 2026-04-01: Enforced autonomy-policy checks in chat route for web search and builder-mode activation
- 2026-04-01: Added autonomy transparency UI in sidebar and agent view
- 2026-04-01: Added sandbox provider registry/adapters and runtime status resolution for future isolated execution
- 2026-04-01: Reworked the agent interface toward a more minimal surface, added skeptic-review critical blockers to `TODOS.md`, and fixed follow-up UX regressions around composer spacing, empty streaming bubbles, working-state copy, and stop-button availability
- 2026-04-01: Confirmed launch versioning strategy and bumped package manifests to 1.0.0
- 2026-04-01: Added separate launch copy files under `launch/` for GitHub release notes, X posts, LinkedIn posts, and pinned comment text
- 2026-04-01: Added a deferred 30-day community growth masterplan and linked it from TODOs for post-blocker execution
- 2026-04-01: Implemented message persistence hardening with `partsJson` storage, durable DB-backed file URLs (`/api/files/[fileId]`), and guest import support for rich message parts
- 2026-04-02: Completed codebase audit; flagged critical exposure on unauthenticated `/api/validate-bundle` (shell npm execution) and unauthenticated `/api/preview`, plus CSP hardening gaps and a CanvasPanel lint regression (`setState` in effect)
- 2026-04-02: Applied immediate hardening fixes: `/api/validate-bundle` now requires auth, rate-limits per user, blocks unsafe file paths, and runs npm with `shell: false`; `/api/preview` now requires auth and per-user throttling; metrics/admin token checks now use timing-safe comparison; CanvasPanel tab logic refactored to remove setState-in-effect lint violation
- 2026-04-02: Reviewed `src/app/agent/page.tsx` follow-up change; added Suspense boundaries around Sidebar renders to resolve Next.js prerender error for `/agent` (`useSearchParams` CSR bailout), then re-validated with passing lint, typecheck, and production build
- 2026-04-02: Updated live GitHub About metadata (description + topics) via GitHub CLI and modernized README launch/onboarding copy to better match public AI app positioning
- 2026-04-09: Replaced `REMEDIATION_PLAN_30D.md` with a 30-day UI remediation plan focused on Shadcn primitives, Heroicons-only product icons, token hardening, accessibility cleanup, and CI enforcement; explicit exception kept for `src/components/ui/QuillLogo.tsx` as a brand asset.
- 2026-04-02: Cleared the GitHub Dependabot moderate vulnerability by adding npm overrides for `@esbuild-kit/* -> esbuild@0.27.5`, then revalidated with `npm audit` = 0 vulnerabilities, working `drizzle-kit --help`, passing lint, and passing production build
- 2026-04-02: Removed local Better Auth low-entropy warning by rotating `.env.local` secret to a stronger mixed-character value and updated `.env.example`, README, and deployment guidance to recommend high-entropy secrets (`openssl rand -base64 48`)
- 2026-04-02: Fixed chat no-response regression by migrating the client from `TextStreamChatTransport` to `DefaultChatTransport` and the server from plain text streaming to `toUIMessageStreamResponse` / `createUIMessageStreamResponse`, then verified typecheck, lint, build, and live `/api/chat` SSE output
- 2026-04-03: Tightened builder prompt constraints to disallow unsupported artifact types (e.g., `python-cli`) and revalidated with passing typecheck and production build
- 2026-04-08: Added explicit 2026 URL/navigation UX follow-ups to TODOs: migrate chat identity from `/agent?chat=<id>` to route-segment style (`/agent/[chatId]`) with backward compatibility, keep query params for transient UI state only, and document canonical routing policy
- 2026-04-08: Reduced redundant chat chrome by removing desktop header New Chat button and Quill Agent launcher, added editable session title in header (with authenticated PATCH persistence + guest localStorage persistence), and strengthened assistant copy-action feedback with clear copied state/icon/label
- 2026-04-08: Fixed doc/slides/sheets canvas regression by expanding client+server builder-intent heuristics to include document-style requests; added universal response-style prompt rules for valid Markdown formatting and sparse intentional emoji usage
- 2026-04-09: Implemented UI remediation Phase 0 guardrails: added `scripts/ui-standards.mjs`, baseline artifacts (`.ui-standards-baseline.json`, `UI_STANDARDS_BASELINE.md`), contributor policy (`UI_STANDARDS.md`), npm scripts (`audit:ui-standards`, `enforce:ui-standards`), and CI workflow (`.github/workflows/ui-standards.yml`) with passing enforcement and lint.
- 2026-04-09: Began UI remediation Phase 1 by introducing a Shadcn-style primitive foundation in `src/components/ui` (button, input, textarea, dialog, select, switch, card, badge, sheet, dropdown-menu, tabs, separator, scroll-area, collapsible, tooltip), added shared `cn()` helper (`src/lib/utils.ts`), and aligned guardrails by allowlisting internal primitive implementations for raw primitive checks; revalidated with passing enforce, lint, and typecheck.
- 2026-04-09: Started UI remediation Phase 2 by removing the custom `KillerSvgIcon` layer (`src/components/ui/KillerIcon.tsx` deleted), migrating `src/app/page.tsx` icon rendering to canonical Heroicons imports (including Killer card icon mapping by `iconKey`), and revalidating with passing `enforce:ui-standards`, `lint`, and `typecheck`; refreshed `UI_STANDARDS_BASELINE.md` via `audit:ui-standards`.
- 2026-04-12: Refined `/agent` interaction chrome: reordered assistant bubble actions to like/dislike/regenerate/copy, rebuilt action controls with consistent touch-target sizing, and normalized toolbar/action icon sizes across `RealMessageBubble` and `TaskInput` for clearer mobile vs desktop ergonomics.
- 2026-04-09: Finished UI remediation Phase 2 icon migration by converting remaining inline SVG product icons in agent/docs/pricing/share UI files to Heroicons, leaving only `src/components/ui/QuillLogo.tsx` as the sanctioned brand-logo SVG; revalidated with passing `enforce:ui-standards`, `lint`, and `typecheck`.
- 2026-04-11: Fixed the `/agent` bundle budget regression by extracting `isHTMLContent` / `isCanvasRenderableContent` into `src/components/agent/canvas-utils.ts` and dynamically importing `CanvasPanel`; revalidated with passing typecheck, production build, and bundle budget (`largest JS chunk: 635.18 KB`, down from `670.23 KB`)
- 2026-04-11: Started route decomposition for `/api/chat` by moving the two-pass builder implementation into `src/lib/chat/two-pass-builder.ts`; revalidated with passing typecheck and production build
- 2026-04-11: Continued `/api/chat` decomposition by moving request validation and message/parts normalization helpers to `src/lib/chat/request-utils.ts`; revalidated with passing typecheck and production build
- 2026-04-12: Continued `/api/chat` decomposition by moving mode quota lookup and model/provider resolution into `src/lib/chat/model-selection.ts`; revalidated with passing typecheck and production build
- 2026-04-12: Continued `/api/chat` decomposition by moving entitlement + guest/web-search/daily quota enforcement into `src/lib/chat/access-gates.ts` and wiring route-level failure mapping (`status`, `errorCode`, `message`); revalidated with passing typecheck and production build
- 2026-04-12: Continued `/api/chat` decomposition by moving killer policy evaluation and sandbox availability/runtime flags into `src/lib/chat/policy-runtime.ts`; route now consumes `killer`, `policyWarnings`, `effectiveWebSearchRequested`, `canvasBuildIntent`, `sandboxStatus`, and `canRunCode` from one helper; revalidated with passing typecheck and production build
- 2026-04-12: Added anti-hallucination architecture guardrails for the chat backend in `AGENTS.md` + internal rules/docs and corrected stale runbook env-key references (`GOOGLE_GENERATIVE_AI_API_KEY`) to keep agent guidance aligned with the current codebase
- 2026-04-12: Added a Chat Backend Change Checklist in `CONTRIBUTING.md` and chat-specific review checks in `.github/pull_request_template.md` to prevent re-inlining and keep chat edits routed through the correct `src/lib/chat/*` modules
