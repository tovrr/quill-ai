#!/usr/bin/env node
import { spawn } from "child_process";

const [, , file] = process.argv;
if (!file) {
  console.error("Usage: node scripts/validate-generated-module.mjs <path-to-file>");
  process.exit(2);
}

const tsc = spawn("npx", ["tsc", "--noEmit", file], { stdio: "inherit", shell: true });

tsc.on("close", (code) => {
  process.exit(code ?? 1);
});
