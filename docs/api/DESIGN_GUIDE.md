# API Design Guide

## Scope
This guide defines conventions for Next.js App Router API routes in Quill AI.

## Route Structure
- Use `src/app/api/{domain}/.../route.ts` for current endpoints.
- Prefer domain-first grouping.
- Keep route handlers orchestration-focused and delegate logic to `src/lib/*` modules.

Examples:
- `src/app/api/chat/route.ts`
- `src/app/api/mcp/registry/route.ts`
- `src/app/api/autopilot/workflows/[workflowId]/run/route.ts`

## Handler Conventions
- Validate input early and return explicit status codes.
- Use shared helpers for auth, rate limiting, and observability.
- Keep mutation handlers auditable when relevant.

## Security Baseline
- Enforce authentication where data is user-specific or action-oriented.
- Rate-limit all externally reachable endpoints.
- Avoid shell execution in API routes unless fully sandboxed and bounded.
- Use timing-safe token comparison for secret-based admin endpoints.

## Observability
- Attach request context and request ID when available.
- Emit structured start/complete logs through shared observability utilities.
- Keep error responses user-safe; avoid leaking internal stack traces.

## Evolution Strategy
- Current routes remain unversioned in `src/app/api/*`.
- If breaking API contracts become frequent, introduce `src/app/api/v1/*` while preserving legacy routes during migration windows.
- Document all route additions/changes in PR descriptions and changelog.

## PR Checklist for API Changes
- Route added/updated under the correct domain
- Auth and rate limiting applied
- Input validation and failure paths covered
- Typecheck and build pass
- Docs updated when behavior contracts change
