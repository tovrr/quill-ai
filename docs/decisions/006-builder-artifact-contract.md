# ADR 006: Enforce Typed Builder Artifact Contract

## Status
Accepted

## Date
2026-04-17

## Context
Builder outputs must be machine-parseable and renderable in Canvas; arbitrary artifact shapes caused regressions.

## Decision
Restrict builder artifact types to the supported set and parse through typed utilities.

Supported types:
- `page`
- `document`
- `react-app`
- `nextjs-bundle`

## Alternatives Considered
- Allow arbitrary artifact type strings
- Parse unstructured free-form output

## Consequences
### Positive
- Predictable rendering and storage
- Better resilience in streaming path

### Negative
- Requires strict prompting and validation
- Unsupported custom types are rejected

## Notes
See `src/lib/builder-artifacts.ts` and chat prompt constraints.
