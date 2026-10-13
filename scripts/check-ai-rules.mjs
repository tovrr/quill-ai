#!/usr/bin/env node
// Fails when CLAUDE.md or .cursorrules is not what scripts/gen-ai-rules.mjs would
// produce from AGENTS.md. Reads only: it never rewrites the files it checks.
import fs from "fs";
import path from "path";
import { readCanonical, renderAiRules } from "./gen-ai-rules.mjs";

const root = process.cwd();
const expected = renderAiRules(readCanonical(root));
const stale = [];

for (const [name, text] of Object.entries(expected)) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) {
    stale.push(`${name}: missing`);
  } else if (fs.readFileSync(file, "utf8") !== text) {
    stale.push(`${name}: differs from AGENTS.md`);
  }
}

if (stale.length > 0) {
  console.error("AI rules out of sync:");
  for (const line of stale) console.error(`  ${line}`);
  console.error("Edit AGENTS.md only, then run: npm run gen:ai-rules");
  process.exit(1);
}
console.log("AI rules check passed: CLAUDE.md and .cursorrules match AGENTS.md.");
