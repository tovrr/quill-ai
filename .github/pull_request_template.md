# Pull Request Template

## Summary

Explain what this PR changes and why.

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor
- [ ] Documentation
- [ ] Chore

## Validation

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Manual verification completed

## Screenshots (if UI change)

Add before/after screenshots if relevant.

## Risks

Describe any migration, compatibility, or operational risks.

## Checklist

- [ ] Scope is focused
- [ ] Docs updated if needed
- [ ] No secrets added

## Chat Backend Guardrails (only if `/api/chat` changed)

- [ ] Route kept orchestration-only; no major re-inlining into `src/app/api/chat/route.ts`
- [ ] Request parsing/normalization updates live in `src/lib/chat/request-utils.ts`
- [ ] Mode/provider changes live in `src/lib/chat/model-selection.ts`
- [ ] Entitlement/quota changes live in `src/lib/chat/access-gates.ts`
- [ ] Killer policy/sandbox runtime changes live in `src/lib/chat/policy-runtime.ts`
- [ ] Builder two-pass flow changes live in `src/lib/chat/two-pass-builder.ts`
- [ ] `npm run typecheck` and `npm run build` were rerun after chat changes
