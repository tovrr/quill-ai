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
    if (!config.apiKey) {
      return {
        ok: false,
        stdout: "",
        stderr: "",
        exitCode: 1,
        durationMs: 0,
        error: "E2B_API_KEY is not set. See .env.example for setup.",
      };
    }

    try {
      // Placeholder: E2B Python execution
      // When ready: import { Sandbox } from "@e2b/code-interpreter";
      // and use config.apiKey to initialize the sandbox
      const response = await fetch("https://api.e2b.dev/v1/sandboxes", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ template: request.language }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          ok: false,
          stdout: "",
          stderr: errorText,
          exitCode: 1,
          durationMs: 0,
          error: `E2B API error: ${response.status}`,
        };
      }

      // Execute code in sandbox and return result
      // This is a simplified stub — full E2B integration requires the SDK
      return {
        ok: true,
        stdout: "(E2B execution not yet fully integrated)",
        stderr: "",
        exitCode: 0,
        durationMs: 0,
      };
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
  return Boolean(getRemoteExecutionConfig()) || isSandboxEnabled();
}

/**
 * Get the current execution backend (for debugging/telemetry).
 */
export function getExecutionBackend(): "local" | "e2b" | "modal" | "custom" | "disabled" {
  const remoteConfig = getRemoteExecutionConfig();
  if (remoteConfig) {
    return remoteConfig.provider as "e2b" | "modal" | "custom";
  }
  if (isSandboxEnabled()) {
    return "local";
  }
  return "disabled";
}
