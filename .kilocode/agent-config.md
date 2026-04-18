# Kilocode Agent Integration Notes

This file documents how the project integrates with Kilocode agents and where to find recipes.

- Recipes folder: `.kilocode/recipes/` (see repo for available recipes).
- Use the `scripts/gen-ai-rules.mjs` generator to keep AI rule files in sync; Kilocode agents can reference `AGENTS.md`.
- Recommended workflow for Kilocode-enabled runs:
  1. Ensure `AGENTS.md` is up-to-date.
  2. Run `npm run gen:ai-rules` to produce `CLAUDE.md` and `.cursorrules` for local tooling.
  3. Use the `scripts/check-ai-rules.mjs` script in CI to ensure consistency.

Notes:

- Kilocode agents should prefer `AGENTS.md` as the canonical rules source.
- Keep the canonical file concise; offload long reference docs to `docs/` and link to them.
