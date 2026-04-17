# Repository Structure Audit — Executive Summary

**Date:** April 17, 2026  
**Repository:** quill-ai (tovrr/quill-ai)  
**Scope:** Full monorepo hygiene with focus on API routes and backend organization  
**Status:** ✅ Complete audit delivered with detailed roadmap

---

## One-Page Overview

### Current State Assessment

| Dimension | Current | Assessment |
|-----------|---------|-----------|
| **API Routes** | 36 endpoints | ✅ Good coverage; lacks versioning strategy |
| **Lib Organization** | 28 top-level files | ⚠️ Sprawl detected; 22 files unorganized |
| **Lib Domains** | 2 (auth, chat) | ✅ Good patterns; inconsistent application |
| **Components** | Well-organized | ✅ 4 clear domains (ui, layout, agent, legal) |
| **Documentation** | 11 root .md files | ✅ Strong governance; needs ADR registry |
| **Chat Backend** | 582-line route | ✅ Well-decomposed (5 modules) |
| **Git History** | Full | ✅ Ready for history-preserving refactoring |

### Key Findings (3 Strengths, 3 Risks, 3 Opportunities)

**✅ Strengths:**
1. Intentional chat backend decomposition with clear module boundaries
2. Strong governance (AGENTS.md, memory bank, deployment checklist)
3. Well-organized components by domain (ui, layout, agent, legal)

**⚠️ Risks:**
1. Library sprawl: 22 top-level utilities without domain ownership
2. Unclear placement guidelines for new features (where does it go?)
3. Missing ADR registry and API design documentation

**💡 Opportunities:**
1. Organize lib/ into 10 domains → immediate clarity
2. Create ADR directory + API design guide → governance
3. Reduce top-level lib files from 28 → 2 (huge win for onboarding)

---

## Target State (Recommended)

### Library Reorganization (Major Win)

```
CURRENT: src/lib/ (28 top-level files)
├── auth/
│   ├── client.ts
│   └── server.ts
├── chat/
│   ├── request-utils.ts
│   ├── model-selection.ts
│   ├── access-gates.ts
│   ├── policy-runtime.ts
│   └── two-pass-builder.ts
└── [22 scattered utilities]

TARGET: src/lib/ (2 top-level + 10 organized domains)
├── auth/              ← Move api-security, entitlements here
├── chat/              ← Keep (already decomposed)
├── ai/                ← NEW: killers, killer-autonomy, assistant-messages
├── builder/           ← NEW: artifacts, parser, quality, metrics
├── execution/         ← NEW: service, docker, providers, validation
├── data/              ← NEW: db-helpers, audit-log
├── models/            ← NEW: openrouter, google config
├── integrations/      ← NEW: google-api, web-search
├── extensions/        ← NEW: mcp-registry, skills, autopilot, customization
├── observability/     ← NEW: metrics, logging, rate-limit, telemetry
├── utils.ts           ← Keep (root singleton)
└── react-preview.ts   ← Keep (root singleton)
```

### Documentation Improvements

```
NEW: docs/
├── decisions/         ← 10 Architecture Decision Records (ADRs)
│   ├── 001-next-js-16-app-router.md
│   ├── 002-chat-backend-decomposition.md
│   ├── ... 8 more key decisions
│
├── api/
│   ├── DESIGN_GUIDE.md      ← Endpoint patterns, rate limiting, versioning
│   └── TAXONOMY.md          ← Domain organization + route grouping
│
└── patterns/
    ├── MODULARITY.md        ← How to structure new domains
    ├── TESTING.md           ← Testing patterns
    └── PERFORMANCE.md       ← Performance considerations

NEW: CHANGELOG.md            ← Version history linked to commits
```

### API Routes (Optional Future Enhancement)

Current: `/api/chat`, `/api/auth/[...path]`, etc.  
Target (optional): `/api/v1/chat`, `/api/v1/auth/[...path]`, etc.

Benefit: Prepare for breaking changes and future versioning without client disruption.

---

## Migration Plan (Phased Approach)

### Phase 0: Preparation (1.5h)
- ✅ Create directory structure
- ✅ No file moves; structure only
- ✅ One commit: "Prepare lib directory reorganization"

### Phase 1: Documentation (2.5h)
- ✅ Create `docs/decisions/` with 10 ADRs
- ✅ Create `docs/api/DESIGN_GUIDE.md`
- ✅ Create `docs/api/TAXONOMY.md`
- ✅ Create `docs/patterns/MODULARITY.md`
- ✅ Add `CHANGELOG.md`
- ✅ One commit: "Add architecture documentation"

### Phase 2: Library Reorganization (4-6h)
- Move 26 lib files into domain folders (8 phases, 1 commit per domain)
- Update all imports (automated via grep/replace)
- Validate typecheck + build after each domain
- Final commit: "Reorganize lib by domain"

