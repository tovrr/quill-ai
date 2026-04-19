import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

type FileMap = Record<string, string>;

function writeFilesToTempDir(files: FileMap): string {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "quill-artifact-"));
  for (const [rel, content] of Object.entries(files)) {
    const dest = path.join(base, rel.replace(/^[\\/]+/, ""));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content, "utf8");
  }
  return base;
}

export async function validateGeneratedModule(
  input: string | FileMap,
): Promise<{ success: boolean; exitCode: number; details?: string }> {
  if (typeof input === "string") {
    const res = spawnSync("npx", ["tsc", "--noEmit", input], { shell: true, encoding: "utf8" });
    return { success: res.status === 0, exitCode: res.status ?? 1, details: res.stderr || res.stdout };
  }

  const tmp = writeFilesToTempDir(input);
  try {
    const tsFiles: string[] = [];
    const jsFiles: string[] = [];
    for (const rel of Object.keys(input)) {
      if (/\.(ts|tsx)$/i.test(rel)) tsFiles.push(path.join(tmp, rel));
      if (/\.(js|jsx)$/i.test(rel)) jsFiles.push(path.join(tmp, rel));
    }

    if (tsFiles.length > 0) {
      const res = spawnSync("npx", ["tsc", "--noEmit", "--skipLibCheck", ...tsFiles], {
        shell: true,
        encoding: "utf8",
      });
      if (res.status !== 0) return { success: false, exitCode: res.status ?? 1, details: res.stderr || res.stdout };
    }

    for (const file of jsFiles) {
      const res = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
      if (res.status !== 0) return { success: false, exitCode: res.status ?? 1, details: res.stderr || res.stdout };
    }

    return { success: true, exitCode: 0 };
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {}
  }
}

const validator = { validateGeneratedModule };

export default validator;
