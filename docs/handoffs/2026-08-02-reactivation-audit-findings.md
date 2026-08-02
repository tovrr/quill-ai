# Quill AI — Reactivation Audit Findings (2026-08-02)

**Author:** Hermes (estate boss agent)
**Context:** First pass after ~4 months dormant (last `main` commit 2026-04-23). This is a
findings/status doc only — no code, config, or dependency changes in this PR.

---

## 1. Git / repo state

- `main` last commit: `9a1e3e1` (2026-04-23, security scrub — CSP nonce middleware, CORS).
- `staging` is 1 PR ahead of that (PR #3, handoff brief, merged 2026-08-02).
- Stale branches present: `main-backup-`, `release/quill-apex-mobile-mcp-2026-04-18` (already
  merged, safe to delete once confirmed unused elsewhere).
- **`repo-backup-before-scrub.bundle`** (1.3MB, 198 commits) is still tracked in git on
  `staging`, left over from the April history-scrub operation. Cloned it and grepped the full
  pre-scrub history for leaked secrets (`STRIPE_SECRET_KEY`, `BETTER_AUTH_SECRET`,
  `GOOGLE_GENERATIVE_AI_API_KEY`, `sk-` patterns): **none found** — only env var *names*
  referenced in code diffs, no actual key values. GitHub secret-scanning alerts: empty (`[]`).
  **Recommendation:** drop the bundle from git (or move to an out-of-repo archive) — it's dead
  weight with no remaining forensic value now that the leak risk is ruled out.

## 2. CI status — currently broken, confirmed pre-existing (not caused by PR #3)

3 of the repo's 8 workflows are red on `main` (last run 2026-04-23). On `staging`-targeted
PRs, only 2 of those 3 actually trigger — **CI — AI Rules & Typecheck** is scoped to
`main` only (`on: push/pull_request branches: [main]`) and has never run against a
`staging` PR, including #3 or this one. Confirmed as of 2026-08-02 ~21:30 UTC:

| Workflow | Runs on staging PRs? | Failure | Root cause |
|---|---|---|---|
| **CI Smoke** (build) | Yes | `next build` fails | Both `src/middleware.ts` **and** `src/proxy.ts` exist. Next 16 renamed `middleware` → `proxy` and hard-errors when both are present ("Please use `./src/proxy.ts` only"). |
| **CI Guardrails** (typecheck) | Yes | `tsc --noEmit` — 4 errors | `stripeClient` (`src/lib/stripe/client.ts`) only exports `createCustomer`/`createCheckoutSession`/`createPortalSession`. Call sites in `src/app/api/stripe/webhook/route.ts` (×3) and `src/app/success/page.tsx` (×1) reference `stripeClient.stripe.subscriptions.retrieve(...)` — that `.stripe` property doesn't exist on the exported object. Independently reproduced on this PR's own CI run (`databaseId 30768061438`). |
| **CI — AI Rules & Typecheck** | No (`main`-only trigger) | Same underlying bug when it last ran on `main` (2026-04-23) | Same root cause as CI Guardrails — the two workflows share the same `typecheck` step, just gated on different branches. |

**Vercel build (independent failure, reported separately):** `npm install` fails with
`ERESOLVE` — `@stripe/react-stripe-js@2.8.0` peer-deps `react ^18`, but the project pins
`react ^19.2.3`. Verified `@stripe/react-stripe-js@^4.0.2` supports `react >=16.8.0 <20.0.0`
and is compatible with the already-pinned `@stripe/stripe-js@^4.2.0` — no need to also bump
`stripe-js`.

**Proposed fixes (not applied in this PR):**
1. Delete `src/middleware.ts`, keep `src/proxy.ts` (confirm which has the live logic first).
2. Export the raw `stripe` client instance from `client.ts` (or add the specific
   `subscriptions.retrieve` wrapper the call sites need).
3. Bump `@stripe/react-stripe-js` → `^4.0.2`.

All three are independent and should ship as one `fix/ci-breakage` PR, kept separate from any
dependency-upgrade PR per one-PR-one-scope.

## 3. Dependency / CVE audit

**81 open Dependabot alerts** as of 2026-08-02 ~21:30 UTC (1 auto-dismissed on `ws`, 6 already
fixed historically — those aren't part of the 81; counts are a moving target and will drift
as new advisories publish). Severity breakdown:

| Severity | Count |
|---|---|
| Critical | 4 |
| High | 37 |
| Medium | 27 |
| Low | 6 |

**4 critical alerts:**

| # | Package | GHSA | Summary |
|---|---|---|---|
| 68 | `tar` (transitive) | GHSA-23hp-3jrh-7fpw | Decompression/parse DoS via unlimited input |
| 47 | `better-auth` | GHSA-pw9m-5jxm-xr6h | OAuth refresh-token replay via missing client auth on oidc-provider/mcp plugins |
| 32 | `vitest` | GHSA-5xrq-8626-4rwp | Vitest UI server: arbitrary file read/execute when listening |
| 31 | `vitest` | GHSA-5xrq-8626-4rwp | (duplicate alert, same advisory) |

**Top packages by open-alert count** (concentration, not all equally severe):

| Package | Open alerts |
|---|---|
| `next` | 21 |
| `axios` | 18 |
| `better-auth` | 10 |
| `tar` (transitive) | 6 |
| `brace-expansion` (transitive) | 4 |
| `postcss` | 3 |
| `sharp`, `vite`, `vitest` | 2 each |
| `@babel/core`, `esbuild`, `form-data`, `js-yaml`, `kysely`, `qs` | 1 each |

`axios` is pinned at `1.5.0` (current stable is well past 1.7.x) — most of its 18 alerts are
likely resolved by a single major bump. `better-auth` (auth-critical, live payments product)
carries the one critical + 10 total; upgrading it needs behavior review, not a blind bump —
it's the OAuth/refresh-token layer.

**Proposed approach (not applied in this PR):**
1. `npm audit fix` pass for mechanical/transitive bumps (`tar`, `brace-expansion`, etc.).
2. Direct major-version bump for `axios` (low review risk, isolated usage).
3. Reviewed bump for `better-auth` (auth-critical — read changelog for the OAuth advisory
   fix, test login flow before merging).
4. `next` — 21 alerts likely cluster around a handful of point releases; bump and re-run
   `test:auth`/`test:smoke` before merging.
5. Keep this as its own PR, after CI is green, never bundled with feature work.

## 4. What's NOT a problem

- No secrets committed or leaked (verified above, both current tree and pre-scrub history).
- `.env*` correctly gitignored; only `.env.example` tracked.
- PR #3 (handoff brief) is accurate and well-scoped — reviewed separately, approved.

## 5. Recommended sequencing

1. This findings PR (informational, no code changes).
2. `fix/ci-breakage` — the 3 CI/build fixes above, verified green in Actions before merge.
3. `fix/dependabot-critical` (or similar) — the 4 critical + highest-count packages, after CI
   is green.
4. Then the 17-day roadmap from `docs/handoffs/2026-08-02-quill-ai-implementation-brief.md`.
5. Separately: decide fate of `repo-backup-before-scrub.bundle` and stale branches.
