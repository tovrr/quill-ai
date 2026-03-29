const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const metricsToken = process.env.API_METRICS_TOKEN ?? "smoke-metrics-token";

async function check(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
  } catch (error) {
    console.error(`[FAIL] ${name}:`, error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

await check("health endpoint returns ok", async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  const body = await res.json();
  if (body?.status !== "ok") throw new Error(`Unexpected health body: ${JSON.stringify(body)}`);
});

await check("chat endpoint rejects empty payload", async () => {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  const requestId = res.headers.get("x-request-id");
  if (!requestId) throw new Error("Missing x-request-id header");
});

await check("image endpoint requires auth", async () => {
  const res = await fetch(`${baseUrl}/api/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "test" }),
  });
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

await check("metrics endpoint is protected and available with token", async () => {
  const unauthorized = await fetch(`${baseUrl}/api/metrics`);
  if (unauthorized.status !== 401) {
    throw new Error(`Expected 401 without token, got ${unauthorized.status}`);
  }

  const authorized = await fetch(`${baseUrl}/api/metrics`, {
    headers: {
      "x-metrics-token": metricsToken,
    },
  });
  if (authorized.status !== 200) {
    throw new Error(`Expected 200 with token, got ${authorized.status}`);
  }

  const body = await authorized.json();
  if (!body?.totals || !body?.routes) {
    throw new Error(`Unexpected metrics payload: ${JSON.stringify(body)}`);
  }
});

console.log("API smoke tests passed.");
