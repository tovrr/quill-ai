# Product Context: Quill AI

## Why This Product Exists

Quill AI is a personal AI agent app that combines chat, specialist agents, file inputs, and fast/pro reasoning modes in one workspace. The goal is to give users a practical daily assistant for writing, coding, research, and execution-oriented tasks.

## Problems It Solves

1. **Fragmented AI workflows**: Consolidates chat, model choice, specialist personas, and canvas output in one interface.
2. **Model-cost tradeoffs**: Exposes mode-based experience (Fast, Think, Pro) with quota controls for sustainability.
3. **Weak conversation management**: Provides history, pinning, sharing, and deletion from the sidebar.
4. **Onboarding friction**: Supports guest chat for immediate usage while keeping advanced features behind authentication.
5. **Limited output usability**: Canvas mode renders long-form and HTML output in a review-friendly panel.
6. **Weak app-generation reliability**: Uses typed builder artifacts, target-aware generation, and export diagnostics for predictable output.

## How It Should Work (User Flow)

1. User lands on Quill and types a task directly in the **hero input** (no login required).
2. Quill redirects to `/agent?q=<task>` and auto-fires the message with a 120ms delay — zero friction.
3. User chooses mode and continues sending prompts (optionally with files).
4. Quill streams responses and can route fast mode through a free-cost provider path when configured.
5. Unauthenticated users are prompted to sign in inside the sidebar history section to save conversations.
6. User can manage conversations in sidebar: revisit, pin, share, or delete.
7. For complex output, user uses Canvas mode to inspect generated docs/pages.
8. For app-building tasks, user selects a builder target (Auto/Page/React/Next.js) and iterates with lock controls.
9. For page artifacts, user can run section-level regenerate actions without rebuilding the entire page.
10. For Next.js bundles, user checks export-readiness diagnostics and can download a setup script for local install/build.
11. Optional local validation can run install/build checks in an isolated temp workspace when enabled.
12. Users can apply customization presets and additional instructions from Settings to influence output style.

## Key User Experience Goals

- **Fast first value**: New users can test quickly without setup.
- **Clear mode semantics**: Fast for speed, Think for deeper reasoning, Pro for best quality.
- **Operational reliability**: Valid model routing, robust request parsing, and stable streaming behavior.
- **Trust and control**: Ownership-scoped chat deletion and authenticated history access.
- **Deterministic build output**: Builder artifacts and target-specific prompts reduce format drift.

## Current Product Surface

1. **Hero Task Input**: Animated typewriter widget on the homepage — submit goes straight to `/agent?q=` without login.
2. **Agent Chat**: Streaming conversation UI with mode picker.
3. **Specialist Agents (Killers)**: Persona/system-prompt driven responses (Code Wizard, Flow Master, Idea Factory, Deep Dive, Pen Master).
4. **History Sidebar**: Fetch, pin, share link, delete with confirmation. Guests see a login CTA in place of history.
5. **Canvas Panel**: Markdown/HTML preview with copy/download/open actions.
6. **Auth + Persistence**: Better Auth + Drizzle + Neon for user-linked history.
7. **Quota Controls**: Daily mode limits via environment settings.
8. **PWA**: `manifest.webmanifest`, apple-touch-icon, and correct quill-feather icons across all sizes — installable but not yet offline-capable.
9. **No-code/Low-code Builder**: Artifact-based outputs for `page`, `react-app`, and `nextjs-bundle` with CSP-safe React preview.
10. **Section-aware Iteration**: Page artifact regenerate actions can target a single section via stable section IDs.
11. **Export Guidance**: Next.js bundle readiness panel and downloadable PowerShell setup script for local validation.
12. **Optional Bundle Validation**: `/api/validate-bundle` can materialize bundles in temp storage and run install/build checks behind env gating.
13. **User Customization Profiles**: Settings-level preset + additional instructions are injected into builder/chat prompt context.

## Integration Points

- **Primary model provider**: Google Gemini for think/pro and default fallback.
- **Optional fast-mode provider**: OpenRouter via OpenAI-compatible client.
- **Database**: Neon PostgreSQL with Drizzle ORM.
- **Auth**: Better Auth server/client integration.
