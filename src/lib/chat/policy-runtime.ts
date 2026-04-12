import { isSandboxEnabled } from "@/lib/docker-executor";
import { evaluatePermissionDecision } from "@/lib/killer-autonomy";
import { getKillerById, type Killer } from "@/lib/killers";
import { getSandboxProviderStatus, type SandboxProviderStatus } from "@/lib/sandbox-providers";

export type PolicyRuntimeInput = {
  killerId?: string;
  webSearchRequested: boolean;
  requestedCanvasBuildIntent: boolean;
  inferredCanvasBuildIntent: boolean;
};

export type PolicyRuntimeResult = {
  killer: Killer | null;
  policyWarnings: string[];
  effectiveWebSearchRequested: boolean;
  canvasBuildIntent: boolean;
  sandboxStatus: SandboxProviderStatus | null;
  canRunCode: boolean;
};

export async function evaluatePolicyRuntime(input: PolicyRuntimeInput): Promise<PolicyRuntimeResult> {
  const { killerId, webSearchRequested, requestedCanvasBuildIntent, inferredCanvasBuildIntent } = input;

  const killer = killerId ? getKillerById(killerId) ?? null : null;
  const policyWarnings: string[] = [];

  const webSearchPermission = killer
    ? evaluatePermissionDecision(killer.executionPolicy.permissions.webSearch, {
        explicitUserCheckpoint: webSearchRequested,
        label: "Web search",
      })
    : { allowed: true, requiresCheckpoint: false, reason: null };

  const externalNetworkPermission = killer
    ? evaluatePermissionDecision(killer.executionPolicy.permissions.externalNetwork, {
        explicitUserCheckpoint: webSearchRequested,
        label: "External network access",
      })
    : { allowed: true, requiresCheckpoint: false, reason: null };

  const builderPermission = killer
    ? evaluatePermissionDecision(killer.executionPolicy.permissions.builderActions, {
        explicitUserCheckpoint: requestedCanvasBuildIntent,
        label: "Builder actions",
      })
    : { allowed: true, requiresCheckpoint: false, reason: null };

  const effectiveWebSearchRequested =
    webSearchRequested && webSearchPermission.allowed && externalNetworkPermission.allowed;
  const canvasBuildIntent = builderPermission.allowed && (requestedCanvasBuildIntent || inferredCanvasBuildIntent);

  for (const permission of [webSearchPermission, externalNetworkPermission]) {
    if (permission.reason && webSearchRequested) {
      policyWarnings.push(permission.reason);
    }
  }

  if (builderPermission.reason && (requestedCanvasBuildIntent || inferredCanvasBuildIntent)) {
    policyWarnings.push(builderPermission.reason);
  }

  const sandboxStatus = killer
    ? await getSandboxProviderStatus(killer.executionPolicy)
    : null;

  const sandboxExecutionPermission = killer
    ? evaluatePermissionDecision(killer.executionPolicy.permissions.sandboxExecution, {
        explicitUserCheckpoint: false,
        label: "Code execution",
      })
    : { allowed: false, requiresCheckpoint: false, reason: null };

  const canRunCode =
    sandboxExecutionPermission.allowed &&
    isSandboxEnabled() &&
    !canvasBuildIntent;

  if (sandboxStatus?.reason) {
    policyWarnings.push(sandboxStatus.reason);
  }

  return {
    killer,
    policyWarnings,
    effectiveWebSearchRequested,
    canvasBuildIntent,
    sandboxStatus,
    canRunCode,
  };
}
