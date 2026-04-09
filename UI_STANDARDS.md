# UI Standards (Phase 0 Guardrails)

This repository is under active UI standardization.

## Scope

The current guardrails enforce a no-regression policy while migration is in progress:

- Icon packages:
  - Allowed: `@heroicons/react/<16|20|24>/<solid|outline>`
  - Disallowed: `lucide-react`, `@radix-ui/react-icons`
- Inline SVG in `src`:
  - Disallowed by default
  - Temporary allowlist: `src/components/ui/QuillLogo.tsx`
- Raw primitives in `src`:
  - `button`, `input`, `select`, `textarea`, `details`, `summary`
  - Internal primitives are allowlisted in `scripts/ui-standards.mjs` under `RAW_PRIMITIVE_ALLOWLIST`
  - Existing debt is tracked in baseline and cannot increase

## Phase 1 Primitive Layer

Shared primitives now live in `src/components/ui/` and should be preferred over ad hoc controls in feature components.

- `button.tsx`
- `input.tsx`
- `textarea.tsx`
- `dialog.tsx`
- `select.tsx`
- `switch.tsx`
- `card.tsx`
- `badge.tsx`
- `sheet.tsx`
- `dropdown-menu.tsx`
- `tabs.tsx`
- `separator.tsx`
- `scroll-area.tsx`
- `collapsible.tsx`
- `tooltip.tsx`

## Commands

- Audit and update baseline: `node scripts/ui-standards.mjs audit --update-baseline --write-report`
- Audit report only: `npm run audit:ui-standards`
- Enforce in CI: `npm run enforce:ui-standards`

## Baseline Artifacts

- Baseline data: `.ui-standards-baseline.json`
- Human report: `UI_STANDARDS_BASELINE.md`

## Update Protocol

Only update the baseline artifacts when intentionally paying down or explicitly accepting debt changes in a reviewed PR.
