# Multi-Agent Integration Guide

This document describes how Quill AI, Agent Hermes, OpenClaw, and other agents can share a centralized code execution service.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Multi-Agent System                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │   Quill AI       │  │  Agent Hermes    │                │
│  │  (Web App)       │  │  (Research)      │                │
│  └────────┬─────────┘  └────────┬─────────┘                │
│           │                     │                            │
│           │   HTTP POST         │                            │
│           │   executes to:      │                            │
│           │   /execute          │                            │
│           │                     │                            │
│           └──────────┬──────────┘                            │
│                      │                                        │
│  ┌──────────────┐    │    ┌──────────────────┐             │
│  │  OpenClaw    │    │    │  (Other Agents)  │             │
│  │ (Autonomous) ├────┼────┤  (Future)        │             │
│  └──────────────┘    │    └──────────────────┘             │
│                      │                                        │
│           ┌──────────▼──────────┐                            │
│           │ Execution Service   │                            │
│           │ (E2B / Modal / GPU) │                            │
│           └─────────────────────┘                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Benefits:**
- ✅ Single cost center & API quota tracking
- ✅ Unified sandboxing policy
- ✅ Shared version control for Python / Node runtimes
- ✅ Easy audit trail (all execution goes through one endpoint)
- ✅ Scales without per-agent infrastructure

---

## Integration Paths

### Path 1: All Agents Use Local Docker (Development Only)

**Best for:** Local testing, all agents running on one machine with Docker installed.

**Configuration:**

```bash
# In each agent's .env.local:
QUILL_SANDBOX_CONTAINER_ENABLED=true
# No EXECUTION_SERVICE_PROVIDER needed
```

**Limitations:**
- Only works on machines with Docker
- Not suitable for Vercel/serverless production
- Quota/cost tracking per-agent (no shared ledger)

---

### Path 2: All Agents Use E2B (Recommended for Production)

**Best for:** Production deployments, Vercel edge, multi-agent orchestration.

E2B provides:
- Managed Python sandbox (no Docker required)
- Automatic scaling
- Cross-origin request support
- Free tier available for startups

**Setup:**

1. **Create E2B account** at https://e2b.dev
2. **Get API key** from https://e2b.dev/keys
3. **Create a shared `.env` for all agents:**

```bash
EXECUTION_SERVICE_PROVIDER=e2b
E2B_API_KEY=your_e2b_api_key_here
```

4. **In Quill AI** (`src/lib/execution-service.ts`):
   - It already routes to E2B if `EXECUTION_SERVICE_PROVIDER=e2b`
   - All `POST /api/chat` requests with code execution will use E2B

5. **In Agent Hermes / OpenClaw**, import and call:
```typescript
import { executeCode } from "@/lib/execution-service";

const result = await executeCode({
  code: "print('hello')",
  language: "python",
  timeoutMs: 10000,
});
```

**Cost:** E2B free tier includes ~50 CPUs/hour/month. Paid tier is $0.15 per CPU-hour.

---

### Path 3: Self-Hosted Execution Service (Advanced)

**Best for:** Complete control, on-premise deployments, custom runtimes.

**Architecture:**

```
Quill AI / Hermes / OpenClaw
           ↓ (POST /execute)
┌──────────────────────────────┐
│   Your Execution API         │
│   (Node.js / Python / Go)    │
├──────────────────────────────┤
│ - Auth via bearer token      │
│ - Request body: code, lang   │
│ - Spawn Docker / VM sandbox  │
│ - Return stdout/stderr       │
└──────────────────────────────┘
```

**Configuration:**

```bash
EXECUTION_SERVICE_PROVIDER=custom
EXECUTION_SERVICE_URL=https://executor.mycompany.com
EXECUTION_SERVICE_API_KEY=your_secret_api_key
```

**Example minimal implementation (Python Flask):**

