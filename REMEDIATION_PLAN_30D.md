# 30-Day UI Remediation Plan

## Quill AI - Shadcn, Heroicons, and Design-System Compliance

**Plan Created**: April 9, 2026  
**Scope**: Frontend UI primitives, icon system, token discipline, and enforcement  
**Timeline**: 30 days (April 9 - May 9, 2026)  
**Status**: Active

---

## Executive Summary

This plan remediates the UI-system drift identified in the repository audit.

Current state:

1. Shadcn is not established as the shared primitive layer.
2. Heroicons is only used in a limited way and is mixed with inline SVGs.
3. Custom icon components and inline SVG markup are widespread.
4. Design tokens exist, but many components still hardcode colors and styles.
5. Lint and typecheck pass, so the work is structural rather than break-fix.

Target state by day 30:

1. Shared UI primitives come from a real Shadcn layer.
2. All product UI icons come from Heroicons with canonical imports.
3. Inline SVGs are removed from application UI code, except approved brand or marketing asset exceptions.
4. Token usage is normalized across major surfaces.
5. CI guardrails prevent regression.

Approved exception policy for this plan:

1. The Quill logo is kept as a brand asset.
2. The canonical logo implementation remains [src/components/ui/QuillLogo.tsx](src/components/ui/QuillLogo.tsx) unless later converted to a PNG-based asset path.
3. Brand and favicon assets may remain non-Heroicons if explicitly documented.

---

## Scope

In scope:

1. [src/app](src/app)
2. [src/components](src/components)
3. [src/components/ui](src/components/ui)
4. [src/app/globals.css](src/app/globals.css)
5. [public/favicon.svg](public/favicon.svg)
6. [public/demo-preview.svg](public/demo-preview.svg)
7. lint and CI enforcement for UI standards

Out of scope:

1. backend-only routes with no user-facing UI impact
2. broad product roadmap work unrelated to UI standardization
3. visual rebrand beyond token normalization and primitive migration

---

## Guiding Rules

### Rule 1: Brand Asset Exception

Allowed non-Heroicons assets:

1. [src/components/ui/QuillLogo.tsx](src/components/ui/QuillLogo.tsx)
2. [public/favicon.svg](public/favicon.svg)
3. [public/demo-preview.svg](public/demo-preview.svg) only if retained as a marketing illustration

Everything else in product UI should migrate to Heroicons.

### Rule 2: Primitive Ownership

Interactive controls should move behind shared Shadcn primitives. Raw controls may remain temporarily during migration only if they are tracked in an explicit residual-debt list with owner and due date.

### Rule 3: Canonical Icon Imports

Allowed import forms:

1. `@heroicons/react/24/outline`
2. `@heroicons/react/24/solid`
3. `@heroicons/react/20/solid` only where a smaller canonical Heroicons size is appropriate

### Rule 4: Token Discipline

Prefer Quill tokens and shared semantic classes over ad hoc hex values and repeated inline styles.

### Rule 5: Measurable Exit Criteria

The migration is complete only when repository-level checks pass, not only when major surfaces are improved.

Required measurable checks:

1. zero non-allowlisted `<svg` usage in `src/**`
2. zero `lucide-react` and `@radix-ui/react-icons` imports in app code
3. zero legacy Heroicons shim files, including [src/types/heroicons.d.ts](src/types/heroicons.d.ts)
4. zero non-allowlisted raw primitives (`button`, `input`, `select`, `textarea`, `details`, `summary`) outside explicitly approved files

---

## Phase 0: Policy and Guardrails

**Duration**: Days 1-3  
**Priority**: Critical  
**Owner**: Frontend foundation

### Phase 0 Objective

Lock the standards first so implementation work does not drift.

### Phase 0 Success Criteria

1. Brand asset exceptions are documented.
2. Allowed icon packages are explicitly defined.
3. New raw SVG usage in product UI is blocked in CI.
4. New non-Shadcn primitive proliferation is discouraged by convention and review checklist.
5. A baseline debt inventory is captured so progress can be measured objectively.

### Phase 0 Deliverables

#### 0.1 Standards Note

Create or update a short standards note in the repo documenting:

1. Quill logo exception
2. Heroicons-only rule for product UI
3. Shadcn as the shared primitive layer
4. token usage expectations

Suggested placement:

1. [AGENTS.md](AGENTS.md)
2. [README.md](README.md)
3. a dedicated UI standards markdown file if preferred

#### 0.2 Lint and CI Checks

Add checks for:

