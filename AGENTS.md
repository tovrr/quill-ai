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

After completing the user's request, update the relevant memory bank files:

- `.kilocode/rules/memory-bank/context.md` - Current state and recent changes
- Other memory bank files as needed when architecture, tech stack, or project goals change
