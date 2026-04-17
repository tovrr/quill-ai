# ADR 005: Distributed Rate Limiting with Redis Fallback

## Status
Accepted

## Date
2026-04-17

## Context
In-memory limits are insufficient for reliability under multi-instance deployment.

## Decision
Use `src/lib/rate-limit.ts` with Redis-backed counting (Upstash) and automatic in-memory fallback for resilience.

## Alternatives Considered
- In-memory only
- Provider-specific edge limits only

## Consequences
### Positive
- Better production consistency across instances
- Graceful degradation when Redis is unavailable

### Negative
- Additional infrastructure dependency
- Must monitor fallback mode frequency

## Notes
All API routes should call `await checkRateLimit()`.
