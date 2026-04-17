# ADR 004: Use Better Auth for Session and Identity

## Status
Accepted

## Date
2026-04-17

## Context
The app requires secure authentication/session handling with App Router compatibility and database persistence.

## Decision
Use Better Auth with server/client adapters:
- `src/lib/auth/server.ts`
- `src/lib/auth/client.ts`
- route handler at `src/app/api/auth/[...path]/route.ts`

## Alternatives Considered
- DIY auth/session implementation
- Different auth providers with weaker App Router alignment

## Consequences
### Positive
- Structured session handling
- Cleaner auth gates in API routes
- Easier ownership/permission checks

### Negative
- Dependency on external auth library behavior
- Requires environment and DB schema alignment

## Notes
Auth checks are required across user-scoped routes.
