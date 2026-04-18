# Claude Integration Guide

Purpose: document how Quill AI integrates with Anthropic Claude models (or OpenRouter-backed Anthropic proxies), required env vars, usage examples, and security/cost guidance.

Quick notes

- Preferred env var: `ANTHROPIC_API_KEY` for direct Anthropic access. If using OpenRouter, use `OPENROUTER_API_KEY` and set provider to an Anthropic-backed model.
- Keep keys out of source control; use `.env` and secrets in CI.

Environment

- `ANTHROPIC_API_KEY` — your Anthropic API key (recommended when calling Anthropic directly).
- `OPENROUTER_API_KEY` — optional, when routing through OpenRouter.
- `CLAUDE_MODEL` — optional, model id to use (e.g., `claude-2.1`, `claude-instant-1`). Default: `claude-2.1`.

Example: simple curl (Anthropic)

```bash
curl https://api.anthropic.com/v1/complete \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-2.1","prompt":"Say hello","max_tokens":200}'
```

Example: Node fetch (OpenRouter)

```js
const res = await fetch("https://api.openrouter.ai/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ model: "anthropic/claude-2.1", messages: [{ role: "user", content: "Hello" }] }),
});
const data = await res.json();
```

Integration tips for this repo

- Add a light wrapper at `src/lib/integrations/claude.ts` that normalises request/response shapes with other provider wrappers (OpenAI, Gemini, etc.).
- Wire the wrapper into `src/lib/chat/model-selection.ts` so `CLAUDE_MODEL` maps correctly and quota/cost attribution uses `modelUsage` records.
- Respect the project's streaming and two-pass builder patterns: support both streaming and non-streaming completions and apply the same prompt-sanitization used elsewhere.

Cost controls & rate limits

- Configure per-model rate limiting and monetary budget alerts in infra (GCP/AWS billing or third-party). Treat Claude calls as billable — guard with `qualityRetryThreshold` and max retry caps set in builder runtime.

Security & policy

- Sanitize web search and third-party content before interpolation into system prompts (same rules applied across providers).
- Never log full prompts that contain user-provided secrets or API keys.
- For PII-sensitive usages, consider post-generation PII redaction before persisting responses.

References

- Anthropic API docs: https://www.anthropic.com/docs/
- OpenRouter: https://docs.openrouter.ai/

If you want, I can scaffold `src/lib/integrations/claude.ts` with a minimal wrapper and add it to `model-selection` mapping.
