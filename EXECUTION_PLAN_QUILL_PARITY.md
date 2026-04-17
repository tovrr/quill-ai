# Quill Catch-Up Execution Plan (vs Coworker)

Date: 2026-04-17

## Objective
Close the highest-impact capability gaps while preserving Quill's current architecture and quality bar.

## Scope
Top 5 roadmap items, sequenced by leverage:
1. MCP Registry V1
2. MCP OAuth lifecycle
3. True scheduled Autopilot execution
4. A2A minimal protocol surface
5. External Skills Marketplace adapters

## Delivery Cadence
- Sprint 1 (Weeks 1-2): MCP Registry V1 (ship)
- Sprint 2 (Weeks 3-4): MCP OAuth lifecycle (ship)
- Sprint 3 (Weeks 5-6): Scheduled Autopilot execution (ship)
- Sprint 4 (Weeks 7-8): A2A MVP + Skills adapters beta (ship)

## Milestone Plan

### M1: MCP Registry V1 (Weeks 1-2)
Goal: Let users discover curated MCP servers and install them in one click.

Work items:
- Add registry API endpoint with search and pagination-safe limits.
- Add curated registry catalog source with trust metadata.
- Add MCP page registry panel with install-to-form flow.
- Add baseline audit/observability hooks for registry fetches.

Acceptance criteria:
- User can search registry entries from MCP page.
- User can install registry entry into server form in one click.
- Endpoint is auth-gated and validated.

Status: In progress in this execution pass.

### M2: MCP OAuth Lifecycle (Weeks 3-4)
Goal: Move from token-only MCP setup to OAuth-capable connection flows.

Work items:
- Extend MCP server persistence with OAuth state + encrypted tokens.
- Add OAuth start/callback/revoke endpoints.
- Add MCP UI connect/reconnect/revoke actions.

Acceptance criteria:
- OAuth-capable servers can be connected without manual token entry.
- Token lifecycle supports refresh and revoke.

Status: Planned.

### M3: Scheduled Autopilot Execution (Weeks 5-6)
Goal: Convert manual runs into real scheduled execution.

Work items:
- Add scheduler trigger endpoint and signer verification.
- Wire cron execution path to workflow run pipeline.
- Add retries and run status telemetry.

Acceptance criteria:
- Active workflows run at scheduled intervals.
- Failed runs are logged and visible.

Status: Planned.

### M4: A2A MVP (Weeks 7-8)
Goal: Expose minimum interoperable agent surface.

Work items:
- Agent card endpoint.
- Task execute endpoint with auth + allowlist.
- Basic usage metrics.

Acceptance criteria:
- External agents can discover and call Quill task execution endpoint.

Status: Planned.

### M5: Skills Marketplace Adapters Beta (Weeks 7-8)
Goal: Move from static skills catalog toward external provider-backed installs.

Work items:
- Add external source adapter interface.
- Add install provenance + version metadata.
- Add rollback action for installed connectors.

Acceptance criteria:
- At least one external source can be queried and installed via Quill.

Status: Planned.

## Risks
- OAuth token management and encryption policy can affect M2 timing.
- Scheduler choice (platform cron vs external worker) can affect M3 complexity.

## Executed Now
This pass executes M1 foundation:
- Registry backend endpoint
- Curated registry source
- MCP page registry install flow

## Exit Checks Per Milestone
- `npm run typecheck`
- `npm run build`
