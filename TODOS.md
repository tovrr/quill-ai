# Quill AI — TODOs

**Last consolidated:** 2026-08-03. Flat, checkable task list. For narrative/priority context
see `ROADMAP.md` — this file is the granular checklist version of the same 4 tracks.

**Rules for keeping this file useful (carried forward from the old TODOS.md, still good
advice):**
- Every task: scope + acceptance criteria + where it's verified (local/CI/prod).
- Limit active work-in-progress to ~3 major tasks at a time.
- Link the PR/commit next to a task when it's done; add a one-line outcome note.
- Re-prioritize weekly — stale tasks move down, blockers move up.
- If a task sits untouched for a month, either do it, cut it, or move it to
  `docs/archive/` with a reason. Don't let this file become another `REMEDIATION_PLAN_30D.md`.

---

## Track A — Finish what's broken (do first)

- [ ] Migrate hardcoded-dark colors to theme tokens in: `pricing/page.tsx`, `docs/page.tsx`,
      `agent/page.tsx`, `login/page.tsx`, `settings/page.tsx`, `success/page.tsx`,
      `share/[chatId]/page.tsx`, `admin/analytics/page.tsx`, `admin/sandbox-monitoring/page.tsx`,
      `components/layout/Sidebar.tsx`, `components/agent/{AgentStatusBar,CanvasPanel,RealMessageBubble}.tsx`,
      `components/ui/SettingsModal.tsx`
  - Acceptance: `grep -rn "bg-\[#\|text-\[#" src/` returns zero hardcoded-dark hits outside
    intentional brand-color usages (e.g. the red accent, which is deliberately the same in
    both themes)
  - Verification: manually toggle theme on every route, confirm no page has mixed light/dark
    surfaces
- [ ] Confirm `ThemeToggle` is mounted and reachable from every top-level page, not just home
- [ ] Real `next` version bump to close the remaining Dependabot alerts (prior claim that it
      "auto-resolved" was checked post-merge and found false — package.json still pins the old
      range)
  - Acceptance: `next` alert count is 0 after merge + a real Dependabot rescan (not just local
    `npm ls next`)
