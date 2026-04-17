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

import { isSandboxEnabled, executeCode as executeLocal } from "./docker-executor";

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
    // E2B is intentionally disabled until SDK-backed execution is implemented.
    return false;
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

async function executeRemote(
  request: ExecuteCodeRequest,
  config: RemoteExecutionConfig
): Promise<ExecuteCodeResult> {
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
    return {
      ok: false,
      stdout: "",
      stderr: "",
      exitCode: 1,
      durationMs: 0,
      error:
        "E2B provider is configured but not enabled in this build. Use EXECUTION_SERVICE_PROVIDER=custom/modal or local sandbox until SDK integration ships.",
    };
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
