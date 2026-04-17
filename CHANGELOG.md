# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added
- Phase 2 batch 1 migration: AI domain modules moved to `src/lib/ai/` (`assistant-message-utils.ts`, `killer-autonomy.ts`, `killers.ts`) with import rewiring across app/components/lib
- Phase 2 batch 2 migration: execution modules moved to `src/lib/execution/` (`service.ts`, `docker.ts`, `providers.ts`) with import rewiring across chat/runtime/sandbox routes
- Phase 2 batch 3 migration: data modules moved to `src/lib/data/` (`db-helpers.ts`, `audit-log.ts`) with import rewiring across API routes, share page, and lib callers

### Validated
- `npm run typecheck`
- `npm run build`

## [1.0.0] - 2026-04-17

### Added
- MCP Registry V1 with curated source list and one-click install flow
- Repository structure audit report and machine-readable plan
- Executive summary for repository structure audit
- Phase 0 structure skeleton for `docs/` and `src/lib/` domain folders

### Changed
- Agent memory bank and development guidance moved to `.agents/`
- Documentation references aligned with `.agents/` memory bank location

### Fixed
- Recipe path consistency in memory context (`.kilocode/recipes/add-database.md`)

## [1.0.0] - 2026-04-01

### Added
- Public launch documentation and repository governance files
- Builder artifact flow through Step 6 hardening
- Autonomy policy scaffolding and sandbox provider registry

### Changed
- Launch versioning strategy finalized at `1.0.0`
