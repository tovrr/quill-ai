# Development Rules

## ⚠️ HALLUCINATION RISK — Next.js 16

This project uses **Next.js 16**, which is newer than most AI training data. Many AI-generated code suggestions will silently use outdated or incorrect patterns from Next.js 13/14/15. **Always verify against the actual codebase** before applying any suggestion involving:

- **Middleware** (`middleware.ts`) — the `NextRequest`/`NextResponse` API and matcher config changed. Do NOT assume patterns from older versions.
- **Proxy / rewrites** — `next.config.ts` rewrite syntax and edge runtime behavior differ. Do NOT copy patterns from community tutorials without checking the actual Next.js 16 changelog.
- **API Routes** — still use `route.ts` App Router convention; older `pages/api/` patterns are invalid here.
- **`next/headers`**, **`next/cookies`**, **`cookies()`** — async in Next.js 15+; may have changed again in 16.
- **Turbopack** — used in dev (`next dev --turbopack`); some plugins/loaders behave differently.
- **`generateMetadata`**, **`viewport` export** — export conventions shifted between 14→15→16.

**Rule**: if you are not certain a pattern applies to Next.js 16 specifically, check `next.config.ts`, the existing route files, and the official changelog before writing code.

---

## Critical Rules

- **Package manager**: Use `npm`
- **Never run** destructive git commands (`reset --hard`, forced checkout of files) unless explicitly requested
- **Always commit and push** after completing changes:

  ```bash
  npm run typecheck && npm run lint && git add -A && git commit -m "descriptive message" && git push
  ```

## Commands

- `npm install`: Install dependencies
- `npm run build`: Build production app
- `npm run lint`: Check code quality
- `npm run typecheck`: Type checking

## Best Practices

### React/Next.js

- Use Server Components by default; add `"use client"` only when needed
- Use `next/image` for optimized images
- Use `next/link` for client-side navigation
- Use `error.tsx` for error boundaries
- Use `not-found.tsx` for 404 pages

### API Routes

- Return `NextResponse.json({ error: "..." }, { status: 500 })` on failure
- Always include appropriate status codes
- Handle errors gracefully

### Code Quality

- Run `npm run typecheck` before committing
- Run `npm run lint` before committing
- Write descriptive commit messages