```python
from flask import Flask, request, jsonify
import subprocess

app = Flask(__name__)

@app.route("/execute", methods=["POST"])
def execute():
    auth_token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if auth_token != os.getenv("EXECUTOR_API_KEY"):
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    code = data.get("code", "")
    language = data.get("language", "python")
    timeout = data.get("timeoutMs", 15000) / 1000

    try:
        result = subprocess.run(
            [language, "-c", code],
            capture_output=True,
            text=True,
            timeout=timeout
        )
        return jsonify({
            "ok": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exitCode": result.returncode,
            "durationMs": 0,
        })
    except subprocess.TimeoutExpired:
        return jsonify({
            "ok": False,
            "error": "Execution timeout",
            "exitCode": 124,
            "stdout": "",
            "stderr": "",
            "durationMs": int(timeout * 1000),
        })
```

---

## Implementation Checklist

### For Quill AI (Already Done ✅)

- [x] `src/lib/execution-service.ts` — Abstraction layer with E2B/Modal/custom support
- [x] `src/app/api/chat/route.ts` — Updated to import from `execution-service`
- [x] `src/lib/chat/policy-runtime.ts` — Uses `isExecutionAvailable()`
- [x] `.env.example` — Documented execution service config
- [ ] `/api/admin/execution-stats` — Track per-agent execution usage (optional)

### For Agent Hermes

- [ ] Import `executeCode` from shared execution service
- [ ] Set `EXECUTION_SERVICE_PROVIDER` in production `.env`
- [ ] Call `executeCode({ code, language, timeoutMs })` when needed
- [ ] Handle E2B timeouts gracefully

### For OpenClaw

- [ ] Same as Agent Hermes
- [ ] Consider autonomy levels: should all execution requests go through checkpoints?
- [ ] Track execution cost for billing/metering

---

## Production Deployment Workflow

### Step 1: Choose Execution Provider

**For simplicity + managed service:** Use E2B

```bash
# Vercel environment variables:
EXECUTION_SERVICE_PROVIDER = e2b
E2B_API_KEY = <your-e2b-api-key>
```

### Step 2: Verify All Agents Can Execute

```bash
# Test Quill AI
curl -X POST https://quill-ai.example.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{ "role": "user", "content": "print(2 + 2)" }],
    "mode": "fast"
  }'

# Agent Hermes should test similarly
# OpenClaw can execute directly via shared library
```

### Step 3: Set Up Monitoring

```bash
# Optional: add execution latency tracking to /api/metrics
# Count execution requests per agent + success/failure rates
# Alert on timeout spikes
```

### Step 4: Scale

E2B scales automatically. If you hit limits:
- E2B: upgrade plan at https://e2b.dev/pricing
- Modal: similar per-tier scaling
- Custom: add more executor instances

---

## Troubleshooting

### "Code execution is disabled"

**Cause:** Neither local sandbox nor remote service is configured.

**Fix:**
```bash
# Either enable local:
QUILL_SANDBOX_CONTAINER_ENABLED=true

# Or configure remote:
EXECUTION_SERVICE_PROVIDER=e2b
E2B_API_KEY=your_key
```

### E2B API returns 401

**Cause:** API key is invalid or expired.

**Fix:**
```bash
# Verify key at https://e2b.dev/keys
# Rotate if needed
E2B_API_KEY=<new-key>
```

### Code execution times out

**Cause:** Complex code, infinite loop, or network congestion.

**Fix:**
```bash
# Increase timeout (in ai.tool() definition):
timeoutMs: 30_000  // 30s instead of 15s

# Or optimize code to run faster
```

---

## Cost Analysis

| Provider | Monthly Free | Paid Tier | Best For |
|---|---|---|---|
| **Local Docker** | ∞ | N/A | Development only |
| **E2B** | ~50 CPU-hrs | $0.15/CPU-hr | Production, single sandbox |
| **Modal** | $5 free tier | Pay-as-you-go | Flexible workloads |
| **Self-hosted** | ∞ (infra cost) | Custom | On-premise, high volume |

**Recommendation for 3-agent system:**
- Development: Local Docker
- Staging: E2B free tier
- Production: E2B paid tier (~$100/month for moderate usage)

---

## Next: Real-Time Collaboration

Once execution is unified, you can add:

1. **Shared execution log** — all agents log to same table
2. **Cost attribution** — track which agent spent how much
3. **Dependency management** — shared Python environments for all agents
4. **Audit trail** — who executed what code when, with results

See `docs/decisions/` for related architectural decisions.