1. no `lucide-react` imports in app code
2. no `@radix-ui/react-icons` imports in app code
3. no raw `<svg` in `src/**` except allowlisted files
4. Heroicons import-path enforcement
5. no new raw primitive controls outside approved exceptions

Suggested implementation options:

1. ESLint custom restricted imports rules
2. CI `rg` checks for `'<svg'`
3. allowlist patterns for [src/components/ui/QuillLogo.tsx](src/components/ui/QuillLogo.tsx)

#### 0.3 Baseline Inventory Snapshot

Create a baseline report checked into the repo that records:

1. all non-allowlisted SVG locations in `src/**`
2. all non-Heroicons icon imports
3. all raw primitive locations still outside shared components
4. all residual debt exceptions with owner and target phase

### Phase 0 Acceptance Criteria

1. Any new non-allowlisted SVG in `src` fails CI.
2. Any new non-Heroicons icon import fails CI.
3. Exception policy is documented once and referenced consistently.
4. Baseline debt snapshot exists and is referenced by later phase checklists.

---

## Phase 1: Shadcn Foundation

**Duration**: Days 3-8  
**Priority**: Critical  
**Owner**: Frontend foundation

### Phase 1 Objective

Introduce the shared primitive layer before rewriting major surfaces.

### Phase 1 Success Criteria

1. Shadcn primitives exist in the repo and are used by new work.
2. Core primitives cover the current app's interaction patterns.
3. The primitive layer is styled to respect Quill tokens.

### Phase 1 Deliverables

#### 1.1 Install and Scaffold Core Primitives

Minimum primitive set:

1. Button
2. Input
3. Textarea
4. Dialog
5. Select
6. Switch
7. Card
8. Badge
9. Sheet
10. DropdownMenu
11. Tabs
12. Separator
13. ScrollArea
14. Collapsible or Accordion
15. Tooltip

#### 1.2 Token Integration

Align the primitive layer to [src/app/globals.css](src/app/globals.css) tokens rather than introducing a second visual language.

#### 1.3 Shared Usage Conventions

Document when to use:

1. `Button` instead of raw `button`
2. `Input` and `Textarea` instead of raw form fields
3. `Dialog` instead of custom modal shells
4. `DropdownMenu` and `Collapsible` instead of ad hoc menu and disclosure logic

### Priority Files Affected Later by This Foundation

1. [src/components/ui/SettingsModal.tsx](src/components/ui/SettingsModal.tsx)
2. [src/components/agent/TaskInput.tsx](src/components/agent/TaskInput.tsx)
3. [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx)
4. [src/components/agent/CanvasPanel.tsx](src/components/agent/CanvasPanel.tsx)
5. [src/components/agent/RealMessageBubble.tsx](src/components/agent/RealMessageBubble.tsx)

### Phase 1 Acceptance Criteria

1. Shadcn primitives are committed and usable.
2. No new major UI code is added outside the shared primitive layer.
3. Lint and typecheck still pass.

---

## Phase 2: Icon System Migration

**Duration**: Days 6-12  
**Priority**: Critical  
**Owner**: Frontend UI

### Phase 2 Objective

Eliminate custom product-icon implementations and inline SVG UI icons.

### Phase 2 Success Criteria

1. Product UI icons come from Heroicons only.
2. [src/components/ui/KillerIcon.tsx](src/components/ui/KillerIcon.tsx) is removed or rewritten as a thin Heroicons mapping.
3. Inline SVG markup is removed from high-traffic app components.
4. Brand assets remain only where explicitly allowed.

### Phase 2 Deliverables

#### 2.1 Remove Custom Product Icon Registry

Primary target:

1. [src/components/ui/KillerIcon.tsx](src/components/ui/KillerIcon.tsx)

Migration options:

1. remove the component entirely and import Heroicons at call sites
2. keep a semantic mapping wrapper, but map keys to Heroicons components instead of inline SVG

Also remove legacy type shims that mask non-canonical icon usage:

1. [src/types/heroicons.d.ts](src/types/heroicons.d.ts)

#### 2.2 Normalize Sidebar Icons

Primary target:

1. [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx)

This file already imports Heroicons and should become the first fully compliant icon surface.

#### 2.3 Replace Inline Icons in Major Components

Primary targets:

