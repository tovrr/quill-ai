#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const CURSOR_MAX_LINES = 221;

// What each generated file must contain for a given AGENTS.md. Shared with
// scripts/check-ai-rules.mjs so the check compares against the same rendering.
export function renderAiRules(content) {
  return {
    // Claude gets the entire canonical content.
    "CLAUDE.md": content,
    // Cursor gets a trimmed variant: the first lines only.
    ".cursorrules": content.split(/\r?\n/).slice(0, CURSOR_MAX_LINES).join("\n"),
  };
}

export function readCanonical(root = process.cwd()) {
  const canonical = path.join(root, "AGENTS.md");
  if (!fs.existsSync(canonical)) {
    console.error("Canonical rules file AGENTS.md not found");
    process.exit(2);
  }
  return fs.readFileSync(canonical, "utf8");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  for (const [name, text] of Object.entries(renderAiRules(readCanonical(root)))) {
    fs.writeFileSync(path.join(root, name), text, "utf8");
  }
  console.log("Generated CLAUDE.md and .cursorrules from AGENTS.md");
}
