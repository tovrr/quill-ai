# Quill AI Production Deployment Checklist

## 1) Environment Variables

Required:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `GOOGLE_GENERATIVE_AI_API_KEY`

Optional (feature flags/cost control):

- `OPENROUTER_API_KEY`
- `OPENROUTER_FREE_MODEL`
- `ALLOW_ALL_AUTH_MODES`
- `PAID_USER_EMAILS`
- `PAID_USER_IDS`
- `FREE_DAILY_MESSAGES` (default: `60`)
- `THINK_DAILY_MESSAGES` (default: `30`)
- `PRO_DAILY_MESSAGES` (default: `100`)
- `API_CHAT_REQUESTS_PER_MINUTE` (default: `20`)
- `API_IMAGE_REQUESTS_PER_MINUTE` (default: `6`)
- `API_METRICS_TOKEN` (required to access `/api/metrics`)
- `BUILDER_LOCAL_VALIDATE_ENABLED` (default: disabled; enables `/api/validate-bundle` temp-workspace install/build validation)

## 2) Pre-Deploy Validation

- `npm install`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## 3) Database Safety Checks

- Confirm schema is current: `npm run db:generate`
- Apply schema updates: `npm run db:push`
- Verify chat/message tables are healthy via Drizzle Studio: `npm run db:studio`

## 4) API Hardening Verification

```bash
# Health
curl -si https://yourdomain.com/api/health | grep -E "HTTP|status"

# Metrics (replace YOUR_TOKEN)
curl -si https://yourdomain.com/api/metrics \
  -H "x-metrics-token: YOUR_TOKEN" | tail -5

# x-request-id echoed back
curl -si -X POST https://yourdomain.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{}' | grep -E "x-request-id|HTTP"

# Rate limit — run in PowerShell: 1..25 | % { curl -s -o NUL -w "%{http_code}\n" -X POST https://yourdomain.com/api/chat -H "Content-Type: application/json" -d '{}' }
```

## 5) Auth and Access Control

- Guest can only use fast mode chat
- Authenticated users default to fast-only unless `ALLOW_ALL_AUTH_MODES=true` or they are listed in `PAID_USER_EMAILS` / `PAID_USER_IDS`
- Paid or allowlisted authenticated users can use fast/think/pro modes
- Share route requires login and ownership
- Chat delete endpoint rejects non-owner requests

## 6) Post-Deploy Smoke Tests

- Start a new chat and confirm streaming response
- Verify guest sees only fast access and paid tiers appear locked in the selector
- Verify a paid or allowlisted user can use fast/think/pro modes
- Generate an image from image mode
- Delete a chat from sidebar and confirm removal
- Open shared route for owned chat and non-owned chat
- Generate a `page` artifact and confirm canvas preview renders
- Generate a `react-app` artifact and confirm live preview sandbox loads
- Generate a `nextjs-bundle` artifact and confirm readiness panel appears
- Download `Export PS` script from canvas and validate it writes project files locally

## 7) Monitoring and Incident Triage

- Log filter by `requestId` to trace a single failing request
- Watch for repeated `rate_limit` or `daily_quota_reached` errors
- Track 500-level errors in `/api/chat` and `/api/generate-image`
