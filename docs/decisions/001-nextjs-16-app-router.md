# ADR 001: Standardize on Next.js 16 App Router

## Status
Accepted

## Date
2026-04-17

## Context
The product is built on Next.js 16 with App Router conventions. AI-generated or contributor changes frequently risk falling back to outdated patterns (`pages/api`, legacy middleware assumptions).

## Decision
Use Next.js 16 App Router as the canonical runtime and routing model.

## Alternatives Considered
- Keep mixed App Router + legacy Pages Router
- Migrate to another fullstack framework

## Consequences
### Positive
- Consistent route and metadata conventions
- Better alignment with current repository structure
- Lower hallucination and contributor drift risk

### Negative
- Requires strict guardrails in docs/review checklist
- Contributors must avoid older framework idioms

## Notes
See `AGENTS.md` hallucination risk section and `src/app/api/*/route.ts` pattern.
