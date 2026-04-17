# Modularity and File Placement Rules

## Primary Rule
Prefer domain-oriented organization over utility sprawl.

## Library Placement (`src/lib`)
Use these domain folders for backend and shared logic:
- `auth/`
- `chat/`
- `ai/`
- `builder/`
- `execution/`
- `data/`
- `models/`
- `integrations/`
- `extensions/`
- `observability/`

Keep root-level `src/lib/*` minimal (only truly cross-domain helpers).

## Route to Module Pattern
- Route handlers should orchestrate.
- Domain modules should implement behavior.
- Shared policies should live in dedicated policy/gate modules.

## Naming Rules
- Components: PascalCase (`TaskInput.tsx`)
- Utility/logic modules: kebab-case (`policy-runtime.ts`)
- Route files: `route.ts` in App Router folders
- Page files: `page.tsx`

## New Feature Checklist
1. Pick domain folder first.
2. Add module with a single clear responsibility.
3. Keep API route thin and call module functions.
4. Add/update docs when conventions or boundaries change.
5. Run `npm run typecheck` and `npm run build`.

## Anti-Patterns to Avoid
- One giant route file with mixed concerns.
- New top-level `src/lib/*.ts` files for domain logic.
- Re-implementing auth/rate-limit/observability per route.
- Coupling UI state rules directly into backend modules.
