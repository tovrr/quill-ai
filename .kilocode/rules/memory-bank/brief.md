# Project Brief: Quill AI

## Purpose

Quill AI is a production-oriented personal AI agent app. It focuses on delivering reliable chat workflows, specialist personas, and sustainable model usage with clear free and paid mode boundaries.

## Target Users

- Individual users who need a fast daily AI workspace.
- Power users who switch between speed-oriented and deep-reasoning tasks.
- Authenticated users who need persistent conversation history and sharing.

## Core Use Case

Users interact with Quill by:

1. Typing a task in the **homepage hero input** — no login, no friction — and being sent straight to `/agent`.
2. Selecting Fast, Think, or Pro mode and sending prompts (with optional attachments).
3. Receiving streaming responses; optionally using Canvas mode for long-form or HTML outputs.
4. Managing conversations from sidebar history (pin, share, delete) after signing in.

## Key Requirements

### Must Have

- Stable chat API with resilient message extraction.
- Correct provider/model mapping for active model IDs.
- Authenticated persistence for chats and messages.
- Guest-safe behavior (no persistence and restricted advanced modes); sidebar login CTA for guests.
- Zero-friction homepage entry via hero task input → `/agent?q=`.
- Daily quota enforcement by mode.
- Sidebar management actions with ownership-safe delete.
- Consistent branding: quill-feather logo everywhere (favicon, PWA icons, app header).

### Nice to Have

- Optional low-cost fast-mode routing (OpenRouter free model path).
- Better observability and rate limiting for production hardening.
- Expanded product docs and in-app help coverage.

## Success Metrics

- `npm run typecheck` passes consistently.
- Core chat flows return successful responses with expected streaming behavior.
- Authenticated history operations (fetch/delete) are reliable and scoped to user ownership.

## Constraints

- Framework: Next.js 16 + React 19 + Tailwind CSS 4.
- Data layer: Neon PostgreSQL + Drizzle ORM.
- Auth: Better Auth.
- Package manager/scripts: npm in this repository.
