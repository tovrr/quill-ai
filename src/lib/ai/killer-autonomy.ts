export type KillerAutonomyLevel = "assist" | "propose" | "checkpointed-auto";

export type PermissionDecision = "deny" | "allow" | "checkpoint";

export type KillerPermissionMap = {
  webSearch: PermissionDecision;
  fileRead: PermissionDecision;
  fileWrite: PermissionDecision;
  codeGeneration: PermissionDecision;
  builderActions: PermissionDecision;
  localValidation: PermissionDecision;
  externalNetwork: PermissionDecision;
  deployScaffolding: PermissionDecision;
  sandboxExecution: PermissionDecision;
};

export type SandboxProviderKind = "none" | "container" | "vm";

export type SandboxExecutionRequest = {
  providerHint: Exclude<SandboxProviderKind, "none">;
  reason: string;
  commands?: string[];
  files?: string[];
  timeoutMs?: number;
};

export type SandboxExecutionResult = {
  ok: boolean;
  summary: string;
  logs?: string;
};

export interface SandboxProviderHook {
  id: string;
  kind: Exclude<SandboxProviderKind, "none">;
  isAvailable?: () => boolean | Promise<boolean>;
  execute?: (request: SandboxExecutionRequest) => Promise<SandboxExecutionResult>;
}

export type KillerExecutionPolicy = {
  autonomyLevel: KillerAutonomyLevel;
  permissions: KillerPermissionMap;
  sandbox: {
    required: boolean;
    providerHint: SandboxProviderKind;
    providerHookId: string | null;
  };
};

export type PermissionEvaluation = {
  allowed: boolean;
  requiresCheckpoint: boolean;
  reason: string | null;
};

const DEFAULT_PERMISSION_MAP: KillerPermissionMap = {
  webSearch: "deny",
  fileRead: "deny",
  fileWrite: "deny",
  codeGeneration: "deny",
  builderActions: "deny",
  localValidation: "deny",
  externalNetwork: "deny",
  deployScaffolding: "deny",
  sandboxExecution: "deny",
};

export function createPermissionMap(overrides: Partial<KillerPermissionMap>): KillerPermissionMap {
  return {
    ...DEFAULT_PERMISSION_MAP,
    ...overrides,
  };
}

export function createKillerExecutionPolicy(
  autonomyLevel: KillerAutonomyLevel,
  permissions: Partial<KillerPermissionMap>,
  sandbox?: Partial<KillerExecutionPolicy["sandbox"]>
): KillerExecutionPolicy {
  return {
    autonomyLevel,
    permissions: createPermissionMap(permissions),
    sandbox: {
      required: sandbox?.required ?? false,
      providerHint: sandbox?.providerHint ?? "none",
      providerHookId: sandbox?.providerHookId ?? null,
    },
  };
}

export function describeAutonomyLevel(level: KillerAutonomyLevel): string {
  switch (level) {
    case "assist":
      return "Respond with guidance only. Do not imply autonomous execution.";
    case "propose":
      return "Propose concrete actions and plans, but require user confirmation before execution-shaped steps.";
    case "checkpointed-auto":
      return "Can advance through bounded execution steps, but must stop at explicit checkpoints for approval or sandbox handoff.";
  }
}

export function buildExecutionPolicyGuidance(policy: KillerExecutionPolicy): string {
  const permissionSummary = Object.entries(policy.permissions)
    .filter(([, decision]) => decision !== "deny")
    .map(([permission, decision]) => `${permission}=${decision}`)
    .join(", ");

  const lines = [
    "Specialist execution policy:",
    `- Autonomy level: ${policy.autonomyLevel}`,
    `- Behavior: ${describeAutonomyLevel(policy.autonomyLevel)}`,
    `- Elevated permissions: ${permissionSummary || "none"}`,
  ];

  if (policy.sandbox.required) {
    lines.push(
      `- Sandbox requirement: isolated ${policy.sandbox.providerHint} execution is required before any execution-shaped step.`
    );
  } else if (policy.sandbox.providerHint !== "none") {
    lines.push(`- Sandbox preference: prefer ${policy.sandbox.providerHint} isolation when execution is introduced later.`);
  }

  if (policy.sandbox.providerHookId) {
    lines.push(`- Sandbox provider hook: ${policy.sandbox.providerHookId}`);
  }

  return lines.join("\n");
}

export function evaluatePermissionDecision(
  decision: PermissionDecision,
  options?: { explicitUserCheckpoint?: boolean; label?: string }
): PermissionEvaluation {
  const label = options?.label ?? "This action";

  if (decision === "allow") {
    return {
      allowed: true,
      requiresCheckpoint: false,
      reason: null,
    };
  }

  if (decision === "checkpoint") {
    if (options?.explicitUserCheckpoint) {
      return {
        allowed: true,
        requiresCheckpoint: true,
        reason: null,
      };
    }

    return {
      allowed: false,
      requiresCheckpoint: true,
      reason: `${label} requires an explicit user checkpoint before it can run.`,
    };
  }

  return {
    allowed: false,
    requiresCheckpoint: false,
    reason: `${label} is not permitted for this specialist.`,
  };
}

export function getAutonomyLevelLabel(level: KillerAutonomyLevel): string {
  switch (level) {
    case "assist":
      return "Assist";
    case "propose":
      return "Propose";
    case "checkpointed-auto":
      return "Checkpointed";
  }
}

export function summarizePolicyCapabilities(policy: KillerExecutionPolicy, maxItems = 3): string[] {
  const labels: Array<[keyof KillerPermissionMap, string]> = [
    ["webSearch", "web search"],
    ["builderActions", "builder actions"],
    ["codeGeneration", "code generation"],
    ["fileRead", "file reads"],
    ["fileWrite", "file writes"],
    ["localValidation", "local validation"],
    ["deployScaffolding", "deploy scaffolding"],
    ["sandboxExecution", "sandbox execution"],
  ];

  return labels
    .filter(([key]) => policy.permissions[key] !== "deny")
    .map(([key, label]) => {
      const decision = policy.permissions[key];
      return decision === "checkpoint" ? `${label} with checkpoint` : label;
    })
    .slice(0, maxItems);
}