# Chat UI Reference Policy

## Intent

Quill adopts external interface patterns selectively to improve readability and execution confidence, without replacing the existing backend orchestration or artifact pipeline.

## Source-of-Truth Principles

1. Gemini-style readability is the benchmark for assistant response presentation.
2. Quill remains a workspace product, not a pure consumer chatbot.
3. Vercel AI SDK + existing Quill chat architecture remains the foundation.

## Policy Rules

1. User prompts can remain bubble-first.
2. Assistant responses should default to workspace reading mode (non-bubble blocks, optional per-message avatar).
3. Status communication should prefer one canonical lane in-thread; avoid duplicate status surfaces by default.
4. Composer controls should prioritize primary actions and demote secondary actions.
5. Action bars should be contextual and low-noise.
6. Focus mode must preserve all functionality while reducing chrome.

## Reference Usage Constraints

1. `assistant-ui` is a pattern and primitive reference, not a mandatory framework swap.
2. `agno-agi/agent-ui` and `chatbot-ui` are UX inspiration sources only.
3. Do not rebase Quill onto a third-party repository unless explicitly approved as an architecture reset.

## Measurement Requirements

Any UI remediation must include instrumentation for:

1. Time to first successful task.
2. Completion rate.
3. Regenerate/retry frequency.
4. Composer misclick rate.
5. Long-response scroll completion.

## Rollout Guidance

1. Ship behind reversible preferences where possible.
2. Keep defaults opinionated, but let users switch layout mode.
3. Log variant and preference state with UI telemetry events.
