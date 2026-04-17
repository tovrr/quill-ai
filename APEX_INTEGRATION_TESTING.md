# Apex Integration Testing Guide

## Setup

1. **Configure environment:**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your Apex credentials
   ```

2. **Start dev server:**
   ```bash
   npm run dev
   # Server runs on http://localhost:3000
   ```

3. **Verify TypeScript compilation:**
   ```bash
   npm run typecheck
   ```

## Test Cases

### 1️⃣ Test Chat Endpoint (Synchronous)

**POST** `/api/apex/chat`

**Request:**
```bash
curl -X POST http://localhost:3000/api/apex/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is Python?",
    "mots_max": 100
  }'
```

**Expected Response (200):**
```json
{
  "response": "Python is a high-level programming language...",
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 45
  }
}
```

**Error Cases:**

| Scenario | Command | Expected Status |
|----------|---------|-----------------|
| Empty question | `{"question": ""}` | 400 |
| Missing question | `{"mots_max": 50}` | 400 |
| mots_max > 500 | `{"question": "Hi", "mots_max": 600}` | 400 |
| mots_max < 1 | `{"question": "Hi", "mots_max": 0}` | 400 |
| No API key configured | Request sent without APEX_SECRET_KEY | 500 |
| Backend unreachable | Test against fake URL | 502 |

---

### 2️⃣ Test Stream Endpoint (Server-Sent Events)

**POST** `/api/apex/stream`

**Request (Node.js EventSource):**
```javascript
const eventSource = new EventSource('/api/apex/stream', {
  method: 'POST',
  body: JSON.stringify({
    question: "Explain recursion",
    mots_max: 200
  })
});

eventSource.onmessage = (event) => {
  console.log('Chunk:', event.data);
};

eventSource.onerror = (error) => {
  console.error('Stream error:', error);
  eventSource.close();
};
```

**cURL (SSE stream):**
```bash
curl -X POST http://localhost:3000/api/apex/stream \
  -H "Content-Type: application/json" \
  -d '{"question": "Tell a joke", "mots_max": 150}' \
  -N
  # -N: disables buffering, shows stream in real-time
```

**Expected Output:**
```
data: Recursion is a programming...
data: technique where a function...
data: calls itself...
```

---

### 3️⃣ Security Verification

**Verify API key is NOT exposed to client:**

1. Open DevTools (F12) → Network tab
2. Make a request to `/api/apex/chat`
3. Check Request/Response headers and body
4. **Verify:** No `Authorization` header, no `APEX_SECRET_KEY` visible in Network tab
5. **Verify:** Check browser storage (cookies, localStorage, sessionStorage)
   - No credentials should be stored

**Verify environment variables are isolated:**

```bash
# Check that APEX_SECRET_KEY is NOT in Next.js public config
grep -r "APEX_SECRET_KEY" src/
# Should have 0 results in client-side code
```

---

### 4️⃣ TypeScript Compilation Check

```bash
npm run typecheck
# Should pass with no errors
```

**Expected:**
```
✓ All files passed type checking.
```

---

### 5️⃣ Frontend Integration Test

Once backend routes are working, update frontend to use proxy:

**Before (direct call to Apex):**
```typescript
const response = await fetch(`${apexUrl}/chat`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apexKey}` // ❌ EXPOSED
  },
  body: JSON.stringify({ question })
});
```

**After (via proxy):**
```typescript
const response = await fetch("/api/apex/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ question })
  // ✅ No API key here
});
```

---

## Test Script (PowerShell)

Save as `test-apex-integration.ps1`:

```powershell
# Test Apex Proxy Integration

$BaseUrl = "http://localhost:3000"
$Headers = @{ "Content-Type" = "application/json" }

Write-Host "🧪 Testing Apex Integration..." -ForegroundColor Cyan

# Test 1: Chat endpoint
Write-Host "`n1️⃣ Testing /api/apex/chat..." -ForegroundColor Yellow
$body = @{
    question = "What is TypeScript?"
    mots_max = 100
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/apex/chat" `
        -Method POST `
        -Headers $Headers `
        -Body $body `
        -TimeoutSec 30
    
    Write-Host "✅ Chat endpoint: SUCCESS" -ForegroundColor Green
    Write-Host $response | ConvertTo-Json
} catch {
    Write-Host "❌ Chat endpoint: FAILED" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

# Test 2: Stream endpoint
Write-Host "`n2️⃣ Testing /api/apex/stream..." -ForegroundColor Yellow
$body = @{
    question = "Explain machine learning"
    mots_max = 150
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/apex/stream" `
        -Method POST `
        -Headers $Headers `
        -Body $body `
        -TimeoutSec 30
    
    Write-Host "✅ Stream endpoint: SUCCESS" -ForegroundColor Green
    Write-Host "Response (first 200 chars): $($response.Substring(0, 200))"
} catch {
    Write-Host "❌ Stream endpoint: FAILED" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

# Test 3: Validation (empty question)
Write-Host "`n3️⃣ Testing validation (empty question)..." -ForegroundColor Yellow
$body = @{
    question = ""
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/apex/chat" `
        -Method POST `
        -Headers $Headers `
        -Body $body `
        -TimeoutSec 10
    
    Write-Host "❌ Validation: FAILED (should reject empty question)" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✅ Validation: SUCCESS (correctly rejected)" -ForegroundColor Green
    } else {
        Write-Host "❌ Validation: UNEXPECTED ERROR" -ForegroundColor Red
        Write-Host $_.Exception.Message
    }
}

Write-Host "`n✅ Tests complete!" -ForegroundColor Cyan
```

**Run it:**
```bash
.\test-apex-integration.ps1
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **502 Bad Gateway** | Check `APEX_BASE_URL` and network connectivity to RunPod |
| **400 Bad Request** | Validate JSON payload, check required fields |
| **API key in DevTools** | Ensure `APEX_SECRET_KEY` is in `.env.local`, not `.env` |
| **TypeScript errors** | Run `npm run typecheck`, check type annotations |
| **Stream times out** | Increase `maxDuration` in route.ts if needed |
| **CORS errors** | Check `Access-Control-Allow-Origin` headers in stream route |

---

## Checklist Before Production

- [ ] `.env.local` configured with real `APEX_SECRET_KEY`
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Chat endpoint tested and working
- [ ] Stream endpoint tested and working
- [ ] DevTools shows NO exposed credentials
- [ ] Error handling tested (400, 401, 502, 503, timeout)
- [ ] Frontend refactored to use `/api/apex/*` routes
- [ ] Rate limiting configured (if needed)
- [ ] Monitoring/logging in place for Apex failures