- [ ] Wire `vercel-api-deploy.yml` (or Vercel's native GitHub integration) to trigger
      automatically on `push: [main]` so "merged but never deployed" (the PR #9 incident)
      can't recur silently
- [ ] Add a post-deploy smoke step (CI or documented manual step) that curls the live CSP
      header and confirms `script-src` directive is present with a nonce — this exact bug
      class (malformed CSP string) already happened once

## Track B — MiniMax-style interface

- [ ] Rewrite home page (`src/app/page.tsx`): minimal nav + centered input only
- [ ] Create `/about` and move the marketing surface (feature grid, testimonials, deep
      product copy) there from home
- [ ] Rewrite `Sidebar.tsx`: cut from 1192 lines / 4+ nav groups down to recent chats + a
      couple of top-level links. Slide-in, not a permanent column, hidden by default.
- [ ] Strip `/agent` page to 3 elements: nav, scrollback, composer
- [ ] Remove killer selector from the default composer; killers live at `/personas` only
- [ ] Restyle the mode picker (fast/thinking/advanced) as a small pill, not a prominent control
- [ ] **Decision needed before starting:** adopt shadcn/ui or Vercel AI Elements for the chat
      surface (`MessageBubble`, `ChatWindow`, `ToolCallCard`), or keep hand-rolling? Ask the
      user — see `ROADMAP.md` §4.1
- [ ] `Cmd/Ctrl+Shift+L` shortcut — verify still works after nav restructure (already shipped
      in PR #6, just needs re-verification once Sidebar/agent page change)

## Track C — Real agent integrations

- [ ] Add `src/lib/models/hermes.ts`, wire into `src/lib/chat/model-selection.ts`
- [ ] Propagate Hermes selection through `src/lib/chat/request-utils.ts` and
      `src/app/api/chat/route.ts`
- [ ] Gate Hermes behind `HERMES_BASE_URL` (unset = no-op, doesn't affect Gemini/OpenRouter
      users)
- [ ] Add "Hermes" pill option in the mode/provider picker
- [ ] Add OpenClaw branch to `src/lib/execution/service.ts`
- [ ] Harden + live-test `src/app/api/agent/delegate/route.ts` (code exists, never tested
      against a real gateway)
- [ ] Add "Execution Runtime" radio in `/settings` (OpenClaw vs. default)
- [ ] **Decision needed before starting:** does the user have a live Hermes instance and/or
      OpenClaw gateway to test against? See `ROADMAP.md` §4.3
- [ ] **New scope, needs explicit go-ahead:** GitHub publish capability — push generated code
      to a repo, open a PR, merge. Design the auth flow (GitHub App vs PAT), repo-picker UI,
      and authorization boundaries (never silent-push to `main`) before writing any code. See
      `ROADMAP.md` §4.2 and Track C.3.

## Track D — Desktop + mobile (deferred until Track B ships)

- [ ] Tauri: native feel (menu, hotkeys, command palette, custom title bar)
- [ ] Tauri: system theme sync, file system access
- [ ] Windows MSI/NSIS build + self-signed cert (EV cert later, once there are paying users)
- [ ] Auto-update via Tauri updater + GitHub Releases
- [ ] Capacitor: iOS + Android shells once PWA itself is solid
- [ ] `.well-known/assetlinks.json` for Android Trusted Web Activity
- [ ] App store packaging checklist (signing, screenshots, privacy labels)

## Ongoing / not tied to a specific track

These are real, still-open items carried forward from the old `TODOS.md` that don't block any
of the 4 tracks above but shouldn't be lost either. Re-triage into a track or cut when picked
up.

- [ ] External uptime + latency monitoring (Better Stack / UptimeRobot) for `/`, `/agent`,
      `/api/health`, `/api/chat`
- [ ] Bundle analysis in CI with per-route JS/CSS budgets that fail the build on regression
- [ ] Quarterly dependency upgrade routine for Next.js/AI SDK/Auth stack (would have caught
      the 4-month CVE backlog earlier)
- [ ] Service worker + offline fallback for critical routes
- [ ] `partsJson` column for full `UIMessagePart[]` persistence (currently flattened text) —
      images/attachments should be URLs (S3/R2), not data-URLs in the DB
- [ ] Upload guardrails: max file size, max files per message, allowed MIME types (client +
      server validation)
- [ ] Migrate chat identity from `?chat=<id>` query param to `/agent/[chatId]` path segment,
      with backward-compatible redirect for old links
- [ ] Set real pricing env vars in Vercel (currently only set locally) so the admin cost
      dashboard shows real numbers in production
- [ ] Move entitlements from env vars (`PAID_USER_EMAILS`/`PAID_USER_IDS`) to a DB
      billing/subscription table so plan changes don't require a redeploy
- [ ] Replace the placeholder demo GIF in `README.md` with a real one before any social
      distribution (launch content is archived in `docs/archive/2026-launch-prep/` until
      Track B ships — don't un-archive it on autopilot)

## Recently completed (for context, not action)

- [x] CI fully green — PRs #5, #9, #10 (Next 16 proxy/middleware fix, missing Stripe client
      accessor, CSP nonce restoration, script-src directive bug)
- [x] CVE remediation pass — PR #7 (axios, better-auth, sharp, vitest bumped; `next` still
      needs a real follow-up, see Track A)
- [x] Theme system infrastructure — PR #6 ("Days 1-4"): tokens, `next-themes`, toggle,
      shortcut, PWA manifest. Incomplete rollout tracked in Track A.
- [x] Doc cleanup + this roadmap/TODOs consolidation — see `docs/archive/` for what moved
      and why
