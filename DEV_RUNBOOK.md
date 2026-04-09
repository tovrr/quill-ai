# Dev Startup Runbook — Quill AI

Local dev (`npm run dev`) can fail intermittently on Windows. This runbook covers the two known root causes and their fixes.

---

## Root Cause A — Stale / Corrupted Turbopack Cache

**Symptoms**
- `npm run dev` exits immediately with exit code 1
- Error contains `Persisting failed: Unable to write SST file` or `EPERM / EBUSY` on `.next/`
- Most routes return 404 except `/`

**Fix (30 seconds)**
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

**Symptoms**
- Dev server starts but crashes on first API call
- Auth routes return 401 for authenticated users
- Rate-limit calls fail with connection errors

**Required `.env.local` keys**

| Variable | Purpose |
|---|---|
| `BETTER_AUTH_SECRET` | Session signing — must match production exactly |
| `DATABASE_URL` | Neon Postgres connection string |
| `GEMINI_API_KEY` | Primary AI model |
| `UPSTASH_REDIS_REST_URL` | Rate limiting (optional; falls back to in-memory) |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting token |
| `OPENROUTER_API_KEY` | Free fast-model fallback (optional) |

**Check**
```powershell
# Verify .env.local exists and has the critical keys
Select-String -Path .env.local -Pattern "BETTER_AUTH_SECRET|DATABASE_URL|GEMINI_API_KEY"
```

---

## Root Cause C — Port Already in Use

**Symptoms**
- `Error: listen EADDRINUSE :::3000`
- Previous dev server process left running

**Fix**
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
- [ ] `localhost:3000` opens and responds
- [ ] `/agent` route loads without 404
- [ ] `/api/health` returns `{ "status": "ok" }`

---

## Additional Notes

- `BETTER_AUTH_SECRET` must be **identical** in `.env.local` and in your Vercel/production env vars. A mismatch causes silent 401s for authenticated users.
- Vercel production pricing env vars still need to be configured (see `src/lib/model-usage.ts` for expected var names).
- If TypeScript errors appear after cache clear, run `npm run typecheck` to verify — they are usually pre-existing and not caused by the cache wipe.
