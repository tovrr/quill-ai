# Active Context: Quill AI — Personal AI Agent App

## Current State

**App Status**: ✅ Fully built and deployed

Quill AI is a personal AI agent application (Manus AI-style) built on Next.js 16, TypeScript, and Tailwind CSS 4. It features a stunning dark-themed landing page and a fully interactive agent chat interface.

## Recently Completed

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
- [x] Added root `DEPLOYMENT_CHECKLIST.md` with env, validation, smoke-test, and triage steps
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
- [x] Updated Canvas interaction to match modern builder apps: force Code view while artifact generation is active, suppress parse-failed banner during streaming partials, and auto-switch to Preview once generation completes and preview is available
- [x] Added public-repo credibility scaffolding: README, MIT license, contributing/security/code-of-conduct docs, issue templates, PR template, and package metadata fields (homepage/repository/bugs/keywords/license)
- [x] Set project release version to 1.0.0 for public launch positioning (instead of 0.1.0 beta signaling)

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
