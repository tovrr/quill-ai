import { spawn } from "child_process";

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_CHARS = 50_000;
const MAX_CODE_BYTES = 100_000;

type LanguageConfig = {
  image: string;
  cmd: string[];
};

const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  python: {
    image: "python:3.13-slim",
    cmd: ["python", "-"],
  },
};

export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_CONFIGS) as string[];

export type ExecuteCodeRequest = {
  code: string;
  language: string;
  timeoutMs?: number;
};

export type ExecuteCodeResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  error?: string;
};

export function isSandboxEnabled(): boolean {
  return process.env.QUILL_SANDBOX_CONTAINER_ENABLED === "true";
}

export async function executeCode(request: ExecuteCodeRequest): Promise<ExecuteCodeResult> {
  if (!isSandboxEnabled()) {
    return {
      ok: false,
      stdout: "",
      stderr: "",
      exitCode: 1,
      durationMs: 0,
      error: "Sandbox execution is disabled. Set QUILL_SANDBOX_CONTAINER_ENABLED=true to enable it.",
    };
  }

  const config = LANGUAGE_CONFIGS[request.language];
  if (!config) {
    return {
      ok: false,
      stdout: "",
      stderr: "",
      exitCode: 1,
      durationMs: 0,
      error: `Unsupported language: ${request.language}. Supported: ${SUPPORTED_LANGUAGES.join(", ")}`,
    };
  }

  if (Buffer.byteLength(request.code, "utf8") > MAX_CODE_BYTES) {
    return {
      ok: false,
      stdout: "",
      stderr: "",
      exitCode: 1,
      durationMs: 0,
      error: `Code exceeds maximum size (${MAX_CODE_BYTES / 1000}KB).`,
    };
  }

  const timeoutMs = Math.min(request.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);

  return new Promise((resolve) => {
    const startMs = Date.now();
    let settled = false;

    const finish = (result: ExecuteCodeResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    let proc: ReturnType<typeof spawn>;

    try {
      proc = spawn(
        "docker",
        [
          "run",
          "--rm",
          "--network=none",
          "--memory=128m",
          "--cpus=0.5",
          "--no-new-privileges",
          "-i",
          config.image,
          ...config.cmd,
        ],
        { stdio: ["pipe", "pipe", "pipe"] },
      );
    } catch (err) {
      finish({
        ok: false,
        stdout: "",
        stderr: "",
        exitCode: 1,
        durationMs: Date.now() - startMs,
        error: `Failed to start Docker process: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    let stdout = "";
    let stderr = "";

      proc.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      if (stdout.length > MAX_OUTPUT_CHARS) {
        stdout = stdout.slice(0, MAX_OUTPUT_CHARS);
        proc.kill("SIGKILL");
      }
    });

      proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > MAX_OUTPUT_CHARS) {
        stderr = stderr.slice(0, MAX_OUTPUT_CHARS);
      }
    });

    proc.on("close", (code) => {
      finish({
        ok: code === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? -1,
        durationMs: Date.now() - startMs,
      });
    });

    proc.on("error", (err) => {
      const isNotFound =
        err.message.includes("ENOENT") || err.message.toLowerCase().includes("not found");
      finish({
        ok: false,
        stdout: "",
        stderr: "",
        exitCode: 1,
        durationMs: Date.now() - startMs,
        error: isNotFound
          ? "Docker is not installed or not available in PATH. Install Docker and ensure it is running."
          : `Process error: ${err.message}`,
      });
    });

    // Write code via stdin then close
    if (proc.stdin) {
      proc.stdin.write(request.code, "utf8");
      proc.stdin.end();
    }

    // Hard timeout — kill container if it exceeds the limit
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      finish({
        ok: false,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: -1,
        durationMs: timeoutMs,
        error: `Execution timed out after ${timeoutMs}ms.`,
      });
    }, timeoutMs);

    proc.on("close", () => clearTimeout(timer));
  });
}