1. [src/components/agent/TaskInput.tsx](src/components/agent/TaskInput.tsx)
2. [src/components/agent/CanvasPanel.tsx](src/components/agent/CanvasPanel.tsx)
3. [src/components/agent/RealMessageBubble.tsx](src/components/agent/RealMessageBubble.tsx)
4. [src/components/agent/ToolCallCard.tsx](src/components/agent/ToolCallCard.tsx)
5. [src/components/HeroInput.tsx](src/components/HeroInput.tsx)
6. [src/app/agent/page.tsx](src/app/agent/page.tsx)
7. [src/app/page.tsx](src/app/page.tsx)
8. [src/app/pricing/page.tsx](src/app/pricing/page.tsx)
9. [src/app/share/[chatId]/page.tsx](src/app/share/[chatId]/page.tsx)
10. [src/app/docs/page.tsx](src/app/docs/page.tsx)

#### 2.4 Suggested Heroicons Mapping

1. close or dismiss -> `XMarkIcon`
2. menu -> `Bars3Icon`
3. check or success -> `CheckIcon` or `CheckCircleIcon`
4. warning or failure -> `ExclamationTriangleIcon` or `ExclamationCircleIcon`
5. copy -> `DocumentDuplicateIcon`
6. share -> `ShareIcon`
7. search -> `MagnifyingGlassIcon`
8. upload -> `ArrowUpTrayIcon`
9. download -> `ArrowDownTrayIcon`
10. edit -> `PencilSquareIcon`
11. image -> `PhotoIcon`
12. settings -> `Cog6ToothIcon`

### Phase 2 Acceptance Criteria

1. No non-allowlisted `<svg` remains in `src` for product UI.
2. `KillerIcon` is no longer an inline SVG registry.
3. Heroicons imports use canonical package paths.
4. [src/types/heroicons.d.ts](src/types/heroicons.d.ts) is removed.

---

## Phase 3: Shared Primitive Migration

**Duration**: Days 10-18  
**Priority**: Critical  
**Owner**: Frontend UI

### Phase 3 Objective

Rebuild major UI surfaces on top of the shared primitive layer.

### Phase 3 Success Criteria

1. Major interactive surfaces no longer reimplement basic controls.
2. Dialog, switch, select, button, tabs, and menu behavior is standardized.
3. Accessibility improves as a side effect of using mature primitives.

### Phase 3 Deliverables

#### 3.1 Settings Modal Rewrite

Target:

1. [src/components/ui/SettingsModal.tsx](src/components/ui/SettingsModal.tsx)

Replace custom implementations of:

1. modal shell -> `Dialog`
2. toggle -> `Switch`
3. select -> `Select`
4. buttons -> `Button`
5. text inputs and textarea -> shared primitives

#### 3.2 Task Composer Rewrite

Target:

1. [src/components/agent/TaskInput.tsx](src/components/agent/TaskInput.tsx)

Replace ad hoc controls with:

1. `Textarea`
2. `Button`
3. `DropdownMenu`
4. `Badge`
5. `Tooltip`

#### 3.3 Sidebar Rewrite

Target:

1. [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx)

Replace ad hoc sections and menus with:

1. `Button`
2. `Sheet`
3. `DropdownMenu`
4. `Collapsible` or `Accordion`
5. `ScrollArea`

#### 3.4 Canvas and Message Surface Rewrite

Targets:

1. [src/components/agent/CanvasPanel.tsx](src/components/agent/CanvasPanel.tsx)
2. [src/components/agent/RealMessageBubble.tsx](src/components/agent/RealMessageBubble.tsx)
3. [src/components/agent/ToolCallCard.tsx](src/components/agent/ToolCallCard.tsx)

Focus on replacing:

1. raw buttons
2. raw details and summary disclosures
3. custom tab controls
4. ad hoc cards and badges

#### 3.5 Secondary Form Surfaces

Targets:

1. [src/app/login/page.tsx](src/app/login/page.tsx)
2. [src/app/admin/model-usage/page.tsx](src/app/admin/model-usage/page.tsx)
3. [src/app/error.tsx](src/app/error.tsx)

### Phase 3 Acceptance Criteria

1. Shared UI surfaces use the Shadcn primitive layer.
2. Duplicate custom control implementations are removed.
3. Lint and typecheck still pass.

---

## Phase 4: Token Hardening

**Duration**: Days 16-22  
**Priority**: High  
**Owner**: Frontend UI and design-system owner

### Phase 4 Objective

Reduce visual drift by replacing hardcoded values with token-backed styles.

### Phase 4 Success Criteria

1. High-repeat hardcoded colors are removed from major components.
2. Shared primitives reflect Quill visual tokens.
3. Remaining exceptions are intentional and documented.

### Phase 4 Deliverables

