# Quill AI Production Deployment Checklist

## 1) Environment Variables

Required:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET` (high-entropy secret; avoid short hex-only values)
- `BETTER_AUTH_URL`
- `GOOGLE_GENERATIVE_AI_API_KEY`

Optional (feature flags/cost control):

- `OPENROUTER_API_KEY`
- `OPENROUTER_FREE_MODEL`
- `AI_GATEWAY_API_KEY`
- `AI_GATEWAY_BASE_URL` (default: `https://ai-gateway.vercel.sh/v1`)
- `AI_GATEWAY_MODEL_PREFIX` (optional; use when gateway expects provider-prefixed model ids)
- `ALLOW_INMEMORY_RATELIMIT_FALLBACK` (keep unset/false in production to fail closed if Upstash is unavailable)
- `ENABLE_IN_MEMORY_METRICS` (leave unset/false in production unless explicitly debugging)
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

### Release checklist: a change that adds a database column

There is no migration runner: nothing applies a column for you on deploy, and `main` is the release branch.
The Autopilot cron and API read every column of `autopilot_workflow` and `autopilot_run`, so code that
selects a column the database does not have yet breaks Autopilot for every user.

1. Add the SQL for the column under `src/db/migrations/` (additive and idempotent: `ADD COLUMN IF NOT EXISTS`),
   or have `npm run db:push` ready for the same change.
2. **Run the SQL (or `npm run db:push`) on the production database BEFORE merging the pull request.**
   A column that nothing reads yet is harmless; code that reads a missing column is not.
3. Merge, then check `GET /api/autopilot/runs` while signed in, and the next cron run in the Vercel logs.
4. If a release adds an Autopilot column, point `AUTOPILOT_MIGRATION_FILE` in
   `src/lib/autopilot/schema-guard.ts` at the newest SQL file, so the error below names the right one.

If the order was wrong, the Autopilot routes (the cron included) answer `503` with
`code: "autopilot_schema_outdated"` and the SQL file to run, and log `autopilot.schema.outdated` once per failed
request. The rest of the app is not affected. Run the file named in the answer, then retry.

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
