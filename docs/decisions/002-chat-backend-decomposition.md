# ADR 002: Decompose Chat Backend into Focused Modules

## Status
Accepted

## Date
2026-04-17

## Context
`/api/chat` became a god-route and was difficult to reason about, review, and extend safely.

## Decision
Keep route orchestration in `src/app/api/chat/route.ts` and delegate responsibilities to dedicated modules:
- `request-utils.ts`
- `model-selection.ts`
- `access-gates.ts`
- `policy-runtime.ts`
- `two-pass-builder.ts`

## Alternatives Considered
- Keep all logic in one route file
- Split by provider only

## Consequences
### Positive
- Clear ownership boundaries
- Safer incremental changes
- Better testability and code review clarity

### Negative
- More files to navigate
- Requires discipline to avoid regression back to god-route style

## Notes
Documented in `AGENTS.md`, `README.md`, and contribution guardrails.
