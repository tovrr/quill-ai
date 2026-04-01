import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

export const runtime = "nodejs";

type ValidateBody = {
  type?: "nextjs-bundle" | "react-app";
  files?: Record<string, string>;
};

type CommandResult = {
  ok: boolean;
  exitCode: number | null;
  output: string;
};

const MAX_FILES = 200;
const MAX_TOTAL_BYTES = 4_000_000;
const COMMAND_TIMEOUT_MS = 120_000;

async function writeBundleFiles(root: string, files: Record<string, string>): Promise<void> {
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(root, relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, "utf8");
  }
}

async function runCommand(command: string, args: string[], cwd: string, timeoutMs: number): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, windowsHide: true, shell: true });
    let output = "";
    let finished = false;

    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      child.kill("SIGTERM");
      resolve({ ok: false, exitCode: null, output: `${output}\n[timeout] ${command} ${args.join(" ")}`.trim() });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });

    child.on("close", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ ok: code === 0, exitCode: code, output: output.trim() });
    });

    child.on("error", (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ ok: false, exitCode: null, output: `${output}\n${error.message}`.trim() });
    });
  });
}

export async function POST(req: Request) {
  if (process.env.BUILDER_LOCAL_VALIDATE_ENABLED !== "true") {
    return Response.json(
      { error: "Local bundle validation is disabled. Set BUILDER_LOCAL_VALIDATE_ENABLED=true to enable." },
      { status: 403 },
    );
  }

  let body: ValidateBody;
  try {
    body = (await req.json()) as ValidateBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.type !== "nextjs-bundle" || !body.files || typeof body.files !== "object") {
    return Response.json({ error: "Expected type=nextjs-bundle and a files object." }, { status: 400 });
  }

  const entries = Object.entries(body.files);
  if (entries.length === 0 || entries.length > MAX_FILES) {
    return Response.json({ error: `files must contain between 1 and ${MAX_FILES} entries.` }, { status: 400 });
  }

  let totalBytes = 0;
  for (const [path, content] of entries) {
    if (!path || typeof content !== "string") {
      return Response.json({ error: "All file paths and values must be strings." }, { status: 400 });
    }
    totalBytes += content.length;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return Response.json({ error: "Bundle payload too large." }, { status: 400 });
    }
  }

  const workspace = join(tmpdir(), `quill-validate-${randomUUID()}`);

  try {
    await mkdir(workspace, { recursive: true });
    await writeBundleFiles(workspace, body.files);

    const npmInstall = await runCommand("npm", ["install", "--no-audit", "--no-fund"], workspace, COMMAND_TIMEOUT_MS);
    if (!npmInstall.ok) {
      return Response.json({
        ok: false,
        phase: "install",
        output: npmInstall.output,
      });
    }

    const npmBuild = await runCommand("npm", ["run", "build"], workspace, COMMAND_TIMEOUT_MS);
    return Response.json({
      ok: npmBuild.ok,
      phase: "build",
      output: npmBuild.output,
      installOutput: npmInstall.output,
    });
  } finally {
    await rm(workspace, { recursive: true, force: true }).catch(() => {});
  }
}
