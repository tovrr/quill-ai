/**
 * Execution Service Abstraction
 *
 * Decouples code execution from deployment context. Supports:
 * - Local Docker (development)
 * - Remote cloud sandbox (E2B, Modal, fly.io)
 * - Multi-agent orchestration (Quill, Hermes, OpenClaw, etc.)
 *
 * Usage:
 *   const result = await executeCode({ code, language, timeoutMs });
 *   // Works the same whether local or remote
 */

import { isSandboxEnabled, executeCode as executeLocal } from "./docker";

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

// ─── Remote Execution (E2B / Modal / Custom) ────────────────────────────────

type RemoteExecutionConfig = {
  provider: "e2b" | "modal" | "custom";
  apiKey?: string;
  baseUrl?: string;
  sandboxId?: string;
};

function isRemoteExecutionReady(config: RemoteExecutionConfig): boolean {
  if (config.provider === "e2b") {
    return Boolean(config.apiKey);
  }

  if (config.provider === "modal") {
    return Boolean(config.apiKey && config.baseUrl);
  }

  if (config.provider === "custom") {
    return Boolean(config.baseUrl);
  }

  return false;
}

function getRemoteExecutionConfig(): RemoteExecutionConfig | null {
  const provider = process.env.EXECUTION_SERVICE_PROVIDER;
  if (!provider) return null;

  if (provider === "e2b") {
    return {
      provider: "e2b",
      apiKey: process.env.E2B_API_KEY,
    };
  }

  if (provider === "modal") {
    return {
      provider: "modal",
      apiKey: process.env.MODAL_TOKEN_ID,
      baseUrl: process.env.MODAL_WEBHOOK_URL,
    };
  }

  if (provider === "custom") {
    return {
      provider: "custom",
      baseUrl: process.env.EXECUTION_SERVICE_URL,
      apiKey: process.env.EXECUTION_SERVICE_API_KEY,
    };
  }

  return null;
}