### Phase 3: API Routes (10h, OPTIONAL)
- Create `/api/v1/` namespace
- Gradually migrate endpoints (1 domain per commit)
- Old endpoints remain functional with optional deprecation notices
- Can be deferred 2-4 weeks; not critical for current scale

### Phase 4: Validation (2.5h)
- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm run build` ✅
- Smoke tests + manual integration ✅
- Update memory bank with completion notes

**Total Mandatory: 11h | Optional: +10h**

---

## Success Metrics (Post-Migration)

| Metric | Target | Impact |
|--------|--------|--------|
| Typecheck passes | 100% | Zero compilation errors |
| Build time change | < 2% | No performance regression |
| All tests pass | 100% | Feature parity maintained |
| New feature placement | Clear | "Where does this go?" answered in < 2 min |
| Onboarding time | -20% | Faster contributor ramp-up |
| Chat endpoint works | ✅ | Production feature unaffected |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Import errors post-migration | Medium | High | Automated grep/replace + typecheck validation |
| Build time regression | Low | Medium | Track metrics; rollback if > 2% |
| Circular dependencies introduced | Low | High | ESLint rule to enforce structure |
| Developer resistance to new structure | Low | Low | Documentation + rationale in ADRs |
| Lost context during migration | Low | Medium | Full git history preserved; clean commits |

**Rollback Plan:** If critical issue, revert commits in < 30 min; no data loss.

---

## Recommendations

### Immediate (This Week)
1. ✅ **Review & Approve**: Tech lead validates audit approach (30 min)
2. **Execute Phase 0**: Create structure (1.5h)
3. **Execute Phase 1**: Document decisions (2.5h)
4. **Execute Phase 2**: Reorganize lib/ (4-6h over 2-3 days)

### Deferred (Next Sprint)
- **Phase 3**: API routes under v1/ (10h, can wait 2-4 weeks)
- Extended refactoring: Chat route sub-tasks

### Ongoing
- Update `.agents/memory-bank/context.md` with completion notes
- Follow established patterns for new features
- Quarterly audit to catch structural drift

---

## Key Deliverables Included

✅ **`REPOSITORY_STRUCTURE_AUDIT.md`** (10 Parts, 500+ lines)
- Current-state inventory with tree views
- Detailed assessment & analysis
- Target-state architecture with rationale
- Step-by-step migration plan
- Prioritized backlog
- Naming conventions & file placement rules
- Recommended tooling
- Validation criteria
- Sign-off checklist

✅ **`REPOSITORY_STRUCTURE_AUDIT.json`** (Machine-readable)
- Audit metadata
- Current/target state metrics
- File migration mapping (26 files)
- Phase definitions
- Effort breakdown
- Risks and opportunities

✅ **Target-State Mermaid Diagram** (Visual reference)
- Full repository tree
- Domain organization
- 10 library domains with example files

---

## Talking Points for Team

**Why do this?**
- ✅ Clarity: New contributors know where to put code
- ✅ Scale: Prepares for team growth without chaos
- ✅ Maintainability: Easier to find and modify related code
- ✅ Quality: Prevents future sprawl and module confusion

**What's the impact?**
- Library: 28 files → 2 top-level + 10 organized domains
- Onboarding: Estimated 20% faster ramp-up for new contributors
- Build: No regression (< 2% target)
- Features: Unaffected; git history fully preserved

**Is it risky?**
- Low risk: History-preserving moves, clean commits, full validation
- Rollback: Available in < 30 min if needed
- Testing: Comprehensive smoke tests + typecheck pre-merge

**When can we start?**
- Phases 0-2: This week (11h total)
- Phase 3: 2-4 weeks out (optional; not critical for current scale)

---

## Files to Review

1. **[REPOSITORY_STRUCTURE_AUDIT.md](REPOSITORY_STRUCTURE_AUDIT.md)** — Full audit (10 parts)
2. **[REPOSITORY_STRUCTURE_AUDIT.json](REPOSITORY_STRUCTURE_AUDIT.json)** — Machine-readable
3. **This file** — Quick executive summary
4. **[Mermaid Diagram](REPOSITORY_STRUCTURE_AUDIT.md#part-101-target-state-directory-tree-detailed-mermaid)** — Visual target state

---

## Next Steps (Action Items)

- [ ] **Tech Lead**: Review audit + recommend approval/changes
- [ ] **Team**: Discuss recommendations in next standup
- [ ] **Schedule**: Plan Phase 0 kickoff (1.5h block)
- [ ] **Communicate**: Share this summary with stakeholders
- [ ] **Execute**: Follow phased migration plan (11h mandatory + 10h optional)

---

**Document Version:** 1.0 (Executive Summary)  
**Full Audit:** Committed to repository (commit 0b9077c)  
**Status:** Ready for stakeholder review & approval  
**Estimated Completion:** 1-2 weeks (mandatory phases)
