# ADR 008: Standardize Request Observability and Readiness Checks

## Status
Accepted

## Date
2026-04-17

## Context
Production diagnosis requires request correlation and explicit readiness data.

## Decision
Adopt shared observability helpers for request start/complete logs and provide a readiness-oriented health endpoint.

## Alternatives Considered
- Ad hoc logging per route
- Liveness-only health endpoint

## Consequences
### Positive
- Faster debugging and incident triage
- Better confidence in dependent service availability

### Negative
- Requires route-level adoption discipline
- Increased log volume if not tuned

## Notes
See `src/lib/observability.ts` and `/api/health` readiness behavior.
