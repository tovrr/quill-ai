# Project Brief: Quill AI

## Purpose

Quill AI is a production-oriented personal AI agent app. It focuses on delivering reliable chat workflows, specialist personas, and sustainable model usage with clear free and paid mode boundaries.

## Target Users

- Individual users who need a fast daily AI workspace.
- Power users who switch between speed-oriented and deep-reasoning tasks.
- Authenticated users who need persistent conversation history and sharing.

## Core Use Case

Users interact with Quill by:

1. Opening `/agent` and selecting Fast, Think, or Pro mode.
2. Sending prompts (with optional attachments) and receiving streaming responses.
3. Managing conversations from sidebar history (pin, share, delete).
4. Using Canvas mode for long-form or HTML outputs.

## Key Requirements

### Must Have

- Stable chat API with resilient message extraction.
- Correct provider/model mapping for active model IDs.
- Authenticated persistence for chats and messages.
- Guest-safe behavior (no persistence and restricted advanced modes).
- Daily quota enforcement by mode.
- Sidebar management actions with ownership-safe delete.

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
