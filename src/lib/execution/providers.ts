import type { KillerExecutionPolicy, SandboxExecutionRequest, SandboxExecutionResult, SandboxProviderHook } from "@/lib/ai/killer-autonomy";
import { executeCode, isExecutionAvailable, getExecutionBackend } from "@/lib/execution/service";

export type SandboxProviderStatus = {
  provider: SandboxProviderHook | null;
  configured: boolean;
  available: boolean;
  reason: string | null;
};

/**
 * Unified executor that routes to whichever backend is active
 * (Docker locally, E2B/Modal/custom on hosted). Registered for
 * both "docker-executor" (legacy) and "e2b-executor" IDs so
 * existing killer policies don't break.
 */
function makeUnifiedExecutorHook(id: string): SandboxProviderHook {
  return {
    id,
    kind: "container",
    isAvailable: () => isExecutionAvailable(),
    execute: async (request: SandboxExecutionRequest): Promise<SandboxExecutionResult> => {
      const language = request.commands?.[0] ?? "python";
      const code = request.files?.[0] ?? "";
      const result = await executeCode({ code, language, timeoutMs: request.timeoutMs });
      return {
        ok: result.ok,
        summary: result.ok
          ? `Exited 0 in ${result.durationMs}ms (backend: ${getExecutionBackend()}).`
          : `Exited ${result.exitCode} in ${result.durationMs}ms${result.error ? `: ${result.error}` : ""}.`,
        logs: [result.stdout, result.stderr].filter(Boolean).join("\n"),
      };
    },
  };
}

const SANDBOX_PROVIDER_REGISTRY: Record<string, SandboxProviderHook> = {
  "docker-executor": makeUnifiedExecutorHook("docker-executor"),
  "e2b-executor": makeUnifiedExecutorHook("e2b-executor"),
};

export function resolveSandboxProviderHook(providerHookId: string | null | undefined): SandboxProviderHook | null {
  if (!providerHookId) return null;
  return SANDBOX_PROVIDER_REGISTRY[providerHookId] ?? null;
}

export async function getSandboxProviderStatus(policy: KillerExecutionPolicy): Promise<SandboxProviderStatus> {
  if (policy.sandbox.providerHint === "none" || !policy.sandbox.providerHookId) {
    return {
      provider: null,
      configured: false,
      available: !policy.sandbox.required,
      reason: policy.sandbox.required ? "Sandbox execution is required but no provider hook is configured." : null,
    };
  }

  const provider = resolveSandboxProviderHook(policy.sandbox.providerHookId);
  if (!provider) {
    return {
      provider: null,
      configured: false,
      available: false,
      reason: `Sandbox provider hook '${policy.sandbox.providerHookId}' is not registered.`,
    };
  }

  const providerAvailable = provider.isAvailable ? await provider.isAvailable() : true;

  return {
    provider,
    configured: true,
    available: providerAvailable,
    reason: providerAvailable
      ? null
      : `${provider.kind} sandbox provider '${provider.id}' is registered but disabled in the current environment.`,
  };
}

export function buildSandboxProviderRuntimeNote(status: SandboxProviderStatus): string | null {
  if (!status.provider) {
    return status.reason;
  }

  if (!status.available) {
    return status.reason;
  }

  return `Sandbox provider '${status.provider.id}' (${status.provider.kind}) is registered and available for future execution handoff.`;
}
