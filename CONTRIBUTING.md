# Contributing to Quill AI

Thanks for your interest in contributing.

## Development Setup

1. Fork the repository
2. Create a feature branch from `main`
3. Install dependencies

```bash
npm install
```

1. Configure `.env.local` (see `.env.example`)
2. Start development

```bash
npm run dev
```

## Before Opening a PR

Run the baseline checks:

```bash
npm run typecheck
npm run lint
npm run build
```

If your change touches API behavior, run or update smoke coverage where relevant.

## Pull Request Guidelines

- Keep PRs focused and small where possible
- Include a clear problem statement and outcome
- Add screenshots for UI changes
- Add or update tests/checks when behavior changes
- Update docs when introducing new flags, routes, or workflows

### Chat Backend Change Checklist

If your PR touches chat behavior, follow this ownership map instead of re-inlining logic in the route:

- `src/app/api/chat/route.ts`: orchestration only
- `src/lib/chat/request-utils.ts`: request parsing + message normalization
- `src/lib/chat/model-selection.ts`: mode limits + provider/model resolution
- `src/lib/chat/access-gates.ts`: entitlement and quota enforcement
- `src/lib/chat/policy-runtime.ts`: killer permission/sandbox runtime derivation
- `src/lib/chat/two-pass-builder.ts`: two-pass builder orchestration

Required for chat backend PRs:

1. Keep the route flow orchestration-first: parse -> runtime -> access -> prompt -> stream.
2. Add logic in the owning `src/lib/chat/*` module when possible.
3. Run both checks and include results in the PR:

```bash
npm run typecheck
npm run build
```

## Commit Style

Use clear, descriptive commit messages.

Examples:

- `fix(agent): prevent empty assistant bubble on stream start`
- `feat(canvas): auto-switch to preview when generation completes`

## Reporting Issues

- Use issue templates
- Include reproduction steps
- Include expected vs actual behavior
- Include environment details (OS, browser, Node version)
