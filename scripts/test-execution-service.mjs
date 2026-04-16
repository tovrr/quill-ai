#!/usr/bin/env node

/**
 * Quick test script for execution service abstraction.
 * 
 * Validates:
 * - Local Docker execution (if enabled)
 * - E2B execution (if configured)
 * - Graceful fallback when execution is disabled
 * 
 * Usage:
 *   node scripts/test-execution-service.mjs
 */

import { executeCode as executeLocal, isSandboxEnabled } from "../src/lib/docker-executor.ts";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadDotEnvLocal();

  console.log("\n📋 Execution Service Test\n");
  console.log("─".repeat(60));

  // Check configuration
  const provider = process.env.EXECUTION_SERVICE_PROVIDER || "";
  const backend = provider || (isSandboxEnabled() ? "local" : "disabled");
  const available = backend !== "disabled";

  console.log(`\n✓ Execution available: ${available ? "YES" : "NO"}`);
  console.log(`✓ Backend: ${backend}`);
  console.log("\nConfiguration:");
  console.log(`  - EXECUTION_SERVICE_PROVIDER: ${provider || "(not set)"}`);
  console.log(`  - QUILL_SANDBOX_CONTAINER_ENABLED: ${process.env.QUILL_SANDBOX_CONTAINER_ENABLED || "(not set)"}`);
  console.log(`  - E2B_API_KEY: ${process.env.E2B_API_KEY ? "✓ SET" : "✗ NOT SET"}`);

  console.log("\n─".repeat(60));

  if (!available) {
    console.log("\n⚠️  Execution is disabled. To test, set one of:");
    console.log("   1. QUILL_SANDBOX_CONTAINER_ENABLED=true (requires Docker)");
    console.log("   2. EXECUTION_SERVICE_PROVIDER=e2b with E2B_API_KEY (no Docker needed)");
    process.exit(1);
  }

  if (provider && !isSandboxEnabled()) {
    console.log("\nℹ️ Remote execution provider is configured.");
    console.log("This script validates local Docker execution only.");
    console.log("Use the app flow (/agent -> Code) to validate remote provider execution.\n");
    process.exit(0);
  }

  console.log("\n🧪 Running test code: print('hello from sandbox')");
  console.log("\n─".repeat(60) + "\n");

  const result = await executeLocal({
    code: 'print("hello from sandbox")',
    language: "python",
    timeoutMs: 10000,
  });

  console.log("Result:");
  console.log(`  ok: ${result.ok}`);
  console.log(`  exitCode: ${result.exitCode}`);
  console.log(`  stdout: ${result.stdout || "(empty)"}`);
  if (result.stderr) console.log(`  stderr: ${result.stderr}`);
  if (result.error) console.log(`  error: ${result.error}`);
  console.log(`  durationMs: ${result.durationMs}ms`);

  console.log("\n─".repeat(60));

  if (result.ok && result.stdout.includes("hello from sandbox")) {
    console.log("\n✅ Test PASSED! Execution service is working.\n");
    process.exit(0);
  } else {
    console.log("\n❌ Test FAILED! Check the output above.\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
