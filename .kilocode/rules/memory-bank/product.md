# Product Context: Quill AI

## Why This Product Exists

Quill AI is a personal AI agent app that combines chat, specialist agents, file inputs, and fast/pro reasoning modes in one workspace. The goal is to give users a practical daily assistant for writing, coding, research, and execution-oriented tasks.

## Problems It Solves

1. **Fragmented AI workflows**: Consolidates chat, model choice, specialist personas, and canvas output in one interface.
2. **Model-cost tradeoffs**: Exposes mode-based experience (Fast, Think, Pro) with quota controls for sustainability.
3. **Weak conversation management**: Provides history, pinning, sharing, and deletion from the sidebar.
4. **Onboarding friction**: Supports guest chat for immediate usage while keeping advanced features behind authentication.
5. **Limited output usability**: Canvas mode renders long-form and HTML output in a review-friendly panel.

## How It Should Work (User Flow)

1. User lands on Quill and can start immediately (guest) or sign in.
2. User opens `/agent`, chooses mode, and sends prompts (optionally with files).
3. Quill streams responses and can route fast mode through a free-cost provider path when configured.
4. User can manage conversations in sidebar: revisit, pin, share, or delete.
5. For complex output, user uses Canvas mode to inspect generated docs/pages.

## Key User Experience Goals

- **Fast first value**: New users can test quickly without setup.
- **Clear mode semantics**: Fast for speed, Think for deeper reasoning, Pro for best quality.
- **Operational reliability**: Valid model routing, robust request parsing, and stable streaming behavior.
- **Trust and control**: Ownership-scoped chat deletion and authenticated history access.

## Current Product Surface

1. **Agent Chat**: Streaming conversation UI with mode picker.
2. **Specialist Agents (Killers)**: Persona/system-prompt driven responses.
3. **History Sidebar**: Fetch, pin, share link, delete with confirmation.
4. **Canvas Panel**: Markdown/HTML preview with copy/download/open actions.
5. **Auth + Persistence**: Better Auth + Drizzle + Neon for user-linked history.
6. **Quota Controls**: Daily mode limits via environment settings.

## Integration Points

- **Primary model provider**: Google Gemini for think/pro and default fallback.
- **Optional fast-mode provider**: OpenRouter via OpenAI-compatible client.
- **Database**: Neon PostgreSQL with Drizzle ORM.
- **Auth**: Better Auth server/client integration.