#### 4.1 High-Drift File Cleanup

Priority targets:

1. [src/components/HeroInput.tsx](src/components/HeroInput.tsx)
2. [src/components/legal/LegalLayout.tsx](src/components/legal/LegalLayout.tsx)
3. [src/components/agent/CanvasPanel.tsx](src/components/agent/CanvasPanel.tsx)
4. [src/app/page.tsx](src/app/page.tsx)
5. [src/app/pricing/page.tsx](src/app/pricing/page.tsx)

#### 4.2 Replace Repeated Hex and RGBA Values

Use:

1. existing `quill-*` semantic classes where possible
2. additional CSS variables in [src/app/globals.css](src/app/globals.css) only when repetition justifies it

### Phase 4 Acceptance Criteria

1. Repeated color literals are significantly reduced.
2. The app still matches Quill branding.
3. Shared components rely primarily on semantic tokens.

---

## Phase 5: Accessibility Pass

**Duration**: Days 20-25  
**Priority**: High  
**Owner**: Frontend UI

### Phase 5 Objective

Standardize icon accessibility and interactive semantics after the structural migrations are complete.

### Phase 5 Success Criteria

1. Icon-only controls have `aria-label`.
2. Decorative icons are `aria-hidden`.
3. Dialog, menu, and disclosure semantics are inherited from shared primitives.
4. The logo is treated consistently as decorative or branded content depending on context.

### Phase 5 Deliverables

#### 5.1 Icon Accessibility Audit and Cleanup

Priority targets:

1. [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx)
2. [src/components/agent/TaskInput.tsx](src/components/agent/TaskInput.tsx)
3. [src/components/agent/CanvasPanel.tsx](src/components/agent/CanvasPanel.tsx)
4. [src/components/agent/RealMessageBubble.tsx](src/components/agent/RealMessageBubble.tsx)
5. [src/app/agent/page.tsx](src/app/agent/page.tsx)

#### 5.2 Logo Semantics Rules

1. In decorative placements, `QuillLogo` should be hidden from assistive tech.
2. In branded identity placements, the nearby text label should carry the meaning so the logo does not need redundant accessible naming.

### Phase 5 Acceptance Criteria

1. Icon-only buttons are labeled.
2. Decorative icons do not create noise for assistive tech.
3. No new custom accessibility workarounds are needed where shared primitives already solve the issue.

---

## Phase 6: CI Enforcement and Final Cleanup

**Duration**: Days 24-30  
**Priority**: Critical  
**Owner**: Frontend foundation

### Phase 6 Objective

Lock the gains so the codebase does not regress after the migration.

### Phase 6 Success Criteria

1. CI fails on non-allowlisted raw SVGs.
2. CI fails on non-Heroicons icon packages.
3. CI still runs lint and typecheck cleanly.
4. A short local audit command set exists for contributors.

### Phase 6 Deliverables

#### 6.1 Final CI Checks

Minimum checks:

1. `npm run lint`
2. `npm run typecheck`
3. raw SVG grep check with allowlist
4. restricted icon-import grep or ESLint rule
5. raw primitive grep check with allowlist
6. visual smoke check for critical routes

#### 6.2 Contributor Repro Commands

Document commands for local validation:

```powershell
npm run lint
npm run typecheck
rg -n "@heroicons/react" src
rg -n "lucide-react|@radix-ui/react-icons" src
rg -n "<svg|<path|<circle|<rect|<line|<polyline|<polygon|<defs|<linearGradient" src public
rg -n "from ['\"]@/components/ui/(button|input|card|dialog|select|textarea|dropdown-menu|sheet|tabs|badge|avatar|switch|popover|tooltip|separator|scroll-area|alert-dialog|command|form|checkbox|radio-group)" src
rg -n "<button|<input|<select|<textarea|<details|<summary" src
```

### Phase 6 Acceptance Criteria

1. CI enforces the agreed standard.
2. Local contributors can reproduce the audit quickly.
3. The repo is protected against reintroducing the same drift.
4. Critical route smoke checks pass after each PR in this plan.

---

## 30-Day Timeline

### Week 1

1. Phase 0 policy and guardrails
2. Start Phase 1 Shadcn foundation

### Week 2

1. Finish Phase 1
2. Execute Phase 2 icon migration on highest-traffic surfaces
3. Start sidebar migration in the same stream to reduce churn

### Week 3

1. Execute Phase 3 shared primitive migration (excluding work already merged with sidebar stream)
2. Start Phase 4 token cleanup

### Week 4

