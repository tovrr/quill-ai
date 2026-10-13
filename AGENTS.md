# AGENTS

Rules for any AI agent working on this repository. **This file is the source**: `CLAUDE.md` and
`.cursorrules` are generated from it by `npm run gen:ai-rules` (the pre-commit hook runs it).
Edit this file only, then regenerate; never edit the two copies by hand.

Docs drift. Check every claim here against the code and `git log` before acting on it; if the
code disagrees, the code is right and this file needs a fix.

## Next.js 16 — do not write from memory

This project uses **Next.js 16** (React 19, Tailwind 4). Most training data covers Next.js
13 to 15. Do not generate code from older assumptions for:

- the request proxy: this repo uses `src/proxy.ts`, which replaces the deprecated `middleware.ts`
- proxy / rewrites in `next.config.ts`
- `next/headers`, `next/cookies`, async request APIs
- API routes (`route.ts`, App Router only; there is no `pages/api/`)
- Turbopack-specific behaviour
- metadata / viewport export signatures

Read the existing files in this repo for the pattern in use before writing new code.

## Git and release

- Branch from `main`, open a pull request into `main`. Never push to `main`, never merge your
  own pull request: the owner merges.
- One pull request, one concern. No opportunistic refactor of unrelated code.
- The app is hosted on Vercel and `main` is the release branch: treat a merge as a production
  release. `vercel.json` schedules `/api/autopilot/cron` daily.
- An agent does not deploy, does not run the manual Vercel workflows
  (`.github/workflows/*vercel*.yml`), and does not run `npm run db:push` or a migration against
  a real database. Those are the owner's.

## Payments and secrets

- Stripe is wired for real: `src/app/api/stripe/checkout`, `portal` and `webhook`. Do not change
  the webhook signature check, the price variables (`STRIPE_PRICE_ID_PRO`,
  `STRIPE_PRICE_ID_TEAM`) or what a paid plan unlocks (`src/lib/chat/access-gates.ts`) unless
  the task is about exactly that, and say so at the top of the pull request.
- Never commit, print or paste a secret value; name the variable. Never put customer data
  (e-mails, chats, files) in a log, a pull request or a chat.

## Quality gates before you finish

| Change | Run |
|---|---|
| Auth, payments, data model, chat access rules, security, anything production-critical | `npm run guardrails:check`, `npm run typecheck`, `npm run lint`, `npm run build` |
| Ordinary feature or bug fix | `npm run guardrails:check`, `npm run typecheck` |
| Throwaway experiment that will not be merged as is | `npm run guardrails:check` |

When in doubt, use the first row. CI runs on every pull request: guardrails with typecheck,
lint and build (`ci-guardrails.yml`), the generated rule files with typecheck
(`ci-ai-rules.yml`), a build with the bundle budget and the smoke scripts (`ci-smoke.yml`), the
UI standards check, and the prompt examples. Unit tests are Vitest: run them once with
`npx vitest run` (`npm test` alone stays in watch mode). Report what you ran and what you did not.

Non-negotiable:

1. Do not modify `node_modules/`.
2. `postcss.config.mjs`, `next.config.ts`, `package.json` and `src/app/globals.css` are
   high-risk: change them only when the task requires it. `guardrails:check` asserts part of
   the content of the first, third and fourth.
3. Remove temporary debug hooks and scripts before you finish.

## Builder behaviour (artifact discipline)

For app-builder requests handled by this product:

1. Return the typed artifact envelope first (`<quill-artifact>...</quill-artifact>`), before
   any optional explanation.
2. Respect the builder target (`auto`, `page`, `react-app`, `nextjs-bundle`); do not drift
   between output formats.
3. Prefer complete runnable output over partial snippets for `react-app` and `nextjs-bundle`.
4. For `nextjs-bundle`, generate App Router structures (no `pages/api`) with realistic files.
5. Preserve active iteration locks (layout, colours, section order, copy) unless the user asks
   for a change.

## Chat backend: keep the modules

`src/app/api/chat/route.ts` orchestrates, in this order: parse, runtime, access, build, stream.
The logic lives in `src/lib/chat/`:

| Module | Holds |
|---|---|
| `request-utils.ts` | request parsing and validation, message extraction, last-user helpers |
| `model-selection.ts` | `ChatMode`, daily limits per mode, provider and model resolution |
| `access-gates.ts` | entitlement and quota enforcement, guest restrictions, paid-tier and web-search gates |
| `policy-runtime.ts` | policy and permission decisions, sandbox status, `canRunCode`, warnings |
| `two-pass-builder.ts` | two-pass builder orchestration and persistence |
| `token-budgets.ts` | per-tier token budgets and usage stats (`checkTokenBudget`) |

Put new logic in the matching module. A direct edit of `route.ts` is fine for a one-line
correction or an urgent fix; not for a new feature or a refactor. Read `route.ts` and the
module before changing either.

## Other pointers

- Feature recipes: `.kilocode/recipes/` (today: `add-database.md`). Read the recipe when the
  user asks for that feature.
- The `quill` CLI (`cli/index.mjs`, `npm run cli`) has modes `fast|thinking|advanced` and a
  `--tier critical|quick|experimental` option; `npm run test:cli` covers it.
- Record a change in the project notes (`BRAIN.md`, `ARCHITECTURE.md`) only when it changes
  the architecture, adds a system capability or breaks an external interface.
