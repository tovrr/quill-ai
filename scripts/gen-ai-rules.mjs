#!/usr/bin/env node
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const canonical = path.join(ROOT, "AGENTS.md");
const claudeOut = path.join(ROOT, "CLAUDE.md");
const cursorOut = path.join(ROOT, ".cursorrules");

if (!fs.existsSync(canonical)) {
  console.error("Canonical rules file AGENTS.md not found");
  process.exit(2);
}

const content = fs.readFileSync(canonical, "utf8");

// Simple split: keep entire canonical content for Claude; for Cursor produce a trimmed variant
fs.writeFileSync(claudeOut, content, "utf8");

// For Cursor, keep only top sections and list of guardrails (max ~200 lines)
const lines = content.split(/\r?\n/);
const cursorLines = [];
let count = 0;
for (const line of lines) {
  cursorLines.push(line);
  count++;
  if (count > 220) break;
}

if (!fs.existsSync(path.dirname(cursorOut))) {
  try {
    fs.mkdirSync(path.dirname(cursorOut), { recursive: true });
  } catch {}
}

fs.writeFileSync(cursorOut, cursorLines.join("\n"), "utf8");
console.log("Generated CLAUDE.md and .cursorrules from AGENTS.md");
