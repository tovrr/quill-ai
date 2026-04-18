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

const AUTH_ORIGIN = (process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? BASE_URL).replace(/\/$/, "");
const INVALID_ORIGIN = "http://invalid-origin.local";

const accounts = {
  free: { email: "qa.free.local@example.com", password: "Test1234!", expectedPaid: false },
  paid: { email: "qa.paid.local@example.com", password: "Test1234!", expectedPaid: true },
};

function cookiesFromResponse(res) {
  const anyHeaders = res.headers;
  const setCookies = typeof anyHeaders.getSetCookie === "function"
    ? anyHeaders.getSetCookie()
    : (anyHeaders.get("set-cookie") ? [anyHeaders.get("set-cookie")] : []);

  return setCookies
    .filter(Boolean)
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function signIn({ email, password, origin }) {
  const res = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
    },
    body: JSON.stringify({ email, password }),
  });

  const text = await res.text();
  return {
    status: res.status,
    ok: res.ok,
    text,
    cookie: cookiesFromResponse(res),
  };
}

async function call(path, cookie) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
  const text = await res.text().catch(() => "");
  return { status: res.status, text };
}

function parseJsonMaybe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const checks = [];
function check(name, passed, detail) {
  checks.push({ name, passed, detail });
}

const badOrigin = await signIn({
  email: accounts.free.email,
  password: accounts.free.password,
  origin: INVALID_ORIGIN,
});
check(
  "origin protection rejects invalid origin",
  badOrigin.status === 403,
  `status=${badOrigin.status}`
);

const unauthUsage = await call("/api/me/usage");
check("unauth me/usage is blocked", unauthUsage.status === 401, `status=${unauthUsage.status}`);

const unauthWorkflows = await call("/api/autopilot/workflows");
check("unauth autopilot/workflows is blocked", unauthWorkflows.status === 401, `status=${unauthWorkflows.status}`);

for (const [label, account] of Object.entries(accounts)) {
  const auth = await signIn({
    email: account.email,
    password: account.password,
    origin: AUTH_ORIGIN,
  });

  check(`${label} can sign in with trusted origin`, auth.status === 200 && Boolean(auth.cookie), `status=${auth.status}`);

  if (!auth.cookie) continue;

  const ent = await call("/api/me/entitlements", auth.cookie);
  const entJson = parseJsonMaybe(ent.text);
  check(
    `${label} entitlement tier`,
    ent.status === 200 && Boolean(entJson?.canUsePaidModes) === account.expectedPaid,
    `status=${ent.status} canUsePaidModes=${Boolean(entJson?.canUsePaidModes)}`
  );
}

const wrongPassword = await signIn({
  email: accounts.paid.email,
  password: "WrongPass123!",
  origin: AUTH_ORIGIN,
});
check(
  "wrong password is rejected",
  wrongPassword.status >= 400,
  `status=${wrongPassword.status}`
);

const passed = checks.filter((c) => c.passed).length;
console.log(`\nAuth regression summary: ${passed}/${checks.length} passed`);
for (const c of checks) {
  console.log(`${c.passed ? "PASS" : "FAIL"}  ${c.name}  -> ${c.detail}`);
}

if (passed !== checks.length) {
  process.exitCode = 1;
}