1. Finish Phase 4
2. Complete Phase 5 accessibility pass
3. Complete Phase 6 CI enforcement and final cleanup

---

## Priority Order by File

### Tier 1

1. [src/components/ui/SettingsModal.tsx](src/components/ui/SettingsModal.tsx)
2. [src/components/agent/TaskInput.tsx](src/components/agent/TaskInput.tsx)
3. [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx)
4. [src/components/ui/KillerIcon.tsx](src/components/ui/KillerIcon.tsx)

### Tier 2

1. [src/components/agent/CanvasPanel.tsx](src/components/agent/CanvasPanel.tsx)
2. [src/components/agent/RealMessageBubble.tsx](src/components/agent/RealMessageBubble.tsx)
3. [src/components/agent/ToolCallCard.tsx](src/components/agent/ToolCallCard.tsx)
4. [src/app/agent/page.tsx](src/app/agent/page.tsx)

### Tier 3

1. [src/app/page.tsx](src/app/page.tsx)
2. [src/app/pricing/page.tsx](src/app/pricing/page.tsx)
3. [src/app/share/[chatId]/page.tsx](src/app/share/[chatId]/page.tsx)
4. [src/app/docs/page.tsx](src/app/docs/page.tsx)
5. [src/components/HeroInput.tsx](src/components/HeroInput.tsx)
6. [src/components/legal/LegalLayout.tsx](src/components/legal/LegalLayout.tsx)
7. [src/app/login/page.tsx](src/app/login/page.tsx)
8. [src/app/admin/model-usage/page.tsx](src/app/admin/model-usage/page.tsx)

---

## Definition of Done

This plan is complete when all of the following are true:

1. Shared UI primitives are based on a real Shadcn layer.
2. Product UI icons come from Heroicons only.
3. Inline SVGs are removed from application UI code except approved brand or marketing exceptions.
4. [src/components/ui/KillerIcon.tsx](src/components/ui/KillerIcon.tsx) is removed or reduced to a Heroicons mapping.
5. The Quill logo remains available as an approved brand asset.
6. Hardcoded color drift is significantly reduced in major surfaces.
7. Accessibility semantics for icons and icon-only controls are normalized.
8. `npm run lint` and `npm run typecheck` pass.
9. CI prevents reintroducing the same violations.

---

## Risks and Mitigations

### Risk 1: Visual Drift During Primitive Migration

Mitigation:

1. migrate foundation components first
2. align primitives to Quill tokens before large rewrites

### Risk 2: Sidebar and TaskInput Become Long-Lived Refactor Branches

Mitigation:

1. split changes into focused PRs by surface
2. land icon migration and primitive migration in separate steps if needed

### Risk 3: Over-enforcement Breaks Brand Assets

Mitigation:

1. keep an explicit allowlist for brand SVGs
2. centralize the Quill logo exception in one documented policy

---

## Recommended PR Breakdown

### PR 1

1. policy note
2. lint guardrails
3. Shadcn foundation

### PR 2

1. Unified Sidebar stream: Heroicons migration + primitive migration in one PR
2. remove or rewrite `KillerIcon`
3. remove [src/types/heroicons.d.ts](src/types/heroicons.d.ts)
4. replace inline icons in shared agent components

### PR 3

1. SettingsModal and TaskInput migration
2. CanvasPanel and RealMessageBubble migration (first pass)

### PR 4

1. secondary page cleanup
2. token hardening
3. accessibility pass
4. final CI enforcement and smoke-check matrix

---

## Status Tracking

### Phase Completion

1. [ ] Phase 0 complete
2. [ ] Phase 1 complete
3. [ ] Phase 2 complete
4. [ ] Phase 3 complete
5. [ ] Phase 4 complete
6. [ ] Phase 5 complete
7. [ ] Phase 6 complete

### Final Validation

1. [ ] No non-allowlisted raw SVGs in `src`
2. [ ] No `lucide-react` imports in app code
3. [ ] No `@radix-ui/react-icons` imports in app code
4. [ ] Heroicons imports use canonical paths
5. [ ] [src/types/heroicons.d.ts](src/types/heroicons.d.ts) removed
6. [ ] No non-allowlisted raw primitive controls remain in `src`
7. [ ] Shared primitives cover all user-facing interactive surfaces or are listed in residual debt register
8. [ ] Critical route smoke checks pass (`/`, `/agent`, `/login`, `/pricing`, `/docs`, `/share/[chatId]`)
9. [ ] `npm run lint` passes
10. [ ] `npm run typecheck` passes
