# AGENTS

## ⚠️ HALLUCINATION RISK — Next.js 16

This project uses **Next.js 16**. Most AI training data covers Next.js 13/14/15. Do NOT generate code based on older version assumptions for:

- `middleware.ts` patterns and matchers
- Proxy / rewrites in `next.config.ts`
- `next/headers`, `next/cookies`, async APIs
- API route conventions (`route.ts` App Router only — no `pages/api/`)
- Turbopack-specific behavior
- Metadata / viewport export signatures

Always read the existing files in this repo to understand the actual patterns in use before writing new code.

---

## Regression Guardrails (AI Agent)

Before finishing any coding task, run and pass:

1. `npm run guardrails:check`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run build`

Additional non-negotiable rules:

1. Do not modify `node_modules/`.
2. Treat `postcss.config.mjs`, `next.config.ts`, `package.json`, and `src/app/globals.css` as high-risk files; change only when directly required by the task.
3. Keep AI edits narrowly scoped to requested files/feature; avoid opportunistic refactors in unrelated areas.
4. Temporary debug hooks/scripts must be removed before completion.

---

## Builder Behavior (Artifact Discipline)

For app-builder requests in this repository:

1. Always return typed artifact envelopes first (`<quill-artifact>...</quill-artifact>`) before any optional explanation text.
2. Respect builder targets explicitly (`auto`, `page`, `react-app`, `nextjs-bundle`) and do not drift between output formats.
3. Prefer complete runnable outputs over partial snippets for `react-app` and `nextjs-bundle` targets.
4. For `nextjs-bundle`, generate export-first App Router structures (no `pages/api`) and include realistic project files.
5. Preserve active iteration locks (layout/colors/section order/copy) unless user explicitly requests changes.

---

## Chat Backend Guardrails (Anti-Hallucination)

The chat backend was intentionally decomposed from one large route into focused modules. Do not re-inline these responsibilities into `src/app/api/chat/route.ts`.

Current module boundaries:

1. `src/lib/chat/request-utils.ts`
   - Request parsing/validation (`parseChatRequestBody`)
   - Message extraction/normalization (`extractModelMessages`, `extractTextMessages`)
   - Last-user helpers (`summarizeLastUserInput`, `getLastUserParts`)
2. `src/lib/chat/model-selection.ts`
   - Mode typing (`ChatMode`)
   - Daily mode limits (`getDailyLimitForMode`)
   - Provider/model resolution (`resolveModelForMode`)
3. `src/lib/chat/access-gates.ts`
   - Entitlement and quota enforcement (`evaluateChatAccess`)
   - Guest-mode restrictions, paid-tier checks, web search gates
4. `src/lib/chat/policy-runtime.ts`
   - Killer policy/runtime derivation (`evaluatePolicyRuntime`)
   - Permission decisions, sandbox status, `canRunCode`, policy warnings
5. `src/lib/chat/two-pass-builder.ts`
   - Two-pass builder orchestration and persistence path

Required workflow before modifying chat behavior:

1. Read `src/app/api/chat/route.ts` and the relevant module(s) above before coding.
2. Prefer adding logic to the owning module instead of adding new branches in the route.
3. Keep the route orchestration-first: parse -> derive runtime -> enforce access -> build prompt -> stream.
4. Run both `npm run typecheck` and `npm run build` after chat changes.

---

## Optional Feature Guides

When users request features beyond the base template, check for available recipes in `.kilocode/recipes/`.

### Available Recipes

| Recipe       | File                                | When to Use                                           |
| ------------ | ----------------------------------- | ----------------------------------------------------- |
| Add Database | `.kilocode/recipes/add-database.md` | When user needs data persistence (users, posts, etc.) |

### How to Use Recipes

1. Read the recipe file when the user requests the feature
2. Follow the step-by-step instructions
3. Update the memory bank after implementing the feature

## Memory Bank Maintenance

After completing the user's request, update the relevant memory bank files in `.agents/memory-bank/`:

- `.agents/memory-bank/context.md` - Current state and recent changes
- Other memory bank files as needed when architecture, tech stack, or project goals change
