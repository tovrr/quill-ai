# Quill AI — Implementation Brief

**Session date:** 2026-08-02 (Europe/Berlin)
**Author session:** Mavis (M3) — tovrr devforge project
**Target repo:** `tovrr/quill-ai`
**Branches:** `staging` (base) ← `handoff/2026-08-02-quill-ai-context` (this PR)
**Live:** https://quill-ai-xi.vercel.app
**Status of product at handoff:** 0 stars, 0 forks, 0 users. Live and Stripe-wired. 8 CI workflows. ADRs 000–010 in `docs/decisions/`.

---

## 0. TL;DR (60 seconds)

We agreed on a single direction across three plans:

1. **Strip the product to a MiniMax.io-style interface** — minimal home, 3-panel chat (nav / scrollback / composer), hide sidebars by default, kill the marketing surface from the home page.
2. **Add light + dark theme with system default** — refactor `globals.css` from dark-only hardcoded colors to a `:root` + `.dark` dual token system, add `next-themes`, build a `ThemeToggle` component, support `Cmd/Ctrl+Shift+L`.
3. **Wire Hermes and OpenClaw as real integrations** — both exist as inbound SKILL.md + ingest route but are dead on the outbound side. Add Hermes as a model provider in `src/lib/chat/model-selection.ts` and OpenClaw as an execution runtime in `src/lib/execution/service.ts`.
4. **Ship desktop (Tauri v2) with Windows installer + auto-update, then mobile (Capacitor)** — the Tauri shell already exists; needs polish, bundling, and code-signing.

