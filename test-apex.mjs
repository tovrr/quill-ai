// Apex auth diagnostic script: compares local proxy and direct Apex backend calls.
import { readFileSync, existsSync } from "fs";

function readEnvValue(name) {
  const fromProcess = process.env[name];
  if (typeof fromProcess === "string" && fromProcess.trim().length > 0) {
    return fromProcess.trim();
  }

  if (!existsSync(".env.local")) return "";
  const lines = readFileSync(".env.local", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (key !== name) continue;
    const value = trimmed.slice(idx + 1).trim();
    if (!value) return "";
    return value.replace(/^"|"$/g, "").replace(/^'|'$/g, "");
  }
  return "";
}

async function postJson(url, headers, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  let parsed = raw;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // keep raw text
  }

  return {
    status: response.status,
    ok: response.ok,
    body: parsed,
  };
}

async function run() {
  const baseUrl = readEnvValue("APEX_BASE_URL") || "https://392he1rvqgzavc-8000.proxy.runpod.net";
  const apiKey = readEnvValue("APEX_API_KEY") || readEnvValue("APEX_SECRET_KEY");
  const payload = { question: "Bonjour Apex, qui es-tu?", mots_max: 80 };

  console.log("=== Apex proxy diagnostic ===");
  console.log("Base URL:", baseUrl);
  console.log("API key present:", apiKey ? "yes" : "no");

  console.log("\n1) Local proxy /api/apex/chat");
  const proxyRes = await postJson("http://localhost:3000/api/apex/chat", {}, payload);
  console.log("Status:", proxyRes.status);
  console.log("Body:", JSON.stringify(proxyRes.body, null, 2));

  if (!apiKey) {
    console.log("\nNo API key found in env; skipping direct backend checks.");
    return;
  }

  console.log("\n2) Direct Apex /chat with X-API-Key");
  const xApiRes = await postJson(`${baseUrl}/chat`, { "X-API-Key": apiKey }, payload);
  console.log("Status:", xApiRes.status);
  console.log("Body:", JSON.stringify(xApiRes.body, null, 2));

  console.log("\n3) Direct Apex /chat with Authorization Bearer");
  const bearerRes = await postJson(`${baseUrl}/chat`, { Authorization: `Bearer ${apiKey}` }, payload);
  console.log("Status:", bearerRes.status);
  console.log("Body:", JSON.stringify(bearerRes.body, null, 2));

  const openAiPayload = {
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Bonjour" }],
    max_tokens: 64,
  };

  console.log("\n4) Direct Apex /v1/chat/completions with Authorization Bearer");
  const v1BearerRes = await postJson(
    `${baseUrl}/v1/chat/completions`,
    { Authorization: `Bearer ${apiKey}` },
    openAiPayload,
  );
  console.log("Status:", v1BearerRes.status);
  console.log("Body:", JSON.stringify(v1BearerRes.body, null, 2));

  console.log("\n5) Direct Apex /v1/chat/completions with X-API-Key");
  const v1ApiKeyRes = await postJson(
    `${baseUrl}/v1/chat/completions`,
    { "X-API-Key": apiKey },
    openAiPayload,
  );
  console.log("Status:", v1ApiKeyRes.status);
  console.log("Body:", JSON.stringify(v1ApiKeyRes.body, null, 2));

  console.log("\n6) Main Quill route /api/chat (should use Apex when APEX_CHAT_ENABLED=true)");
  const mainRes = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "Dis juste bonjour" }],
      mode: "fast",
    }),
  });
  const mainText = await mainRes.text();
  console.log("Status:", mainRes.status);
  console.log("Content-Type:", mainRes.headers.get("content-type"));
  console.log("Body preview:", mainText.slice(0, 240));
}

run().catch((error) => {
  console.error("Diagnostic failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
