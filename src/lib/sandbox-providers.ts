import type { KillerExecutionPolicy, SandboxExecutionRequest, SandboxExecutionResult, SandboxProviderHook } from "@/lib/killer-autonomy";

export type SandboxProviderStatus = {
  provider: SandboxProviderHook | null;
  configured: boolean;
  available: boolean;
  reason: string | null;
};

async function unavailableExecutionResult(request: SandboxExecutionRequest): Promise<SandboxExecutionResult> {
  return {
    ok: false,
    summary: `Sandbox adapter for ${request.providerHint} is registered but execution is not implemented yet.`,
  };
}

const SANDBOX_PROVIDER_REGISTRY: Record<string, SandboxProviderHook> = {
  "future-code-executor": {
    id: "future-code-executor",
    kind: "container",
    isAvailable: () => process.env.QUILL_SANDBOX_CONTAINER_ENABLED === "true",
    execute: unavailableExecutionResult,
  },
  "future-vm-executor": {
    id: "future-vm-executor",
    kind: "vm",
    isAvailable: () => process.env.QUILL_SANDBOX_VM_ENABLED === "true",
    execute: unavailableExecutionResult,
  },
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
