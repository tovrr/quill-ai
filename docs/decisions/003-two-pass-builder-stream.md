# ADR 003: Use Two-Pass Builder Streaming Flow

## Status
Accepted

## Date
2026-04-17

## Context
Builder outputs need both user-facing streaming responsiveness and artifact integrity for persistence/renderability.

## Decision
Adopt two-pass builder orchestration (`src/lib/chat/two-pass-builder.ts`) to separate streaming UX from reliable artifact assembly/persistence.

## Alternatives Considered
- Single-pass streaming with direct persistence
- Post-process only after complete generation

## Consequences
### Positive
- Better user-perceived responsiveness
- More robust artifact handling
- Cleaner path for future quality gates

### Negative
- Added orchestration complexity
- More state transitions to debug

## Notes
Integrated via `/api/chat` orchestration.
