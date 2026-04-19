#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const failures = [];

function readText(relPath) {
  const p = path.join(repoRoot, relPath);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}

function run(cmd) {
  return execSync(cmd, { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] }).toString("utf8");
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

try {
  const status = run("git status --porcelain");
  const changedNodeModules = status
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /(^..\s+node_modules\/)|(^\?\?\s+node_modules\/)/.test(line));

  assert(
    changedNodeModules.length === 0,
    `Guardrail violation: do not commit changes under node_modules/. Found: ${changedNodeModules.join(", ")}`,
  );
} catch {
  failures.push("Guardrail check could not read git status.");
}

const postcssConfig = readText("postcss.config.mjs");
assert(
  postcssConfig.includes('plugins: ["@tailwindcss/postcss"]'),
  'Guardrail violation: postcss.config.mjs must use plugins: ["@tailwindcss/postcss"].',
);

const globalsCss = readText("src/app/globals.css");
assert(
  globalsCss.includes('@import "tailwindcss";'),
  'Guardrail violation: src/app/globals.css must include @import "tailwindcss";.',
);
assert(
  globalsCss.includes("@theme"),
  "Guardrail violation: src/app/globals.css must use @theme (Tailwind v4 pattern).",
);

const pkgRaw = readText("package.json");
let pkg;
try {
  pkg = JSON.parse(pkgRaw);
} catch {
  failures.push("Guardrail check could not parse package.json.");
}

if (pkg) {
  const scripts = pkg.scripts || {};
  const scriptValues = Object.values(scripts).map((v) => String(v));
  const hasDebugBindingScript = scriptValues.some((v) => v.includes("install-native-bindings"));

  assert(
    !hasDebugBindingScript,
    "Guardrail violation: temporary native binding debug hooks (install-native-bindings) must not be present in package scripts.",
  );
}

if (failures.length > 0) {
  console.error("\nGuardrail checks failed:\n");
  for (const f of failures) {
    console.error(`- ${f}`);
  }
  console.error("\nFix these issues before merging.\n");
  process.exit(1);
}

console.log("Guardrail checks passed.");
