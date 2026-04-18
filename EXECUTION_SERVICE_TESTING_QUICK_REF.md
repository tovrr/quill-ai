# Execution Service Testing — Quick Reference

## TL;DR — Start Testing Now

```bash
# 1. Ensure .env.local has one of:
#    QUILL_SANDBOX_CONTAINER_ENABLED=true (+ Docker running)
#    OR
#    EXECUTION_SERVICE_PROVIDER=e2b + E2B_API_KEY

# 2. Test it works
npm run test:execution

# 3. See it working live
npm run dev
# Then: http://localhost:3000 → Agent → Code → paste: "calculate 2+2"
```

---

## What You Built

**Problem:** Code execution was hardcoded to Docker. Vercel production would fail silently.

**Solution:** Abstracted execution into a service layer that supports:
- ✅ Local Docker (development)
- ✅ E2B (managed, no Docker needed)
- ✅ Modal (serverless)
- ✅ Custom API (self-hosted)

**Files Created/Modified:**

| File | Purpose |
|---|---|
| `src/lib/execution/service.ts` | Core abstraction layer (new) |
| `src/app/api/chat/route.ts` | Uses execution-service instead of docker-executor (modified) |
| `src/lib/chat/policy-runtime.ts` | Uses `isExecutionAvailable()` (modified) |
| `scripts/test-execution-service.mjs` | Quick validation script (new) |
| `.env.example` | Documented all execution config options (modified) |
| `MULTI_AGENT_INTEGRATION.md` | How Hermes/OpenClaw use it (new) |
| `TESTING_EXECUTION_SERVICE.md` | Full testing guide (new) |
| `DEV_RUNBOOK.md` | Added execution service testing section (modified) |
| `README.md` | Added test:execution to build checklist (modified) |
| `package.json` | Added `test:execution` npm script (modified) |

---

## How to Test

### Fastest: 30-Second Validation

```bash
npm run test:execution
```

Expected: `✅ Test PASSED! Execution service is working.`

### Full: Manual Testing in Web UI

1. `npm run dev`
2. Open http://localhost:3000
3. Agent → Code
4. Paste: `print("hello")`
5. Verify output appears in response

### By Backend

| Backend | Command |
|---|---|
| Local Docker | `QUILL_SANDBOX_CONTAINER_ENABLED=true npm run test:execution` |
| E2B | `EXECUTION_SERVICE_PROVIDER=e2b E2B_API_KEY=your_key npm run test:execution` |
| Modal | `EXECUTION_SERVICE_PROVIDER=modal MODAL_TOKEN_ID=your_token npm run test:execution` |

---

## Common Issues & Fixes

| Issue | Fix |
|---|---|
| "Execution is disabled" | Set `QUILL_SANDBOX_CONTAINER_ENABLED=true` or configure E2B |
| "Docker not running" | Start Docker Desktop OR switch to E2B (no Docker needed) |
| "E2B 401 Unauthorized" | Get fresh API key from https://e2b.dev/keys |
| Code Wizard says "sandbox not available" | This is correct! It means execution is safely disabled |

---

## What Happens When You Test

```
Input: "execute print(2+2)"
         ↓
     Code Wizard generates code + system prompt
         ↓
     Check execution availability
         ↓
     If available: execute in E2B/Docker/etc
     If not available: provide manual testing instructions
         ↓
     Stream response to user
```

---

## Next: Deploy to Production

1. **Staging:** Set `EXECUTION_SERVICE_PROVIDER=e2b` in Vercel env
2. **Test:** Same manual test as above
3. **Production:** Same settings, monitor E2B usage
4. **Multi-agent:** Hermes/OpenClaw import `src/lib/execution/service` → everything works

---

## Architecture Recap

```
Quill AI / Hermes / OpenClaw
              ↓
    execution/service.ts
              ↓
     ["local" | "e2b" | "modal" | "custom"]
              ↓
        [Real execution happens]
              ↓
     Return { ok, stdout, stderr, exitCode }
```

All agents use the same library, same config, same endpoint. Single source of truth.

---

**Ready to test? Run `npm run test:execution` now!**
