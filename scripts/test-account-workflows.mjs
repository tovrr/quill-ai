import { readFileSync } from "node:fs";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const AUTH_ORIGIN = (process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? BASE_URL).replace(/\/$/, "");

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

const accounts = {
  free: {
    email: "qa.free.local@example.com",
    password: "Test1234!",
    expectedPaid: false,
  },
  paid: {
    email: "qa.paid.local@example.com",
    password: "Test1234!",
    expectedPaid: true,
  },
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

async function signIn({ email, password }) {
  const res = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: AUTH_ORIGIN,
    },
    body: JSON.stringify({ email, password }),
  });

  const text = await res.text();
  const cookie = cookiesFromResponse(res);
  return { ok: res.ok, status: res.status, text, cookie };
}

async function api({ cookie, path, method = "GET", body, timeoutMs = 30000 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    let text = "";
    try {
      text = await res.text();
    } catch {
      text = "";
    }

    return {
      ok: res.ok,
      status: res.status,
      text,
      contentType: res.headers.get("content-type") ?? "",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonMaybe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function clip(text, max = 240) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

const results = [];
function record(name, passed, details) {
  results.push({ name, passed, details });
}

for (const [label, account] of Object.entries(accounts)) {
  const auth = await signIn(account);
  record(`${label}: sign-in`, auth.ok, auth.ok ? `status=${auth.status}` : `status=${auth.status} body=${clip(auth.text)}`);
  if (!auth.ok || !auth.cookie) {
    continue;
  }

  const ent = await api({ cookie: auth.cookie, path: "/api/me/entitlements" });
  const entJson = parseJsonMaybe(ent.text);
  const paidFlag = Boolean(entJson?.canUsePaidModes);
  record(
    `${label}: entitlements`,
    ent.status === 200 && paidFlag === account.expectedPaid,
    `status=${ent.status} canUsePaidModes=${paidFlag} expected=${account.expectedPaid}`
  );

  const usage = await api({ cookie: auth.cookie, path: "/api/me/usage" });
  record(`${label}: usage`, usage.status === 200, `status=${usage.status}`);

  const fastChat = await api({
    cookie: auth.cookie,
    path: "/api/chat",
    method: "POST",
    timeoutMs: 20000,
    body: {
      mode: "fast",
      messages: [{ role: "user", content: `Say hello in one sentence for ${label}.` }],
    },
  });
  record(`${label}: chat fast`, fastChat.status === 200, `status=${fastChat.status} contentType=${fastChat.contentType}`);

  const thinkingChat = await api({
    cookie: auth.cookie,
    path: "/api/chat",
    method: "POST",
    timeoutMs: 20000,
    body: {
      mode: "thinking",
      messages: [{ role: "user", content: `Give me one short idea (${label}).` }],
    },
  });

  const expectedThinkingStatus = label === "free" ? 402 : 200;
  record(
    `${label}: chat thinking gate`,
    thinkingChat.status === expectedThinkingStatus,
    `status=${thinkingChat.status} expected=${expectedThinkingStatus}`
  );

  const preview = await api({
    cookie: auth.cookie,
    path: "/api/preview",
    method: "POST",
    body: {
      files: {
        "main.jsx": "import React from 'react';import { createRoot } from 'react-dom/client';function App(){return <h1>Preview ok</h1>}createRoot(document.getElementById('root')).render(<App />);",
      },
      entry: "main.jsx",
    },
  });
  record(`${label}: preview`, preview.status === 200, `status=${preview.status}`);

  const ragIngest = await api({
    cookie: auth.cookie,
    path: "/api/rag/ingest",
    method: "POST",
    timeoutMs: 30000,
    body: {
      title: `Regression ${label}`,
      content: `Regression content for ${label} account at ${new Date().toISOString()}. Quill supports RAG search.`,
      source: "text",
    },
  });
  const ragIngestJson = parseJsonMaybe(ragIngest.text);
  record(`${label}: rag ingest`, ragIngest.status === 201, `status=${ragIngest.status} chunkCount=${ragIngestJson?.chunkCount ?? "n/a"}`);

  const ragSearch = await api({
    cookie: auth.cookie,
    path: "/api/rag/search",
    method: "POST",
    body: { query: "What does regression content mention?", limit: 3 },
  });
  const ragSearchJson = parseJsonMaybe(ragSearch.text);
  record(
    `${label}: rag search`,
    ragSearch.status === 200,
    `status=${ragSearch.status} results=${Array.isArray(ragSearchJson?.results) ? ragSearchJson.results.length : "n/a"}`
  );

  const wfCreate = await api({
    cookie: auth.cookie,
    path: "/api/autopilot/workflows",
    method: "POST",
    body: {
      name: `Regression ${label}`,
      prompt: "Summarize latest updates",
      cronExpression: "* * * * *",
      timezone: "UTC",
    },
  });
  const wfCreateJson = parseJsonMaybe(wfCreate.text);
  const workflowId = wfCreateJson?.workflow?.id;
  record(`${label}: autopilot create`, wfCreate.status === 201 && Boolean(workflowId), `status=${wfCreate.status} workflowId=${workflowId ?? "none"}`);

  const wfList = await api({ cookie: auth.cookie, path: "/api/autopilot/workflows" });
  record(`${label}: autopilot list`, wfList.status === 200, `status=${wfList.status}`);

  if (workflowId) {
    const wfRun = await api({ cookie: auth.cookie, path: `/api/autopilot/workflows/${workflowId}/run`, method: "POST" });
    record(`${label}: autopilot run`, wfRun.status === 201, `status=${wfRun.status}`);

    const wfPatch = await api({
      cookie: auth.cookie,
      path: `/api/autopilot/workflows/${workflowId}`,
      method: "PATCH",
      body: { status: "paused" },
    });
    record(`${label}: autopilot patch`, wfPatch.status === 200, `status=${wfPatch.status}`);

    const wfDelete = await api({ cookie: auth.cookie, path: `/api/autopilot/workflows/${workflowId}`, method: "DELETE" });
    record(`${label}: autopilot delete`, wfDelete.status === 200, `status=${wfDelete.status}`);
  }

  const runs = await api({ cookie: auth.cookie, path: "/api/autopilot/runs?limit=5" });
  record(`${label}: autopilot runs`, runs.status === 200, `status=${runs.status}`);

  const artifactPost = await api({
    cookie: auth.cookie,
    path: "/api/artifacts/versions",
    method: "POST",
    body: {
      title: `Regression ${label}`,
      artifactType: "page",
      payload: {
        html: "<!doctype html><html><body><h1>ok</h1></body></html>",
      },
    },
  });
  record(`${label}: artifacts create`, artifactPost.status === 201, `status=${artifactPost.status}`);

  const artifactGet = await api({ cookie: auth.cookie, path: "/api/artifacts/versions?limit=5" });
  record(`${label}: artifacts list`, artifactGet.status === 200, `status=${artifactGet.status}`);

  const image = await api({
    cookie: auth.cookie,
    path: "/api/generate-image",
    method: "POST",
    timeoutMs: 60000,
    body: { prompt: `Simple icon for ${label} regression` },
  });
  record(`${label}: image generate`, image.status === 200, `status=${image.status} body=${clip(image.text, 140)}`);
}

const zip = await api({
  path: "/api/export/zip",
  method: "POST",
  body: {
    artifactType: "react-app",
    artifactTitle: "regression",
    files: { "index.js": "console.log('ok')" },
  },
});
record(`public: export zip`, zip.status === 200 && zip.contentType.includes("application/zip"), `status=${zip.status} contentType=${zip.contentType}`);

const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed);

console.log(`\nRegression summary: ${passed}/${results.length} passed`);
for (const r of results) {
  console.log(`${r.passed ? "PASS" : "FAIL"}  ${r.name}  -> ${r.details}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