Critical "do not do" rules:
- **No new modes or new personas** (you have 5 killers + 3 modes; that's already too many). Killers live at `/personas`; default composer has none.
- **No marketing surface on the home page** — move it to `/about`.
- **No custom theme color picker** — System / Light / Dark is enough.
- **Every change must keep `npm run test:ci` green.**

---

## 1. Product state (what actually exists today)

### Stack (verified in code)
- **Framework:** Next.js 16.2.3 + React 19.2.3 + Tailwind 4.1.17
- **AI:** Vercel AI SDK 6 (`ai`, `@ai-sdk/google`, `@ai-sdk/openai`, `@ai-sdk/react`)
- **Code execution:** `@e2b/code-interpreter`
- **DB:** Neon serverless Postgres + Drizzle ORM 0.45.2
- **Auth:** Better Auth 1.5.6 + Google OAuth
- **Payments:** Stripe 18.5.0 (`@stripe/stripe-js`, `@stripe/react-stripe-js`)
- **UI primitives:** Radix UI (13 components) + custom shadcn-style layer in `src/components/ui/`
- **Deployment:** Vercel (auto-deploy on main)

### Code surface (verified via tree)
- **359 src/ files, 158 API route files** across 30+ feature areas
- **8 CI workflows:** `ci-smoke`, `ci-guardrails`, `ci-ai-rules`, `ci-prompts`, `ui-standards`, `vercel-api-deploy`, `redeploy-vercel`, `check-vercel-deploy`
- **11 ADRs** in `docs/decisions/000-…010-*.md` (nextjs-16-app-router, chat-backend-decomposition, two-pass-builder-stream, auth-with-better-auth, distributed-rate-limiting, builder-artifact-contract, execution-service-abstraction, observability-and-readiness, mcp-registry-v1, memory-bank-in-agents)
- **14+ AI dev files** in `.agents/`, `.kilocode/`, `.openclaw/`, `.cursorrules`, `prompt.*.md`
- **30+ test commands** (`test:smoke`, `test:auth`, `test:rag`, `test:chatbot`, `test:agent-remediation`, `test:autopilot-cron`, `test:contracts`, `test:execution`, `test:cli`, `test:stripe`, `audit:chat-render`, `audit:ui-standards`, `enforce:ui-standards`, `guardrails:check`, `check:ai-rules`, `gen:ai-rules`)

### Known tech debt (from `REPOSITORY_STRUCTURE_AUDIT.md` + `REMEDIATION_PLAN_30D.md`)
- Shadcn is not established as the shared primitive layer.
- Heroicons is only used in a limited way; inline SVGs widespread.
- Design tokens exist, but many components still hardcode colors.
- Lint + typecheck pass; the work is structural, not break-fix.
- A 741-line `REMEDIATION_PLAN_30D.md` is in flight (April 9 – May 9, 2026).

### Tauri v2 desktop shell (verified)
- `desktop/src-tauri/` exists with `Cargo.toml`, `lib.rs`, `main.rs`, `tauri.conf.json`, `capabilities/default.json`, 8 icon sizes
- Wraps `https://quill-ai-xi.vercel.app` in a 1280×840 webview
- Has: tray icon (Show/Hide/Quit menu), single-instance lock, global shortcut `Ctrl+Shift+Q`
- **Missing:** real native feel, system theme sync, file system access, code signing, auto-update, menu bar, command palette

### PWA (verified)
- `src/app/manifest.ts` exists: `display: standalone`, `theme_color: #EF4444`, `start_url: /agent`, `scope: /`
- Icons: `icon-192.png` (5.5KB), `icon-512.png` (19KB), `apple-touch-icon.png` (5KB), `favicon.svg` (740B)
- Viewport: `width=device-width, initialScale=1, viewportFit: cover`, `themeColor: #EF4444`
- `appleWebApp: { capable: true, statusBarStyle: black-translucent, title: Quill AI }`
- **Missing:** light/dark theme_color variants, maskable icons, iOS splash screens, install-prompt UX

### Theme (verified — dark-only)
- `src/app/layout.tsx`: `<html lang="en" className="dark">` (hardcoded)
- `src/app/globals.css`: `body { background-color: #0e1015; color: #d4d4d8; }` (hardcoded)
- `tailwind.config.cjs`: `theme: { extend: {} }` — empty, no tokens, no dark variants
- `src/components/Providers.tsx`: just `<>{children}<Toaster /></>` — no theme provider
- **This is the first thing to fix.** Every component already references `bg-quill-bg`, `text-quill-text`, `border-quill-border` — they auto-switch when the variable flips. Zero component refactor needed once tokens are split.

### Dead-code integrations (confirmed)
- `src/lib/integrations/hermes-skill/SKILL.md` and `openclaw-skill/SKILL.md` exist (inbound only)
- `src/app/api/agent/mcp/route.ts` exists (MCP server, inbound — works)
- `src/app/api/agent/delegate/route.ts` exists (outbound — `OPENCLAW_GATEWAY_URL` env is unset on Vercel, route returns 503/500)
- `src/app/api/missions/ingest/route.ts` exists (inbound — works)
- `src/app/missions/page.tsx` exists (UI for inbox — works, but no traffic because nothing pushes to it in volume)
- `src/lib/integrations/google-api.ts` and `web-search.ts` exist (real outbound integrations)
- **Quill can RECEIVE from Hermes/OpenClaw but does NOT SEND to them in any working way.**
- **Hermes is not a model provider** (not in `src/lib/chat/model-selection.ts`).
- **OpenClaw is not an execution runtime** (not in `src/lib/execution/service.ts`).
- `AGENT_SOURCES` in `src/components/agent/TaskInput.tsx` includes `openclaw` and `hermes` as labels — they are dropdown options but selecting them does nothing functional.

---

## 2. The three plans (reference, not duplicates)

These were discussed and agreed in the source session. Read the linked originals for detail; this section is the index.

### Plan 1 — MiniMax.io-style interface
- Source: handoff conversation turn 5
- Goal: home = nav + centered input; chat = 3 panels (nav / scrollback / composer)
- Sequence: 5 days, low risk
- Files: `src/app/page.tsx` (rewrite), `src/app/about/page.tsx` (new), `src/app/agent/page.tsx` (simplify), `src/components/agent/TaskInput.tsx` (restyle mode), `src/components/layout/Sidebar.tsx` (slide-in, not permanent), `src/components/layout/SecondaryRightRail.tsx` (delete or hide), `src/components/layout/AccountMenu.tsx` (inline into top nav)

### Plan 2 — Light + dark theme system
- Source: handoff conversation turn 6
- Goal: every surface respects a single theme; default = system; manual override remembered; Tauri window syncs; PWA address bar / status bar adapts
- Sequence: 4 days, low risk
- Files: `src/app/globals.css` (dual tokens), `src/app/layout.tsx` (remove hardcoded dark), `src/components/Providers.tsx` (next-themes), `src/components/ThemeToggle.tsx` (new), `src/lib/useThemeShortcut.ts` (new, Cmd+Shift+L), `src/app/manifest.ts` (maskable + theme-color meta)

### Plan 3 — Real Hermes + OpenClaw integrations
- Source: handoff conversation turn 5
- Goal: Quill uses Hermes as a model provider AND uses OpenClaw as an execution runtime AND can delegate tasks out via `/api/agent/delegate`
- Sequence: 8 days, medium risk
- Files (Hermes): `src/lib/models/hermes.ts` (new), `src/lib/chat/model-selection.ts` (add provider), `src/lib/chat/request-utils.ts` (propagate), `src/app/api/chat/route.ts` (route), `src/components/agent/TaskInput.tsx` (pill), `src/lib/integrations/hermes-skill/SKILL.md` (update)
- Files (OpenClaw): `src/lib/execution/service.ts` (add branch), `src/lib/integrations/openclaw.ts` (new), `src/app/api/agent/delegate/route.ts` (verify + harden), `src/app/settings/page.tsx` (radio), `src/lib/ui-settings.ts` (extend), `src/lib/integrations/openclaw-skill/SKILL.md` (update)

### Bonus plan — Desktop + Windows + Mobile
- Source: handoff conversation turn 7
- Goal: Tauri desktop feels native (menu, hotkeys, palette, file dialog, notifications, custom title bar), ships as MSI/NSIS with auto-update, then Capacitor for iOS + Android
- Sequence: 13 days, medium-high risk
- File inventory:
  - **Created:** `src/components/ThemeToggle.tsx`, `src/components/CommandPalette.tsx`, `src/components/layout/TitleBar.tsx`, `src/components/UpdateToast.tsx`, `src/lib/useThemeShortcut.ts`, `public/icon-maskable-512.png`, `.github/workflows/release-windows.yml`, `capacitor.config.ts`, `ios/`, `android/`
  - **Modified:** `desktop/src-tauri/{tauri.conf.json, Cargo.toml, capabilities/default.json, src/lib.rs}`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/manifest.ts`, `src/app/agent/page.tsx`, `src/components/Providers.tsx`, `src/components/agent/TaskInput.tsx`, `src/components/agent/MessageBubble.tsx`, `package.json`

---

## 3. Prioritized backlog (17-day plan, single table)

| Day | Workstream | Deliverable | Risk |
|---|---|---|---|
| 1 | Theme | Refactor `globals.css` to `:root` + `.dark` token pairs | Low |
| 2 | Theme | Add `next-themes` provider, remove hardcoded `className="dark"` | Low |
| 3 | Theme | Build `ThemeToggle` + `Cmd+Shift+L` shortcut | Low |
| 4 | Theme | Theme-aware PWA manifest, maskable icon | Low |
| 5 | MiniMax UI | Rewrite `page.tsx` to MiniMax style; move marketing to `/about` | Low |
| 6 | MiniMax UI | Strip `agent/page.tsx` to 3 panels | Low |
| 7 | MiniMax UI | Restyle mode picker as a pill; remove killer selector from default composer | Med |
| 8 | MiniMax UI | Sidebar on-demand only; full-width chat by default | Low |
| 9 | MiniMax UI | Theme + type scale; remove decorative elements | Low |
| 10 | Hermes | Add `hermes` to model-selection; new `src/lib/models/hermes.ts` | Med |
| 11 | Hermes | Add "Hermes" pill in mode picker; route chat to Hermes | Low |
| 12 | Hermes | Verify MCP from a Hermes instance end-to-end; update SKILL.md | Low |
| 13 | OpenClaw | Add `openclaw` branch to `execution/service.ts` | Med |
| 14 | OpenClaw | Verify + harden `/api/agent/delegate`; new `lib/integrations/openclaw.ts` | Low |
| 15 | OpenClaw | "Execution Runtime" radio in settings; update SKILL.md | Low |
| 16 | Wrap | Update home/about copy; update GTM 14-day calendar | Low |
| 17 | Wrap | Add `Download for Windows` button on landing + release notes | Low |

If you only have 3 days, do Days 1–3. If you have 1 week, do Days 1–9. If you have 2 weeks, do Days 1–15. The Windows + Capacitor work is a Month 2 item.

---

## 4. Decisions made (and the why)

| Decision | Why |
|---|---|
| **Default composer has no killer selector** | You have 5 killers; that's already 4 more than MiniMax shows. Killer = niche persona for power users. Put it in `/personas`, not the composer. |
| **Sidebar hidden by default** | "Sidebar or chat?" is the wrong question. Chat always wins. Sidebar is a slide-in, not a column. |
| **No marketing on home** | ChatGPT, Claude, MiniMax all use the chat as the front door. Marketing lives at `/about`. |
| **`/agent` is the only path that matters for the home redirect** | `HeroInput` already auto-fires to `/agent?q=`. No change needed. |
| **Token-based theme via CSS variables** | Every component already references `bg-quill-bg`. A single `:root` / `.dark` swap lights everything up. Zero component refactor. |
| **`next-themes` over a custom provider** | Battle-tested, supports `system` mode, handles SSR, persists to cookie, ~3KB. Don't reinvent. |
| **Theme toggle in nav, not settings** | Settings is for "I changed my mind forever". Nav toggle is "I want it different right now". Both matter; nav is faster. |
| **Hermes as a model provider, not a persona** | A persona is a system prompt overlay. A model provider is the actual LLM. Hermes is both (Nous Research ships the model + a tool-calling harness), but the more useful product framing is "you can use Hermes instead of Gemini". |
| **OpenClaw as a runtime, not a persona** | OpenClaw is an execution daemon (`localhost:18789`). The cleanest fit is `EXECUTION_SERVICE_PROVIDER=openclaw` in the runtime switch. |
| **Tauri over Electron** | Already chosen. Don't second-guess. Tauri v2 has tray, global shortcut, file dialog, clipboard, notifications, updater — everything you need. |
| **Capacitor over React Native for mobile** | Same web code, native shell, App Store + Play Store. React Native would mean rewriting the chat. Don't. |
| **Self-signed Windows cert first, EV later** | $300/yr is a lot when you have 0 users. Self-signed has a SmartScreen warning; users click through. Migrate to EV when you have paying customers. |
| **No auto-update in the first release** | Auto-update via Tauri updater + GitHub Releases is a 1-day add, but it requires a release workflow first. Day 12 in the desktop-only plan, not Day 0. |
| **No iOS + Android in the first 17 days** | PWA already gets you 80% of mobile with zero native work. Native App Store / Play Store is a 1-week additional push once the PWA feels right. |

---

## 5. "Like MiniMax Agent" acceptance test

After Day 17, this should be true:

| Check | Target |
|---|---|
| A new user can open `https://quill-ai-xi.vercel.app` and see a 100ms home with one centered input | True |
| Toggling theme persists across reloads | True |
| System preference wins on first visit | True |
| The chat page is 3 elements: nav, scrollback, composer | True |
| The Canvas panel only opens on demand | True |
| Selecting "Hermes" in the mode picker routes to `${HERMES_BASE_URL}/v1/chat/completions` | True (when env set) |
| Quota tracking (`usage_daily`) records Hermes requests the same as Gemini | True |
| A Hermes instance with `hermes-skill/SKILL.md` installed can `list_missions` against the live Quill | True |
| A user with `OPENCLAW_GATEWAY_URL` set can choose "OpenClaw" as their execution runtime | True |
| `/api/agent/delegate` with `agent=openclaw` POSTs to `${OPENCLAW_GATEWAY_URL}/sessions/send` | True |
| A Windows MSI exists at `desktop/src-tauri/target/release/bundle/msi/Quill_1.0.0_x64_en-US.msi` | True (after Day 10) |
| The MSI installs, registers Add/Remove Programs entry, and launches | True |
| `npm run test:ci` is green | Always |

---

## 6. Environment + commands

### Required env (`.env.local` — never commit)
```
DATABASE_URL=
BETTER_AUTH_SECRET=                          # openssl rand -base64 48
BETTER_AUTH_URL=
GOOGLE_GENERATIVE_AI_API_KEY=

# Optional model routing
OPENROUTER_API_KEY=
AI_GATEWAY_API_KEY=
AI_GATEWAY_BASE_URL=https://ai-gateway.vercel.sh/v1
AI_GATEWAY_MODEL_PREFIX=openrouter/

# CLI / desktop
QUILL_CLI_KEY=

# Operational safety
ALLOW_INMEMORY_RATELIMIT_FALLBACK=           # keep disabled in production
ENABLE_IN_MEMORY_METRICS=                    # disabled in production

# Hermes (Plan 3, Day 10)
HERMES_BASE_URL=                             # e.g. http://localhost:8080/v1
HERMES_API_KEY=                              # optional

# OpenClaw (Plan 3, Day 13)
OPENCLAW_GATEWAY_URL=http://localhost:18789
OPENCLAW_GATEWAY_TOKEN=                      # optional
```

### Commands you will use every day
```bash
npm run dev              # next dev
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm run build            # next build
npm run test             # vitest
npm run test:ci          # smoke + auth + rag + autopilot-cron + chatbot + agent-remediation + contracts
npm run test:chatbot
npm run test:agent-remediation
npm run test:stripe
npm run audit:ui-standards
npm run guardrails:check
npm run bundle:check     # bundle budget
```

### Tauri commands
```bash
cd desktop
npm run dev              # tauri dev
npm run build            # tauri build → MSI + NSIS
npm run icons            # node ../scripts/desktop-icons.mjs
```

### Capacitor commands (Day 13+)
```bash
npx cap add ios
npx cap add android
npx cap sync             # after web build
npx cap open ios         # opens Xcode
npx cap open android     # opens Android Studio
```

---

## 7. Key file paths (cheat sheet)

| Concern | Path |
|---|---|
| App metadata + PWA tags | `src/app/layout.tsx` |
| Tailwind config | `tailwind.config.cjs` |
| Global CSS + design tokens | `src/app/globals.css` |
| Root provider | `src/components/Providers.tsx` |
| Home page | `src/app/page.tsx` |
| Marketing surface (new) | `src/app/about/page.tsx` |
| Chat page | `src/app/agent/page.tsx` |
| Composer (TaskInput) | `src/components/agent/TaskInput.tsx` |
| Sidebar | `src/components/layout/Sidebar.tsx` |
| Right rail (delete) | `src/components/layout/SecondaryRightRail.tsx` |
| Account menu | `src/components/layout/AccountMenu.tsx` |
| Device detection | `src/components/DeviceAwareness.tsx` |
| PWA manifest | `src/app/manifest.ts` |
| Model selection | `src/lib/chat/model-selection.ts` |
| Request utils | `src/lib/chat/request-utils.ts` |
| Chat route | `src/app/api/chat/route.ts` |
| Execution service | `src/lib/execution/service.ts` |
| Delegate route | `src/app/api/agent/delegate/route.ts` |
| MCP route | `src/app/api/agent/mcp/route.ts` |
| Ingest route | `src/app/api/missions/ingest/route.ts` |
| Missions page | `src/app/missions/page.tsx` |
| Hermes SKILL | `src/lib/integrations/hermes-skill/SKILL.md` |
| OpenClaw SKILL | `src/lib/integrations/openclaw-skill/SKILL.md` |
| Killers (personas) | `src/lib/ai/killers.ts` |
| Tauri config | `desktop/src-tauri/tauri.conf.json` |
| Tauri Rust | `desktop/src-tauri/src/lib.rs` |
| Tauri Cargo | `desktop/src-tauri/Cargo.toml` |
| Tauri capabilities | `desktop/src-tauri/capabilities/default.json` |
| ADRs | `docs/decisions/000-…010-*.md` |
| 30-day remediation | `REMEDIATION_PLAN_30D.md` |
| 14-day GTM | `launch/GTM_14_DAY_CALENDAR.md` |
| Memory bank | `.agents/memory-bank/{brief,product,architecture,tech,context}.md` |

---

## 8. What's explicitly OUT OF SCOPE

Do not add these in the first 17 days. They are scope creep:

- ❌ New AI modes (you have 3; that's already 2 more than MiniMax)
- ❌ New killer personas (you have 5)
- ❌ Custom theme color picker (System / Light / Dark is enough)
- ❌ Native iOS / Android App Store / Play Store submission (PWA first, native Month 2)
- ❌ EV code-signing cert (self-signed first, EV when you have paying users)
- ❌ Real-time collaboration / multiplayer chat
- ❌ Voice input / output (Whisper + TTS)
- ❌ Image generation beyond what `generate-image` already does
- ❌ Mission automation (`/autopilot` exists; not in this plan)
- ❌ Runtimes marketplace (`/runtimes` exists; not in this plan)
- ❌ Templates marketplace (`/templates` exists; not in this plan)
- ❌ Skills marketplace UI (`/skills` exists; SKILL.md downloader only)
- ❌ Stripe Customer Portal (the Stripe subscription flow already works; not in scope)
- ❌ macOS .dmg / Linux AppImage (Windows is the explicit ask)
- ❌ Tauri auto-update in v1.0 (release workflow first, updater in 1.1)
- ❌ Observability dashboards beyond `daily-cost-report.js`

---

## 9. Open questions (ask the user, don't guess)

1. **Does the user have a Hermes instance ready?** If not, gate Hermes behind `HERMES_BASE_URL` env so it doesn't break Pro users on Gemini. Same for OpenClaw.
2. **Apple Developer account ($99/yr) confirmed?** Required before any Capacitor iOS work. Without it, simulator only.
3. **Code-signing cert available?** If yes, use it. If no, self-signed is fine.
4. **Hosting for the staging branch?** Vercel auto-deploys on push. If you want `staging.quill-ai-xi.vercel.app` as a preview URL, add a Vercel project branch rule.
5. **Brand color confirmation.** The current accent is `#EF4444` (red). MiniMax uses red. Keep it.
6. **Mission Control / `/missions` UI** — keep, hide, or delete? It's the inbox for inbound sessions from Hermes/OpenClaw. If you keep it, add an empty-state explaining what it is.
7. **Pricing tiers.** The site has `/pricing` and Stripe is wired, but the visible pricing page wasn't in the files I read. Confirm the Pro tier is $5/mo (per the `FREEMIUM_MODEL.md` in the Apex repo).
8. **Email capture.** Where do waitlist emails go? Resend? ConvertKit? Loops? Decide before Day 5 of the GTM calendar.

---

## 10. Source-of-truth pointers

Everything in this brief is derived from these files I read directly in the source session:

- `tovrr/quill-ai` (current `main` at 9a1e3e11)
- `tovrr/Apex_LLM` (current `main` at April 17 2026)
- `tovrr/benchmarkmd`, `tovrr/flight-kiosk-widget`, `tovrr/xZen-Bot`

The original GitHub PAT scope was admin on `tovrr/quill-ai`. If you start a new session, set `GITHUB_PAT_TOKEN` in your env and the same scope of read access works.

---

## 11. Definition of done (for this handoff)

This brief is done when:
- ✅ A new session/agent can read this file + the listed paths and start Day 1 of the 17-day plan without asking the user any clarifying question that is already answered here.
- ✅ The MiniMax-style, Hermes, OpenClaw, theme, and desktop plans are all referenced and indexed (not duplicated in full).
- ✅ The acceptance test, the out-of-scope list, and the open-questions list are all present.
- ✅ The file is committed on the `handoff/2026-08-02-quill-ai-context` branch off `staging` and merged to `staging` when the user approves the PR.
