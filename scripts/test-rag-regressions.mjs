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

const accounts = {
  free: { email: "qa.free.local@example.com", password: "Test1234!" },
  paid: { email: "qa.paid.local@example.com", password: "Test1234!" },
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

async function signIn(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: AUTH_ORIGIN,
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

async function api(path, cookie, method = "GET", body) {
  const maxAttempts = 5;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          ...(cookie ? { cookie } : {}),
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const text = await res.text().catch(() => "");
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }

      return { status: res.status, text, json };
    } catch (error) {
      const directCode =
        error && typeof error === "object" && "code" in error
          ? String((error).code)
          : "";
      const causeCode =
        error && typeof error === "object" && "cause" in error && error.cause && typeof error.cause === "object" && "code" in error.cause
          ? String((error.cause).code)
          : "";
      const code = directCode || causeCode;

      const isRetriable =
        code === "ECONNRESET" ||
        code === "ECONNREFUSED" ||
        code === "ETIMEDOUT" ||
        code === "UND_ERR_SOCKET";
      lastError = error;
      if (!isRetriable || attempt === maxAttempts) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("RAG API request failed");
}

const checks = [];
function check(name, passed, detail) {
  checks.push({ name, passed, detail });
}

const unauthIngest = await api(
  "/api/rag/ingest",
  "",
  "POST",
  { title: "unauth", content: "unauth", source: "text" }
);
check("unauth rag ingest blocked", unauthIngest.status === 401, `status=${unauthIngest.status}`);

const unauthSearch = await api(
  "/api/rag/search",
  "",
  "POST",
  { query: "test" }
);
check("unauth rag search blocked", unauthSearch.status === 401, `status=${unauthSearch.status}`);

for (const [tier, account] of Object.entries(accounts)) {
  const auth = await signIn(account.email, account.password);
  check(`${tier} sign-in`, auth.status === 200 && Boolean(auth.cookie), `status=${auth.status}`);
  if (!auth.cookie) continue;

  const ingest = await api(
    "/api/rag/ingest",
    auth.cookie,
    "POST",
    {
      title: `RAG Regression ${tier}`,
      content: `RAG regression content for ${tier} at ${new Date().toISOString()}. Quill supports semantic retrieval and citations.`,
      source: "text",
    }
  );

  check(
    `${tier} rag ingest`,
    ingest.status === 201 && typeof ingest.json?.chunkCount === "number" && ingest.json.chunkCount > 0,
    `status=${ingest.status} chunkCount=${ingest.json?.chunkCount ?? "n/a"}`
  );

  const search = await api(
    "/api/rag/search",
    auth.cookie,
    "POST",
    { query: "What does the regression document mention?", limit: 3 }
  );

  const resultCount = Array.isArray(search.json?.results) ? search.json.results.length : -1;
  check(
    `${tier} rag search`,
    search.status === 200 && resultCount >= 0,
    `status=${search.status} results=${resultCount >= 0 ? resultCount : "n/a"}`
  );
}

const passed = checks.filter((c) => c.passed).length;
console.log(`\nRAG regression summary: ${passed}/${checks.length} passed`);
for (const c of checks) {
  console.log(`${c.passed ? "PASS" : "FAIL"}  ${c.name}  -> ${c.detail}`);
}

if (passed !== checks.length) {
  process.exitCode = 1;
}
