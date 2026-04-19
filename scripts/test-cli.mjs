#!/usr/bin/env node
/**
 * Test suite for the Quill CLI backend (/api/cli/chat)
 * Run: node scripts/test-cli.mjs [--url http://localhost:3000] [--key quill-dev-local-key]
 */

const BASE_URL = process.argv.find((a) => a.startsWith("--url="))?.slice(6) ??
  process.env.QUILL_URL ?? "http://localhost:3000";
const CLI_KEY = process.argv.find((a) => a.startsWith("--key="))?.slice(6) ??
  process.env.QUILL_CLI_KEY ?? "quill-dev-local-key";

const ENDPOINT = `${BASE_URL}/api/cli/chat`;

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`[PASS] ${label}`);
  passed++;
}

function fail(label, reason) {
  console.error(`[FAIL] ${label}: ${reason}`);
  failed++;
}

async function callCli({ key = CLI_KEY, body, expectStatus }) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, res };
}

/** Collect all SSE events from a streaming response */
async function collectSSE(res) {
  const decoder = new TextDecoder();
  let buffer = "";
  const events = [];
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try { events.push(JSON.parse(line.slice(6))); } catch { /* skip */ }
      }
    }
  }
  return events;
}

// ─── Test 1: No auth header → 401 ────────────────────────────────────────────
async function testNoAuth() {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
  });
  if (res.status === 401) ok("no auth → 401");
  else fail("no auth → 401", `got ${res.status}`);
}

// ─── Test 2: Wrong key → 401 ──────────────────────────────────────────────────
async function testWrongKey() {
  const { status } = await callCli({ key: "wrong-key", body: { messages: [{ role: "user", content: "hi" }] } });
  if (status === 401) ok("wrong key → 401");
  else fail("wrong key → 401", `got ${status}`);
}

// ─── Test 3: Empty messages → 400 ────────────────────────────────────────────
async function testEmptyMessages() {
  const { status } = await callCli({ body: { messages: [] } });
  if (status === 400) ok("empty messages → 400");
  else fail("empty messages → 400", `got ${status}`);
}

// ─── Test 4: Missing messages field → 400 ────────────────────────────────────
async function testMissingMessages() {
  const { status } = await callCli({ body: { mode: "fast" } });
  if (status === 400) ok("missing messages → 400");
  else fail("missing messages → 400", `got ${status}`);
}

// ─── Test 5: Invalid mode is coerced to fast (not 400) ───────────────────────
async function testInvalidModeCoerced() {
  const { status, res } = await callCli({ body: { messages: [{ role: "user", content: "say the word PONG and nothing else" }], mode: "invalid-mode" } });
  if (status === 200) {
    const events = await collectSSE(res);
    const hasText = events.some((e) => e.type === "text");
    const hasDone = events.some((e) => e.type === "done");
    if (hasText && hasDone) ok("invalid mode coerced to fast → 200 with stream");
    else fail("invalid mode coerced to fast", `events: ${JSON.stringify(events.slice(0, 3))}`);
  } else {
    fail("invalid mode coerced to fast → 200", `got ${status}`);
  }
}

// ─── Test 6: Valid one-shot query streams text + done ─────────────────────────
async function testValidStream() {
  const { status, res } = await callCli({ body: { messages: [{ role: "user", content: "Reply with only the word PONG" }] } });
  if (status !== 200) {
    fail("valid stream → 200", `got ${status}`);
    return;
  }
  const events = await collectSSE(res);
  const textEvents = events.filter((e) => e.type === "text");
  const doneEvent = events.find((e) => e.type === "done");
  const fullText = textEvents.map((e) => e.delta).join("");

  if (textEvents.length === 0) fail("stream has text events", "no text events received");
  else ok("stream has text events");

  if (doneEvent) ok("stream ends with done event");
  else fail("stream ends with done event", "no done event");

  if (fullText.length > 0) ok(`stream text is non-empty (got: "${fullText.slice(0, 60).trim()}")`);
  else fail("stream text is non-empty", "empty text");
}

// ─── Test 7: Multi-turn conversation ─────────────────────────────────────────
async function testMultiTurn() {
  const { status, res } = await callCli({
    body: {
      messages: [
        { role: "user", content: "My name is TestBot42." },
        { role: "assistant", content: "Hello TestBot42!" },
        { role: "user", content: "What is my name?" },
      ],
    },
  });
  if (status !== 200) {
    fail("multi-turn → 200", `got ${status}`);
    return;
  }
  const events = await collectSSE(res);
  const fullText = events.filter((e) => e.type === "text").map((e) => e.delta).join("").toLowerCase();
  if (fullText.includes("testbot42")) ok("multi-turn conversation remembers context");
  else fail("multi-turn conversation remembers context", `response was: "${fullText.slice(0, 100)}"`);
}

// ─── Test 8: Response headers are SSE ────────────────────────────────────────
async function testSSEHeaders() {
  const { status, res } = await callCli({ body: { messages: [{ role: "user", content: "hi" }] } });
  if (status !== 200) { fail("SSE headers check", `got status ${status}`); return; }
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("text/event-stream")) ok("content-type is text/event-stream");
  else fail("content-type is text/event-stream", `got: ${ct}`);
  // drain to avoid hanging
  await res.body?.cancel?.();
}

// ─── Run all ──────────────────────────────────────────────────────────────────
console.log(`\nTesting Quill CLI endpoint: ${ENDPOINT}\n`);

await testNoAuth();
await testWrongKey();
await testEmptyMessages();
await testMissingMessages();
await testSSEHeaders();
await testInvalidModeCoerced();
await testValidStream();
await testMultiTurn();

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
