# Contributing to Quill AI

Thanks for your interest in contributing.

## Development Setup

1. Fork the repository
2. Create a feature branch from `main`
3. Install dependencies

```bash
npm install
```

4. Configure `.env.local` (see `.env.example`)
5. Start development

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
