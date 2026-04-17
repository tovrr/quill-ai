# API Taxonomy

## Current Domain Map

### Chat
- `/api/chat`
- `/api/chats`
- `/api/chats/[chatId]`
- `/api/chats/[chatId]/render-audit`
- `/api/chats/import-guest`

### Auth and Identity
- `/api/auth/[...path]`
- `/api/me/entitlements`
- `/api/me/usage`

### Artifacts
- `/api/artifacts/versions`
- `/api/artifacts/versions/[versionId]`

### Autopilot
- `/api/autopilot/workflows`
- `/api/autopilot/workflows/[workflowId]`
- `/api/autopilot/workflows/[workflowId]/run`
- `/api/autopilot/runs`

### MCP and Skills
- `/api/mcp/registry`
- `/api/mcp/servers`
- `/api/mcp/servers/[serverId]`
- `/api/mcp/servers/[serverId]/connect`
- `/api/skills`
- `/api/skills/[skillId]`

### Integrations
- `/api/google/auth`
- `/api/google/callback`
- `/api/google/status`
- `/api/google/docs`
- `/api/google/docs/[docId]`
- `/api/google/docs/write`
- `/api/google/drive`
- `/api/google/drive/write`
- `/api/google/calendar/events`
- `/api/google/workspace/snapshots`
- `/api/google/workspace/snapshots/[snapshotId]/rollback`

### Generation and Execution
- `/api/generate-image`
- `/api/sandbox/execute`
- `/api/validate-bundle`
- `/api/preview`

### System and Admin
- `/api/health`
- `/api/metrics`
- `/api/csp-report`
- `/api/admin/model-usage`
- `/api/files/[fileId]`

## Placement Rules
- Add routes under the most specific domain folder.
- Avoid creating single-use top-level domains when an existing domain fits.
- For route complexity growth, split logic into `src/lib/{domain}` modules.
- Keep `/api/chat` orchestration-first and respect chat decomposition boundaries.

## Future Versioning Trigger
Introduce `v1` namespace if any of these occur:
- multiple clients require contract pinning
- frequent breaking changes in response shapes
- external partner integrations depend on stable versions
