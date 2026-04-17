# ADR 007: Abstract Code Execution Behind Service Layer

## Status
Accepted

## Date
2026-04-17

## Context
Execution cannot be tied to a single provider (Docker only) in all environments.

## Decision
Use `src/lib/execution-service.ts` as the execution abstraction and support provider adapters (Docker, future managed providers).

## Alternatives Considered
- Direct Docker calls from API routes
- Multiple provider-specific branches inside route handlers

## Consequences
### Positive
- Cleaner provider swapping
- Better portability between local/dev/prod

### Negative
- Adapter complexity and provider readiness checks needed

## Notes
Execution policy and sandbox availability are derived in chat policy runtime.
