const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";

async function check(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
  } catch (error) {
    console.error(`[FAIL] ${name}:`, error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

await check("chat endpoint rejects empty payload", async () => {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (res.status !== 400) {
    throw new Error(`Expected 400, got ${res.status}`);
  }

  const requestId = res.headers.get("x-request-id");
  if (!requestId) {
    throw new Error("Expected x-request-id header");
  }
});

await check("guest cannot access thinking mode", async () => {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "thinking",
      messages: [{ role: "user", content: "hi" }],
    }),
  });

  if (res.status !== 401) {
    throw new Error(`Expected 401, got ${res.status}`);
  }
});

await check("fast mode streams a non-empty chatbot response", async () => {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "fast",
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
    }),
  });

  if (res.status !== 200) {
    throw new Error(`Expected 200, got ${res.status}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    throw new Error(`Expected event stream response, got ${contentType}`);
  }

  const requestId = res.headers.get("x-request-id");
  if (!requestId) {
    throw new Error("Expected x-request-id header");
  }

  const text = await res.text();
  if (!text || text.trim().length === 0) {
    throw new Error("Chat response stream was empty");
  }

  if (!text.includes("text-delta")) {
    throw new Error("Expected stream to include text-delta chunks");
  }
});

console.log("Chatbot integration tests passed.");