async function executeRemote(request: ExecuteCodeRequest, config: RemoteExecutionConfig): Promise<ExecuteCodeResult> {
  if (!config.baseUrl && config.provider !== "e2b" && config.provider !== "modal") {
    return {
      ok: false,
      stdout: "",
      stderr: "",
      exitCode: 1,
      durationMs: 0,
      error: `Remote execution provider '${config.provider}' is not configured (missing baseUrl).`,
    };
  }

  // E2B integration point
  if (config.provider === "e2b") {
    if (!config.apiKey) {
      return {
        ok: false,
        stdout: "",
        stderr: "",
        exitCode: 1,
        durationMs: 0,
        error: "E2B execution requires E2B_API_KEY.",
      };
    }

    try {
      const { Sandbox } = await import("@e2b/code-interpreter");
      const start = Date.now();
      const sandbox = await Sandbox.create({ apiKey: config.apiKey });
      try {
        const timeoutSec = Math.ceil((request.timeoutMs ?? 15_000) / 1_000);
        const execution = await sandbox.runCode(request.code, { timeoutMs: timeoutSec * 1_000 });
        const durationMs = Date.now() - start;
        const stdout = execution.logs.stdout.join("");
        const stderr = execution.logs.stderr.join("");
        const exitCode = execution.error ? 1 : 0;
        const errorParts: string[] = [];
        if (execution.error?.value) errorParts.push(execution.error.value);
        if (execution.error?.traceback) errorParts.push(execution.error.traceback);
        return {
          ok: exitCode === 0,
          stdout,
          stderr,
          exitCode,
          durationMs,
          ...(errorParts.length > 0 ? { error: errorParts.join("\n") } : {}),
        };
      } finally {
        await sandbox.kill().catch(() => undefined);
      }
    } catch (err) {
      return {
        ok: false,
        stdout: "",
        stderr: err instanceof Error ? err.message : String(err),
        exitCode: 1,
        durationMs: 0,
        error: "E2B execution failed",
      };
    }
  }

  // Modal integration point
  if (config.provider === "modal") {
    if (!config.apiKey || !config.baseUrl) {
      return {
        ok: false,
        stdout: "",
        stderr: "",
        exitCode: 1,
        durationMs: 0,
        error: "Modal execution requires MODAL_TOKEN_ID and MODAL_WEBHOOK_URL.",
      };
    }

    try {
      const response = await fetch(`${config.baseUrl}/execute`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        return {
          ok: false,
          stdout: "",
          stderr: await response.text(),
          exitCode: 1,
          durationMs: 0,
          error: `Modal API error: ${response.status}`,
        };
      }

      return (await response.json()) as ExecuteCodeResult;
    } catch (err) {
      return {
        ok: false,
        stdout: "",
        stderr: err instanceof Error ? err.message : String(err),
        exitCode: 1,
        durationMs: 0,
        error: "Modal execution failed",
      };
    }
  }

  // Custom execution service integration
  if (config.provider === "custom") {
    if (!config.baseUrl) {
      return {
        ok: false,
        stdout: "",
        stderr: "",
        exitCode: 1,
        durationMs: 0,
        error: "Custom execution service requires EXECUTION_SERVICE_URL.",
      };
    }

    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (config.apiKey) {
        headers["Authorization"] = `Bearer ${config.apiKey}`;
      }

      const response = await fetch(`${config.baseUrl}/execute`, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        return {
          ok: false,
          stdout: "",
          stderr: await response.text(),
          exitCode: 1,
          durationMs: 0,
          error: `Execution service error: ${response.status}`,
        };
      }

      return (await response.json()) as ExecuteCodeResult;
    } catch (err) {
      return {
        ok: false,
        stdout: "",
        stderr: err instanceof Error ? err.message : String(err),
        exitCode: 1,
        durationMs: 0,
        error: "Custom execution service request failed",
      };
    }
  }

  return {
    ok: false,
    stdout: "",
    stderr: "",
    exitCode: 1,
    durationMs: 0,
    error: "Unknown execution provider",
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Languages supported by the execution service.
 * E2B's default Jupyter kernel and the local Docker adapter both support Python.
 * Expand this when additional templates/backends are wired in.
 */
export const SUPPORTED_LANGUAGES = ["python"] as string[];

/**
 * Execute code in the configured execution environment.
 *
 * Routing logic:
 * 1. If EXECUTION_SERVICE_PROVIDER is set → use remote service
 * 2. Else if QUILL_SANDBOX_CONTAINER_ENABLED is true → use local Docker
 * 3. Else → return disabled error
 *
 * This allows:
 * - Local dev: npm run dev (uses Docker)
 * - Vercel staging: EXECUTION_SERVICE_PROVIDER=e2b (uses E2B)
 * - Multi-agent: Hermes/OpenClaw/Quill all POST to same endpoint
 */
export async function executeCode(request: ExecuteCodeRequest): Promise<ExecuteCodeResult> {
  const remoteConfig = getRemoteExecutionConfig();

  if (remoteConfig) {
    if (!isRemoteExecutionReady(remoteConfig)) {
      return {
        ok: false,
        stdout: "",
        stderr: "",
        exitCode: 1,
        durationMs: 0,
        error: `Execution provider '${remoteConfig.provider}' is configured but not ready.`,
      };
    }
    return executeRemote(request, remoteConfig);
  }

  if (isSandboxEnabled()) {
    return executeLocal(request);
  }

  return {
    ok: false,
    stdout: "",
    stderr: "",
    exitCode: 1,
    durationMs: 0,
    error:
      "Code execution is disabled. Set QUILL_SANDBOX_CONTAINER_ENABLED=true (local) or EXECUTION_SERVICE_PROVIDER (remote).",
  };
}

/**
 * Check if code execution is available in the current environment.
 */
export function isExecutionAvailable(): boolean {
  const remoteConfig = getRemoteExecutionConfig();
  if (remoteConfig && isRemoteExecutionReady(remoteConfig)) return true;
  return isSandboxEnabled();
}

/**
 * Get the current execution backend (for debugging/telemetry).
 */
export function getExecutionBackend(): "local" | "e2b" | "modal" | "custom" | "disabled" {
  const remoteConfig = getRemoteExecutionConfig();
  if (remoteConfig && isRemoteExecutionReady(remoteConfig)) {
    return remoteConfig.provider as "e2b" | "modal" | "custom";
  }
  if (isSandboxEnabled()) {
    return "local";
  }
  return "disabled";
}

// ─── Preview Sandbox (E2B only) ──────────────────────────────────────────────

/**
 * E2B sandbox templates that map to builder artifact types.
 * These templates must exist in your E2B account (default templates are fine).
 */
export const E2B_PREVIEW_TEMPLATES = {
  /** Next.js server-side preview */
  "nextjs-bundle": "nextjs",
  /** Node.js / generic server */
  node: "base",
} as const;

export type PreviewSandboxRequest = {
  /** E2B template name (e.g. "nextjs", "base") */
  template: string;
  /** Files to write into the sandbox — { "path/in/sandbox": "content" } */
  files: Record<string, string>;
  /** Shell command to run after writing files (e.g. "npm install && npm run dev") */
  startCommand: string;
  /** Port the preview server listens on (default 3000) */
  port?: number;
  /** How long to wait (ms) for the preview URL to become reachable (default 30_000) */
  readyTimeoutMs?: number;
};

export type PreviewSandboxResult = {
  ok: boolean;
  sbxId?: string;
  previewUrl?: string;
  error?: string;
};

/**
 * Spin up a long-lived E2B sandbox, write files, start the dev server,
 * and return a public preview URL.
 *
 * Only supported when EXECUTION_SERVICE_PROVIDER=e2b and E2B_API_KEY is set.
 * Returns { ok: false } on any other backend.
 */
export async function createPreviewSandbox(request: PreviewSandboxRequest): Promise<PreviewSandboxResult> {
  const remoteConfig = getRemoteExecutionConfig();

  if (!remoteConfig || remoteConfig.provider !== "e2b" || !remoteConfig.apiKey) {
    return { ok: false, error: "Preview sandboxes require EXECUTION_SERVICE_PROVIDER=e2b and E2B_API_KEY." };
  }

  try {
    const { Sandbox } = await import("@e2b/code-interpreter");
    const port = request.port ?? 3000;
    const readyTimeoutMs = request.readyTimeoutMs ?? 30_000;

    // Create sandbox from template (timeout long enough for npm install + build)
    const sandbox = await Sandbox.create(request.template, {
      apiKey: remoteConfig.apiKey,
      timeoutMs: 300_000,
    });

    const sbxId = sandbox.sandboxId;

    // Write all artifact files — kill the sandbox if writing fails to avoid orphans
    try {
      for (const [filePath, content] of Object.entries(request.files)) {
        await sandbox.files.write(filePath, content);
      }
    } catch (writeErr) {
      await sandbox.kill().catch(() => undefined);
      return {
        ok: false,
        error: `Failed to write files to sandbox: ${
          writeErr instanceof Error ? writeErr.message : String(writeErr)
        }`,
      };
    }

    // Start dev server in background — kill sandbox if start command fails
    try {
      await sandbox.commands.run(request.startCommand, { background: true });
    } catch (startErr) {
      await sandbox.kill().catch(() => undefined);
      return {
        ok: false,
        error: `Failed to start preview server: ${
          startErr instanceof Error ? startErr.message : String(startErr)
        }`,
      };
    }

    // Obtain the public URL for the preview port
    const previewUrl = `https://${sandbox.getHost(port)}`;

    // Poll until the server responds or we time out
    const deadline = Date.now() + readyTimeoutMs;
    let reachable = false;
    while (Date.now() < deadline) {
      try {
        const probe = await fetch(previewUrl, { signal: AbortSignal.timeout(3_000) });
        if (probe.ok || probe.status < 500) {
          reachable = true;
          break;
        }
      } catch {
        // server not up yet — wait and retry
      }
      await new Promise((r) => setTimeout(r, 1_500));
    }

    if (!reachable) {
      await sandbox.kill().catch(() => undefined);
      return { ok: false, error: `Preview server did not become reachable within ${readyTimeoutMs}ms.` };
    }

    return { ok: true, sbxId, previewUrl };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create preview sandbox.",
    };
  }
}

/**
 * Whether preview sandboxes (createPreviewSandbox) are available.
 */
export function isPreviewSandboxAvailable(): boolean {
  const remoteConfig = getRemoteExecutionConfig();
  return Boolean(remoteConfig && remoteConfig.provider === "e2b" && isRemoteExecutionReady(remoteConfig));
}
