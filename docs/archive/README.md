# Archived docs

Historical documents, kept for reference but superseded by current sources of truth.
**Do not treat anything in here as current** — verify against code/`git log` before trusting
any claim in these files (same golden rule as the root `AGENTS.md`).

## `2026-04-audits/`

Audits, integration summaries, and remediation plans written April 2026, before the ~4-month
dormancy period. Superseded by:
- `docs/handoffs/2026-08-02-reactivation-audit-findings.md` (CI/CVE/repo-hygiene findings)
- `../../ROADMAP.md` and `../../TODOS.md` (consolidated live plan, merged in the content of
  `REMEDIATION_PLAN_30D.md` and `MULTI_AGENT_INTEGRATION.md` where still relevant)

Files: `AUDIT_2026_04_12.md`, `REPOSITORY_STRUCTURE_AUDIT.md` (+ `.json` + executive summary —
lib reorganization it proposed is already complete, see `CHANGELOG.md`), `REMEDIATION_PLAN_30D.md`,
`OPTIMIZATION_SUMMARY.md`, `GEMINI_COST_OPTIMIZATION.md`, `APEX_INTEGRATION_SUMMARY.md`,
`APEX_INTEGRATION_TESTING.md`, `EXECUTION_PLAN_QUILL_PARITY.md`, `COMPLETE_GOOGLE_OAUTH_GUIDE.md`
(Google OAuth already works in production — this was setup-in-progress documentation),
`UI_STANDARDS_BASELINE.md` (stale snapshot; `UI_STANDARDS.md` at repo root is still current),
`TESTING_EXECUTION_SERVICE.md`, `EXECUTION_SERVICE_TESTING_QUICK_REF.md`,
`MULTI_AGENT_INTEGRATION.md` (concept still valid — see `ROADMAP.md` Track C).

## `2026-launch-prep/`

Pre-launch checklist and GTM/social content drafted for a public launch that has not
happened. The product isn't ready for this yet — see `ROADMAP.md` §5 ("Definition of done for
ready to actually launch"). Don't publish anything from `launch-content/` without reviewing it
fresh; it was written before the MiniMax-style UI pass and may reference a product state that
doesn't match what ships.

Files: `RELEASE_CHECKLIST.md`, `DEMO_CAPTURE_GUIDE.md`, `launch-content/` (GTM calendar,
LinkedIn/X post drafts, community masterplan, v1.0.0 release notes).
