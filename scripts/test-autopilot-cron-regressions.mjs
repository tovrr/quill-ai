import { readFileSync } from "node:fs";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

function loadEnvLocal() {
  const text = readFileSync(".env.local", "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const checks = [];
function check(name, passed, detail) {
  checks.push({ name, passed, detail });
}

async function callCron(authHeader) {
  const res = await fetch(`${BASE_URL}/api/autopilot/cron`, {
    method: "POST",
    headers: authHeader ? { authorization: authHeader } : undefined,
  });

  const text = await res.text().catch(() => "");
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return { status: res.status, text, json };
}

const unauth = await callCron();
check("cron rejects missing auth", unauth.status === 401, `status=${unauth.status}`);

const wrongAuth = await callCron("Bearer wrong-secret");
check("cron rejects bad auth", wrongAuth.status === 401, `status=${wrongAuth.status}`);

const cronSecret = process.env.CRON_SECRET;
if (!cronSecret) {
  check("cron authorized path (skipped)", true, "CRON_SECRET missing; skipping authorized cron invocation check");
} else {
  const authorized = await callCron(`Bearer ${cronSecret}`);
  const isSuccess = authorized.status === 200 && typeof authorized.json?.ran === "number";
  check("cron accepts valid auth", isSuccess, `status=${authorized.status} ran=${authorized.json?.ran ?? "n/a"}`);
}

const passed = checks.filter((c) => c.passed).length;
console.log(`\nAutopilot cron regression summary: ${passed}/${checks.length} passed`);
for (const c of checks) {
  console.log(`${c.passed ? "PASS" : "FAIL"}  ${c.name}  -> ${c.detail}`);
}

if (passed !== checks.length) {
  process.exitCode = 1;
}
