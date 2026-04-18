# Dev Startup Runbook — Quill AI

Local dev (`npm run dev`) can fail intermittently on Windows. This runbook covers the two known root causes and their fixes.

---

## Root Cause A — Stale / Corrupted Turbopack Cache

### Symptoms (Root Cause A)

- `npm run dev` exits immediately with exit code 1
- Error contains `Persisting failed: Unable to write SST file` or `EPERM / EBUSY` on `.next/`
- Most routes return 404 except `/`

### Fix (30 seconds)

```powershell
# Stop any existing dev server first
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
# Delete the cache
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
# Restart
npm run dev
```

---

## Root Cause B — Missing or Wrong Environment Variables

### Symptoms (Root Cause B)

- Dev server starts but crashes on first API call
- Auth routes return 401 for authenticated users
- Rate-limit calls fail with connection errors

### Required `.env.local` keys

| Variable | Purpose |
| --- | --- |
| `BETTER_AUTH_SECRET` | Session signing — must match production exactly |
| `DATABASE_URL` | Neon Postgres connection string |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Primary AI model |
| `UPSTASH_REDIS_REST_URL` | Rate limiting (optional; falls back to in-memory) |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting token |
| `OPENROUTER_API_KEY` | Free fast-model fallback (optional) |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway key for OpenAI-compatible model routing (optional) |
| `AI_GATEWAY_BASE_URL` | Gateway base URL (optional; defaults to `https://ai-gateway.vercel.sh/v1`) |
| `AI_GATEWAY_MODEL_PREFIX` | Optional model-id prefix for gateway routing, e.g. `openrouter/` |
| `ALLOW_INMEMORY_RATELIMIT_FALLBACK` | Allows local rate-limit fallback when Upstash is unavailable (`true` by default outside production) |
| `ENABLE_IN_MEMORY_METRICS` | Enables `/api/metrics` in production (`false` by default in production) |

### Check

```powershell
# Verify .env.local exists and has the critical keys
Select-String -Path .env.local -Pattern "BETTER_AUTH_SECRET|DATABASE_URL|GOOGLE_GENERATIVE_AI_API_KEY"
```

---

## Root Cause C — Port Already in Use

### Symptoms (Root Cause C)

- `Error: listen EADDRINUSE :::3000`
- Previous dev server process left running

### Fix

```powershell
# Find and kill whatever is on port 3000
$pid = (netstat -aon | Select-String ":3000" | Select-Object -First 1) -replace '.*\s+(\d+)$','$1'
if ($pid) { Stop-Process -Id $pid.Trim() -Force }
npm run dev
```

---

## One-Command Recovery Script

Save this as `scripts/dev-reset.ps1` and run whenever dev fails:

```powershell
# scripts/dev-reset.ps1
Write-Host "Stopping node processes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 500

Write-Host "Clearing .next cache..." -ForegroundColor Yellow
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

Write-Host "Starting dev server..." -ForegroundColor Green
npm run dev
```

```powershell
# Usage:
powershell -ExecutionPolicy Bypass -File scripts/dev-reset.ps1
```

---

## Acceptance Criteria

- [ ] `npm run dev` starts without error after running the recovery script

---

## Testing Execution Service

After dev server is running, verify code execution is working:

### Quick Test (30s)

```bash
npm run test:execution
```

If it says `✅ Test PASSED`, code execution is enabled and working.

### Full Integration Test (5m)

1. Open http://localhost:3000
2. Sign in
3. Click **Agent** → **Code** (Code Wizard)
4. Paste this prompt:

```
Write a Python script that calculates 2 + 2, then execute it.
```

**Expected:** You see the Code Wizard execute the code and show the result (4).

### If execution says "disabled"

Set one of these in `.env.local`:

```bash
# Option 1: Local Docker (requires Docker running)
QUILL_SANDBOX_CONTAINER_ENABLED=true

# Option 2: E2B (no Docker needed, free tier available)
EXECUTION_SERVICE_PROVIDER=e2b
E2B_API_KEY=your_api_key
```

Then restart: `npm run dev`

See [TESTING_EXECUTION_SERVICE.md](./TESTING_EXECUTION_SERVICE.md) for full details and troubleshooting.
- [ ] `localhost:3000` opens and responds
- [ ] `/agent` route loads without 404
- [ ] `/api/health` returns `{ "status": "ok" }`

---

## Additional Notes

- `BETTER_AUTH_SECRET` must be **identical** in `.env.local` and in your Vercel/production env vars. A mismatch causes silent 401s for authenticated users.
- Vercel production pricing env vars still need to be configured (see `src/lib/observability/metrics.ts` for expected var names).
- If TypeScript errors appear after cache clear, run `npm run typecheck` to verify — they are usually pre-existing and not caused by the cache wipe.
