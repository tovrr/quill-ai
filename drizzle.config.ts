import { defineConfig } from "drizzle-kit";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadLocalEnvFile(path: string): void {
  if (!existsSync(path)) return;

  const content = readFileSync(path, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const sep = trimmed.indexOf("=");
    if (sep <= 0) continue;

    const key = trimmed.slice(0, sep).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = trimmed.slice(sep + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadLocalEnvFile(resolve(process.cwd(), ".env.local"));
loadLocalEnvFile(resolve(process.cwd(), ".env"));

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for drizzle-kit. Set it in .env.local, .env, or environment variables.");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
