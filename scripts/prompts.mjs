#!/usr/bin/env node
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const prompts = fs.readdirSync(ROOT).filter((f) => f.startsWith(".prompt") && f.endsWith(".md"));
const examplesDir = path.join(ROOT, "examples");

function list() {
  console.log("Available prompts:");
  for (const p of prompts) console.log("- " + p.replace(".md", ""));
}

function show(name) {
  const file = path.join(ROOT, `${name}.md`);
  if (!fs.existsSync(file)) {
    console.error("Prompt not found:", name);
    process.exit(2);
  }
  console.log(fs.readFileSync(file, "utf8"));
}

function example(name) {
  const file = path.join(examplesDir, `prompt.${name}.json`);
  if (!fs.existsSync(file)) {
    console.error("Example not found for:", name);
    process.exit(3);
  }
  console.log(fs.readFileSync(file, "utf8"));
}

function runExamples() {
  const missing = [];
  for (const p of prompts) {
    const base = p.replace(".md", "").replace(".prompt", "").replace(/^\./, "");
    const ex = path.join(examplesDir, `prompt.${base}.json`);
    if (!fs.existsSync(ex)) missing.push(base);
  }
  if (missing.length) {
    console.error("Missing examples for prompts:", missing.join(", "));
    process.exit(4);
  }
  console.log("All prompt examples present.");
}

const argv = process.argv.slice(2);
if (argv.length === 0 || argv.includes("--list")) list();
else if (argv[0] === "--show" && argv[1]) show(argv[1]);
else if (argv[0] === "--example" && argv[1]) example(argv[1]);
else if (argv[0] === "--run-examples") runExamples();
else {
  console.log("Usage: node scripts/prompts.mjs [--list] [--show <name>] [--example <name>] [--run-examples]");
  process.exit(0);
}
