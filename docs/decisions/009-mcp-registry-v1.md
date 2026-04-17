# ADR 009: Ship Curated MCP Registry V1

## Status
Accepted

## Date
2026-04-17

## Context
Users need a fast, trusted way to discover MCP servers and install configuration with minimal manual setup.

## Decision
Ship a curated MCP registry source and auth-gated listing endpoint with UI install prefill flow.

## Alternatives Considered
- User-entered MCP server URLs only
- Full open marketplace with no trust metadata

## Consequences
### Positive
- Lower setup friction
- Better trust and discoverability via curated metadata

### Negative
- Curated list maintenance burden
- Potential mismatch with user-specific self-hosted preferences

## Notes
Implemented via `src/lib/mcp-registry.ts`, `GET /api/mcp/registry`, and MCP page integration.
