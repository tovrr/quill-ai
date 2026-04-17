# ADR 010: Keep Memory Bank Under .agents

## Status
Accepted

## Date
2026-04-17

## Context
Agent-oriented memory and behavior rules were previously mixed under `.kilocode/rules`, creating ambiguity in ownership and intent.

## Decision
Use `.agents/` as the canonical location for memory-bank files and agent-specific development instructions.

## Alternatives Considered
- Keep memory under `.kilocode/rules`
- Split memory files across multiple top-level folders

## Consequences
### Positive
- Clear agent-focused ownership
- Cleaner separation from recipe templates in `.kilocode/recipes`

### Negative
- Requires reference updates in docs and prompts

## Notes
Migration completed on 2026-04-17 with reference updates across project docs.
