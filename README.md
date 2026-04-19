# Quill AI

[![CI Smoke](https://github.com/tovrr/quill-ai/actions/workflows/ci-smoke.yml/badge.svg)](https://github.com/tovrr/quill-ai/actions/workflows/ci-smoke.yml)

Quill AI is a personal AI agent and builder experience for research, writing, coding, and app/page generation.

Research, write, code, and build in one flow. Ask Quill for a result, inspect it in Canvas, and iterate fast.

Live app: <https://quill-ai-xi.vercel.app>

## Who Quill Is For

- Founders and indie builders shipping landing pages and MVP UI quickly
- Developers who want AI-generated app artifacts with inspectable code
- Teams that need one assistant for research, writing, and technical execution

## Product Demo

![Quill AI Demo Preview](./public/demo-preview.svg)

Demo note: the repository currently includes a static preview image.
When ready, add a short `public/demo.gif` and use `scripts/prepare-demo-gif.ps1` to optimize capture/output.

## Modern Local Setup (Step-by-Step)

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>

Recommended validation before opening PRs:

```bash
npm run typecheck
npm run lint
npm run build
npm run test -- --run test/prompt-sanitizer.test.ts test/agent-status-bar.test.ts
npm run test:execution   # Verify code execution is working
```

For full testing guide, see [TESTING_EXECUTION_SERVICE.md](./TESTING_EXECUTION_SERVICE.md)

## Use Cases

- Build a polished landing page artifact and refine sections one by one
- Generate a React app artifact and inspect code/preview in Canvas
- Export a Next.js bundle artifact for local setup and validation
- Run research and writing workflows in the same conversation

## Why Quill

- Multi-mode AI chat experience (fast, thinking, pro)
- Builder artifacts for page, react-app, and nextjs-bundle workflows
- Live canvas with code/preview flows
- Image generation support
- Auth, entitlement gating, and usage tracking foundations

## Core Capabilities

- Agent chat with streaming responses
- Artifact parser and quality/readiness checks
- React preview sandbox generation
- Next.js bundle export workflow
- API health and smoke test coverage

## Credibility Signals

- CI smoke checks on push and pull requests
- Typed artifact parsing and readiness checks
- Deployment hardening checklist and operational guidance
- Security and contribution policy docs for public collaboration

## Quick Start

### 1) Install

```bash
npm install
```

### 2) Configure env

Copy `.env.example` to `.env.local` and fill required values.

Required keys:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET` (use a long high-entropy value, for example `openssl rand -base64 48`)
- `BETTER_AUTH_URL`
- `GOOGLE_GENERATIVE_AI_API_KEY`

Optional AI routing keys:

- `OPENROUTER_API_KEY` (fast-mode OpenRouter selection)
- `AI_GATEWAY_API_KEY` (route OpenAI-compatible calls through Vercel AI Gateway)
- `AI_GATEWAY_BASE_URL` (default: `https://ai-gateway.vercel.sh/v1`)
- `AI_GATEWAY_MODEL_PREFIX` (optional prefix for gateway model ids, for example `openrouter/`)

CLI and desktop keys:

- `QUILL_CLI_KEY` (required for `/api/cli/chat` and CLI client auth)

Operational safety keys:

- `ALLOW_INMEMORY_RATELIMIT_FALLBACK` (defaults to enabled outside production; keep disabled in production)
- `ENABLE_IN_MEMORY_METRICS` (disabled in production by default; enable only for temporary diagnostics)

### 3) Run app

```bash
npm run dev
```

Open <http://localhost:3000>

## Repo Navigation

- App source: `src/`
- API routes: `src/app/api/`
- Builder and parsing logic: `src/lib/`
- CI workflow: `.github/workflows/ci-smoke.yml`
- Deployment runbook: `DEPLOYMENT_CHECKLIST.md`

### Chat Backend Module Map

To reduce regressions and AI-assistant hallucinations, `/api/chat` is intentionally split into focused helpers:

- `src/app/api/chat/route.ts`: orchestration only
- `src/lib/chat/request-utils.ts`: request validation + message normalization
- `src/lib/chat/model-selection.ts`: mode limits + model/provider resolution
- `src/lib/chat/access-gates.ts`: entitlements and quota enforcement
- `src/lib/chat/policy-runtime.ts`: killer policy decisions + sandbox runtime flags
- `src/lib/chat/two-pass-builder.ts`: two-pass builder streaming flow

When changing chat behavior, update the owning module first and keep route logic thin.

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build production app
- `npm run start` - Start production server
- `npm run lint` - Run lint checks
- `npm run typecheck` - Run TypeScript checks
- `npm run test -- --run` - Run unit tests in non-watch mode (CI-friendly)
- `npm run test:cli` - Run CLI/API contract checks for `/api/cli/chat`
- `npm run bundle:check` - Enforce bundle budgets
- `npm run audit:ui-standards` - Generate UI standards debt report
- `npm run enforce:ui-standards` - Enforce UI no-regression guardrails
- `npm run cli` - Launch the terminal CLI client
- `npm run cli:setup` - Create `~/.quillrc` starter config for CLI usage
- `npm run desktop:icons` - Generate Tauri desktop icons from `public/favicon.svg`
- `npm run desktop:dev` - Start the Tauri desktop shell in development mode
- `npm run desktop:build` - Build desktop bundles (`.exe`, `.dmg`, Linux targets)

Current focused unit coverage includes:

- `test/prompt-sanitizer.test.ts` (prompt sanitization)
- `test/agent-status-bar.test.ts` (agent status message/color regression)

Database scripts:

- `npm run db:generate`
- `npm run db:push`
- `npm run db:studio`

## Terminal CLI

Quill includes a terminal client in `cli/index.mjs` backed by `POST /api/cli/chat`.

Quick usage:

```bash
# one-shot
npm run cli -- "What is 2+2?"

# REPL
npm run cli
```

The CLI endpoint requires `QUILL_CLI_KEY` on server and client.

Supported config sources:

- `--url`, `--key`, `--mode` flags
- env vars: `QUILL_URL`, `QUILL_CLI_KEY`, `QUILL_MODE`
- `~/.quillrc` JSON file (generated via `npm run cli:setup`)

Run regression checks:

```bash
npm run test:cli
```

## Desktop App (Tauri v2)

Quill includes a desktop shell under `desktop/`.

Current behavior:

- Loads the hosted app URL in a native webview
- System tray controls (Open/Hide/Quit)
- Single-instance behavior
- Global hotkey toggle (`Ctrl+Shift+Q`)

Build prerequisites:

- Rust toolchain (`rustup`, `cargo`)
- Tauri CLI dependencies (`cd desktop && npm install`)

Build commands:

```bash
npm run desktop:icons
npm run desktop:dev
npm run desktop:build
```

## Reliability

- CI smoke workflow: `.github/workflows/ci-smoke.yml`
- UI standards workflow: `.github/workflows/ui-standards.yml`
- Deployment hardening checklist: `DEPLOYMENT_CHECKLIST.md`
- UI standards policy: `UI_STANDARDS.md`

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Drizzle ORM + Neon Postgres
- Better Auth
- AI SDK + Google/OpenAI providers

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening pull requests.

## AI Prompt Templates

This repository includes reusable prompt templates for local agents and tooling under files named `.prompt.*.md`.

Quick commands (from repo root):

- List prompts: `node scripts/prompts.mjs --list`
- Show prompt: `node scripts/prompts.mjs --show .prompt` (replace name)
- Show example invocation: `node scripts/prompts.mjs --example organize`
- Validate examples present: `node scripts/prompts.mjs --run-examples`

Examples for each prompt live in the `examples/` folder as `prompt.<name>.json`.

## Security

Please read [SECURITY.md](SECURITY.md) to report vulnerabilities responsibly.

## Code of Conduct

All contributors are expected to follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

MIT - see [LICENSE](LICENSE).

## If This Helps You

Please star the repository and share it with one builder or developer who would benefit from this workflow.

## Launch Messaging Snippets

Short launch post (X/LinkedIn):

I shipped Quill AI: a personal AI agent + builder canvas for research, writing, coding, and app artifact generation.
It can generate page, react-app, and nextjs-bundle outputs, then let you inspect and iterate fast.
Open source: <https://github.com/tovrr/quill-ai>

Indie community post:

Built Quill AI to reduce the gap between prompt and production-ready output.
Main loop: ask -> generate artifact -> inspect in canvas -> refine sections.
Would love feedback from builders shipping MVPs fast.

For a release-ready checklist, see RELEASE_CHECKLIST.md.
