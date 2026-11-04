# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Fixed
- Autopilot "Run now" runs the same tool-policy check as the cron (`refuseIfPolicyChanged`): a workflow approved under another policy gets a `refused` run (`policy_changed`) and keeps its `refused` status, instead of a placeholder `success` that hid "Approve and resume"
- Autopilot page: switching to active, approving the policy and "Run now" show the API's error (or a network error) in a toast when the call fails

### Added
- Autopilot schema guard (`src/lib/autopilot/schema-guard.ts`): when the database lacks an Autopilot column (Postgres 42703 on `autopilot_workflow` / `autopilot_run`), the Autopilot API and the cron answer `503` with `code: "autopilot_schema_outdated"` and the SQL file to run, and log `autopilot.schema.outdated`, instead of an opaque 500. A "Release checklist" in `DEPLOYMENT_CHECKLIST.md` says to run the SQL before merging a change that adds a column
- One canonical-JSON helper (`src/lib/canonical-json.ts`) for the loop-guard repeat key and the Autopilot tool-policy hash; the hash of the empty policy is unchanged
- Loop guards (`src/lib/agent/loop-guards.ts`): the chat route and the Autopilot runner stop a tool loop after `AGENT_MAX_UNUSABLE_STEPS` (default 3) consecutive empty, repeated or fully failed steps and tell the user in plain words; the two-pass builder stops when its rewrite is empty or identical to the draft
- Autopilot: each workflow stores the hash of the tool policy at the owner's approval and an active workflow is refused (`policy_changed`) when it differs; new workflows start in observe mode (a dry run that records the model's text and the tool calls it would make) until the owner switches them to active. Requires the SQL in `src/db/migrations/2026-11-02-autopilot-policy-observe.sql` (or `db:push`) before deploy
- Terminal CLI interface (`cli/index.mjs`) with one-shot and REPL modes, plus `/api/cli/chat` authenticated SSE endpoint (`QUILL_CLI_KEY`)
- CLI regression suite `scripts/test-cli.mjs` with coverage for auth, validation, streaming events, and multi-turn context
- Tauri v2 desktop app scaffold under `desktop/` with system tray, single-instance behavior, and global hotkey toggle
- Desktop icon generation workflow via `scripts/desktop-icons.mjs` and root scripts (`desktop:icons`, `desktop:dev`, `desktop:build`)
- Phase 2 batch 1 migration: AI domain modules moved to `src/lib/ai/` (`assistant-message-utils.ts`, `killer-autonomy.ts`, `killers.ts`) with import rewiring across app/components/lib
- Phase 2 batch 2 migration: execution modules moved to `src/lib/execution/` (`service.ts`, `docker.ts`, `providers.ts`) with import rewiring across chat/runtime/sandbox routes
- Phase 2 batch 3 migration: data modules moved to `src/lib/data/` (`db-helpers.ts`, `audit-log.ts`) with import rewiring across API routes, share page, and lib callers
- Phase 2 batch 4 migration: integration modules moved to `src/lib/integrations/` (`google-api.ts`, `web-search.ts`) with import rewiring across chat/google/me routes and lib access gates
- Phase 2 batch 5 migration: extensions modules moved to `src/lib/extensions/` (`mcp-registry.ts`, `skills.ts`, `autopilot.ts`, `customization.ts`) with import rewiring across agent/chat/autopilot/mcp/skills/settings callers
- Phase 2 batch 6 migration: observability modules moved to `src/lib/observability/` (`metrics.ts`, `logging.ts`, `rate-limit.ts`) with import rewiring across chat/health/admin/artifacts/skills/google/mcp routes
- Phase 2 batch 7 migration: remaining domain files moved (`builder/artifacts.ts`, `builder/metrics.ts`, `auth/security.ts`, `models/openrouter.ts`) with import rewiring across agent/chat/components/me/mcp/google routes

### Validated
- `npm run test:cli` (10/10 pass)
- `npm run typecheck`
- `npm run build`
- `npm run test:agent-remediation` (pass)
- `npm run test:execution` path fixed to moved module; runtime check now reaches Docker and fails only when local daemon is unavailable

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
