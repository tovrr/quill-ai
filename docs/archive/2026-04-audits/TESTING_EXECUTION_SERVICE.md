# Testing the Execution Service

This guide walks you through testing the new execution service abstraction locally.

---

## Quick Test (30 seconds)

### 1. Check Configuration

```bash
# In .env.local, ensure one of:
QUILL_SANDBOX_CONTAINER_ENABLED=true
# OR
EXECUTION_SERVICE_PROVIDER=e2b
E2B_API_KEY=your_key
```

### 2. Run the Test Script

```bash
npm run test:execution
```

**Expected output:**
```
📋 Execution Service Test

────────────────────────────────────────────────────────────

✓ Execution available: YES
✓ Backend: local

Configuration:
  - EXECUTION_SERVICE_PROVIDER: (not set)
  - QUILL_SANDBOX_CONTAINER_ENABLED: true
  - E2B_API_KEY: ✗ NOT SET

────────────────────────────────────────────────────────────

🧪 Running test code: print('hello from sandbox')

────────────────────────────────────────────────────────────

Result:
  ok: true
  exitCode: 0
  stdout: hello from sandbox
  durationMs: 1234ms

────────────────────────────────────────────────────────────

✅ Test PASSED! Execution service is working.
```

---

## Full Integration Test (5 minutes)

### 1. Start Dev Server

```bash
npm run dev
```

Wait for: `✓ ready - started server on 0.0.0.0:3000`

### 2. Open Web App

http://localhost:3000

### 3. Sign In

- Click **Sign up**
- Use guest mode or create test account

### 4. Go to Agent → Code

- Click **Code** (Code Wizard)
- Paste this prompt:

```
Write a Python script that calculates the sum of numbers from 1 to 10.
Then execute it and show the result.
```

### 5. Verify

**Expected:**
- ✅ Code Wizard generates Python code
- ✅ Mentions it has access to a run_code tool
- ✅ Shows execution result in the response
- ✅ Console shows: `stdout: 55` (or similar execution output)

---

## Testing Different Backends

### Local Docker (Default)

```bash
QUILL_SANDBOX_CONTAINER_ENABLED=true
npm run test:execution
```

**Requires:** Docker running locally

### E2B (Recommended for Vercel)

```bash
# Get free API key at https://e2b.dev/keys
EXECUTION_SERVICE_PROVIDER=e2b
E2B_API_KEY=<your_key>
npm run test:execution
```

**Requires:** E2B account (free tier available)

### Modal (Alternative)

```bash
EXECUTION_SERVICE_PROVIDER=modal
MODAL_TOKEN_ID=<your_token>
MODAL_WEBHOOK_URL=https://your-modal-webhook.com
npm run test:execution
```

### Custom Service

```bash
EXECUTION_SERVICE_PROVIDER=custom
EXECUTION_SERVICE_URL=http://localhost:8000
EXECUTION_SERVICE_API_KEY=your_key
npm run test:execution
```

---

## Troubleshooting

### Test says "Execution is disabled"

**Fix:**
```bash
# Option 1: Enable local Docker
QUILL_SANDBOX_CONTAINER_ENABLED=true

# Option 2: Configure E2B
EXECUTION_SERVICE_PROVIDER=e2b
E2B_API_KEY=your_key
```

### Docker error: "Cannot connect to Docker daemon"

**Fix:**
- Start Docker Desktop, OR
- Switch to E2B (no Docker needed)

### E2B error: "401 Unauthorized"

**Fix:**
- Get a fresh API key at https://e2b.dev/keys
- Copy full key (not just the ID)

### Code Wizard says "sandbox not available"

**This is OK!** It means:
- Execution is not enabled in this session
- Code Wizard is being honest and providing manual testing instructions
- To enable: set `QUILL_SANDBOX_CONTAINER_ENABLED=true` and restart dev server

---

## Next Steps

Once testing passes:

1. **Deploy to staging:** Push to GitHub, CI runs tests, deploys to Vercel
2. **Configure Vercel env:** Set `EXECUTION_SERVICE_PROVIDER=e2b` + `E2B_API_KEY`
3. **Test live:** Same steps in staging environment
4. **Integrate Hermes/OpenClaw:** Both agents can now use `executeCode()` from `src/lib/execution/service.ts`

---

## Test Coverage

| Test | What | How |
|---|---|---|
| Unit | Config detection | `npm run test:execution` |
| Integration | Web UI execution | Manual test in browser |
| E2E | Full chat flow | Prompt → Code gen → Execute → Response |
| Production | Staging Vercel | Deploy + test SaaS URLs |

All passing? You're good to merge and ship! 🚀
