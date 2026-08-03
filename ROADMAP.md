# Quill AI — Roadmap

**Last consolidated:** 2026-08-03
**Supersedes:** `docs/handoffs/2026-08-02-quill-ai-implementation-brief.md` (17-day plan),
the "Quill Parity" / "Builder Roadmap" / "Next 7 Execution Targets" sections of the old
`TODOS.md`, and `docs/archive/2026-04-audits/REMEDIATION_PLAN_30D.md`. Those documents are
kept for historical reference in `docs/archive/`; **this file is the live source of truth**
going forward. See `TODOS.md` for the flat, checkable task list derived from this roadmap.

**Golden rule (same as AGENTS.md):** verify every claim in this doc against actual code and
`git log` before acting on it — this file will drift too if nobody keeps it honest.

---

## 0. Where the product actually is (verified 2026-08-03)

- **Live:** https://quill-ai-xi.vercel.app — reactivated after ~4 months dormant (last commit
  before reactivation: 2026-04-23).
- **CI:** green (`smoke`, `guardrails`, `ai-rules-and-typecheck`, `enforce`,
  `prompts-examples`, `Vercel` — all passing as of PR #10).
- **CVEs:** critical/high count brought down significantly (PR #7); `next` still needs a real
  version bump (see Track A below — a prior claim that it "auto-resolved" was wrong, verify
  before trusting the old PR #7 description on this point).
- **Stack:** Next.js 16 (App Router) + React 19 + Tailwind 4, Vercel AI SDK 6, Neon Postgres +
  Drizzle, Better Auth, Stripe. Deployed on Vercel.
- **Theme system:** exists (`next-themes`, light/dark tokens in `globals.css`) but is
  **incomplete** — verified 14+ files still use hardcoded dark colors (`bg-[#0d0d15]` etc.)
  instead of theme tokens, including `pricing`, `docs`, `agent`, `login` pages and
  `Sidebar.tsx` itself. This is why light mode currently looks broken/mixed.
  See Track B, Day 1.
- **UI primitive layer:** hand-rolled, NOT shadcn/ui (no `components.json`, CLI never
  initialized) and NOT Vercel AI Elements (never adopted). `src/components/ui/` uses the same
  underlying pattern (Radix + CVA + `cn()`) but was built by hand, file by file. This is the
  single biggest reason the UI has been inconsistent and slow to extend.
- **Sidebar:** 1192 lines, single file, 4+ navigation groups (Primary Workspace / Explore /
  Agent Gateway / Artifact Groups) plus multiple shortcut sub-lists. This is the opposite of
  the "MiniMax-style minimal nav" goal that was agreed on 2026-08-02 and has not been touched
  since.
- **Code generation:** real and functional — two-pass builder pattern
  (`src/lib/chat/two-pass-builder.ts`, draft → critic-prompt quality pass), artifact
  validation (`analyzeArtifactQuality`, `validateGeneratedModule`), execution service
  abstraction (`src/lib/execution/service.ts`: Docker local / E2B / Modal / custom).
- **GitHub integration for generated code:** does NOT exist. Generated code can only be (a)
  previewed live in the Canvas panel, or (b) downloaded as a ZIP (`/api/export/zip`, JSZip).
  There is no push-to-repo, branch creation, PR creation, or merge capability. The only
  GitHub-related surface is a third-party "GitHub MCP" entry in the MCP registry that a user
  could optionally connect — Quill itself has no native write access to GitHub.
- **Hermes/OpenClaw integration:** partially wired, not functional end-to-end. Inbound works
  (`hermes-skill/SKILL.md`, `openclaw-skill/SKILL.md`, `/api/missions/ingest`). Outbound
  exists as code (`/api/agent/delegate/route.ts` correctly POSTs to
  `{HERMES_BASE_URL|OPENCLAW_GATEWAY_URL}/sessions/send`) but is dead in practice: no env vars
  set, Hermes is not in `src/lib/chat/model-selection.ts` as a provider, `AGENT_SOURCES` in
  `TaskInput.tsx` lists `openclaw`/`hermes` as dropdown options that do nothing when selected.

## 1. The original ask vs. what's landed (drift check)

The 2026-08-02 session agreed on 4 workstreams. Status as of this consolidation:

| Workstream | Agreed scope | Status |
|---|---|---|
| **Fix CI/CVEs first** | Not explicitly one of the 4, but correctly prioritized ahead of them once CI was found broken | ✅ Done (PRs #5, #7, #9, #10) |
| **1. MiniMax-style interface** | Minimal home, 3-panel chat, hide sidebar by default, kill marketing from home page | ❌ Not started. Sidebar untouched, home page still full marketing surface, no `/about` split |
| **2. Light + dark theme** | Token system, `next-themes`, toggle, `Cmd/Ctrl+Shift+L` | 🟡 Infra shipped (PR #6, "Days 1-4"), but incomplete — 14+ files never migrated off hardcoded colors. Visibly broken in production right now. |
| **3. Real Hermes + OpenClaw integrations** | Hermes as model provider, OpenClaw as execution runtime, working `/api/agent/delegate` | ❌ Not started (code scaffolding exists from before this session, unchanged) |
| **Bonus: Desktop + Windows + Mobile** | Tauri polish, MSI installer, then Capacitor | ❌ Not started (Tauri shell exists, untouched) |

**Verdict: partial drift, not total.** The CI/CVE emergency work was the right call — an
unstable base makes everything downstream unreliable — but it consumed the entire session and
none of the 4 original workstreams shipped end-to-end. Workstream 2 (theme) is the most
concerning: it shipped *visibly incomplete*, which reads as a regression to anyone opening the
app in light mode today. That should be priority zero before touching anything else new.

## 2. Roadmap — 4 tracks, in priority order

### Track A — Finish what's broken/incomplete (do this first, days 1-3)

Nothing new ships until these are closed. This is cleanup of in-flight work, not new scope.

1. **Theme completeness pass** — migrate the remaining hardcoded-dark files to theme tokens:
   `src/app/pricing/page.tsx`, `src/app/docs/page.tsx`, `src/app/agent/page.tsx`,
   `src/app/login/page.tsx`, `src/app/settings/page.tsx`, `src/app/success/page.tsx`,
   `src/app/share/[chatId]/page.tsx`, `src/app/admin/analytics/page.tsx`,
   `src/app/admin/sandbox-monitoring/page.tsx`, `src/components/layout/Sidebar.tsx`,
   `src/components/agent/{AgentStatusBar,CanvasPanel,RealMessageBubble}.tsx`,
   `src/components/ui/SettingsModal.tsx`. Grep for `bg-\[#` / `text-\[#` / hardcoded hex to
   find any stragglers before calling this done.
2. **Verify theme toggle is mounted everywhere it should be** — currently only confirmed in
   the home page nav; check `/agent`, `/pricing`, `/docs`, `/login` etc.
3. **Real `next` CVE bump** — package.json still pins an old range; the prior "already
   resolved" claim in PR #7 was checked and found wrong post-merge. Bump for real, verify the
   Dependabot alert count actually drops after merge (not just locally).
4. **Post-mortem the CSP/deploy incident properly** — two things went wrong beyond the code
   bugs themselves: (a) PR #9 merged to `main` but never auto-triggered a Vercel Production
   deploy (`vercel-api-deploy.yml` is `workflow_dispatch`-only, not wired to `push: [main]`) —
   fix this so "merged but not deployed" can't silently recur; (b) get a real post-deploy
   smoke check into CI or a manual runbook step (curl the live CSP header, confirm
   `script-src` directive is present) so a malformed CSP string doesn't reach users again
   before someone notices visually.

### Track B — MiniMax-style interface (the actual original ask, days 4-10)

This is Workstream 1 + the un-shipped parts of Workstream 2, done together since they touch
the same surfaces.

1. **Home page rewrite** — minimal: nav + centered input, MiniMax.io reference. Move the
   marketing surface (feature grid, testimonials, etc.) to `/about`.
2. **Sidebar rewrite** — from 1192 lines / 4+ groups down to what MiniMax actually shows:
   recent chats, a couple of top-level links, nothing else by default. Slide-in on demand,
   not a permanent column. This is the single highest-leverage UI change available — it's
   also the thing most likely to fix the "sidebar broken/confusing" feedback, independent of
   the CSP bug that was also in play.
3. **`/agent` page strip-down** — 3 panels: nav / scrollback / composer. No killer selector in
   the default composer (5 killers exist; that's already more than MiniMax shows — move to
   `/personas`, don't remove).
4. **Consider adopting shadcn/ui or Vercel AI Elements for the chat surface specifically** —
   not a full rewrite of the existing hand-rolled `src/components/ui/`, but evaluate whether
   swapping the *chat-specific* components (`MessageBubble`, `ChatWindow`, `ToolCallCard`) for
   AI Elements' equivalents would reduce the maintenance burden and prevent the kind of
   partial-migration drift that caused the theme bug in Track A. AI Elements is shadcn-based
   and already ships with `next-themes`-compatible tokens — likely a faster path to visual
   consistency than continuing to hand-write every surface. This needs an explicit decision,
   not a silent default — flag to the user before starting.
5. **Mode picker as a pill**, not a prominent selector — per the original brief.

### Track C — Real agent integrations (days 11-15)

1. **Hermes as a model provider** — `src/lib/models/hermes.ts` (new), wire into
   `src/lib/chat/model-selection.ts`, propagate through `request-utils.ts`, route in
   `src/app/api/chat/route.ts`. Gate behind `HERMES_BASE_URL` so unset stays a no-op, doesn't
   break Gemini/OpenRouter users.
2. **OpenClaw as an execution runtime** — add a branch in `src/lib/execution/service.ts`,
   harden `src/app/api/agent/delegate/route.ts` (code already correct, just untested live),
   settings page radio to pick execution runtime.
3. **GitHub publish capability (new scope, wasn't in the original 4 workstreams — flag before
   starting)** — if the goal is "generated code can go straight to a GitHub repo, open a PR,
   and merge," that's a meaningfully new capability, not a bug fix. Needs: GitHub App or PAT
   auth flow, a repo-picker UI, a "push to branch + open PR" action off the Canvas panel, and
   real authorization scoping (a user should never have Quill silently pushing to `main`).
   This is easily a multi-day track on its own — don't fold it into Track B's ZIP export as a
   quick add-on.

### Track D — Desktop + mobile (deferred, weeks 3-4+)

Unchanged from the original brief — Tauri polish (menu, hotkeys, command palette, custom
title bar), Windows MSI + self-signed cert, auto-update via GitHub Releases, then Capacitor
for iOS/Android once the PWA itself feels solid. Do not start before Track B ships — a native
shell around a confusing web UI just ships the confusion faster.

## 3. Explicitly out of scope (carried forward from the original brief, still valid)

- New AI modes/personas beyond the existing 5 killers + 3 modes
- Custom theme color picker (System/Light/Dark is enough)
- Native iOS/Android store submission before the PWA is solid
- EV code-signing cert (self-signed first)
- Real-time collaboration, voice I/O, image gen beyond what exists
- Mission automation, runtimes marketplace, templates marketplace, skills marketplace UI
  beyond what already exists (`/autopilot`, `/runtimes`, `/templates`, `/skills` all exist —
  not touching their scope, just not expanding it either)
- Stripe Customer Portal changes (already works)

## 4. Open decisions (ask the user, don't guess — carried forward + new)

1. Adopt shadcn/ui or AI Elements for the chat surface, or keep hand-rolling? (Track B.4 —
   new question, significant enough to block on an answer before Track B starts)
2. GitHub publish capability — is this actually wanted, and if so, what's the trust model?
   (push directly vs. always-PR, which repos, whose GitHub identity) (Track C.3 — new)
3. Does the user have a live Hermes instance ready to test against? Same question for
   OpenClaw. (carried forward, still unanswered)
4. Apple Developer account confirmed for Capacitor iOS work? (carried forward, still open,
   not urgent — Track D is deferred)
5. Mission Control / `/missions` UI — keep, hide, or delete? (carried forward, still open)
6. Pricing tiers — confirm Pro tier price point matches what's actually live in Stripe.
   (carried forward)
7. Email capture backend for the (currently archived) launch/GTM content — Resend? ConvertKit?
   Not urgent since launch content is archived until Track B ships, but decide before
   un-archiving it. (carried forward)

## 5. Definition of done for "ready to actually launch"

Not close yet — listing so it's clear how far Track B + C need to go:

- [ ] Light and dark mode both look intentional on every page, not just home
- [ ] Sidebar is minimal, matches the MiniMax reference
- [ ] Home page is chat-first, marketing moved to `/about`
- [ ] At least one of Hermes/OpenClaw actually works end-to-end in a live test, not just code
      that compiles
- [ ] `README.md` demo GIF is real (currently a placeholder per the old TODOS)
- [ ] `docs/archive/2026-launch-prep/` content gets reviewed and un-archived deliberately,
      not launched on autopilot from 4-month-old drafts
