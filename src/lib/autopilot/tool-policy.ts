/**
 * The tool policy of Autopilot, and its hash.
 *
 * An Autopilot workflow runs unattended, so the tools it may call are decided here, not
 * by the chat rules: a registry tool is available to a workflow only when its name is in
 * AUTOPILOT_TOOL_ALLOWLIST. The list is empty today, so a workflow gets no tool.
 *
 * The owner approves a workflow under the policy that is in force at that moment, and the
 * hash of that policy is stored on the workflow. Before an active workflow runs, the hash
 * is computed again; if it differs, the run is refused (`policy_changed`) and neither the
 * model nor a tool is called, until the owner approves the new policy.
 */

import { createHash } from "node:crypto";
import type { ToolSet } from "ai";
import { canonicalJson } from "@/lib/canonical-json";
import {
  TOOL_REGISTRY,
  buildToolsForRequest,
  selectToolSpecs,
  type ToolContext,
  type ToolSpec,
} from "@/lib/tools/registry";

/** Bump it to make every active workflow ask for a new approval, without changing a tool. */
export const AUTOPILOT_POLICY_VERSION = 1;

/**
 * The registry tools an Autopilot run may offer the model, by name. Adding a name changes
 * the policy hash, so every active workflow is refused until its owner approves it again.
 */
export const AUTOPILOT_TOOL_ALLOWLIST: readonly string[] = [];

/**
 * The hash of a policy that allows no tool. A workflow with no stored hash was approved
 * while Autopilot had no tools, so this is what it is compared with: the workflows that
 * existed before the hash was introduced keep running while the policy is empty, and are
 * refused as soon as it is not, exactly like a workflow approved under an older policy.
 * (test/autopilot-policy.test.ts pins it to computeToolPolicyHash([]).)
 */
export const NO_TOOLS_POLICY_HASH = "8ace068ed2f4ef0dea8b8cea71e84bff8fcdbf629cf97ba2dd0bb9c0d7bdb8b6";

// The tools a policy can offer whatever the owner's plan is: the hash must depend on the
// code, not on who owns the workflow, and a plan can only narrow what a run receives.
const POLICY_CONTEXT: ToolContext = { userId: "autopilot-policy", canRunCode: false, tier: "pro" };

export type PolicySource = {
  registry?: readonly ToolSpec[];
  allowlist?: readonly string[];
};

/**
 * The registry narrowed to what Autopilot may use. A tool that needs an approval is out:
 * an unattended run cannot ask for one.
 */
export function autopilotToolSpecs({ registry = TOOL_REGISTRY, allowlist = AUTOPILOT_TOOL_ALLOWLIST }: PolicySource = {}): ToolSpec[] {
  return registry.filter((spec) => allowlist.includes(spec.name) && spec.approval === "none");
}

/**
 * The hash of a list of tool specs. For each tool it covers what the model and the rules
 * see: name, description, risk, requirements (auth, paid, codeExecution), approval and
 * the JSON schema of the input. The order of the list does not matter. It also covers
 * AUTOPILOT_POLICY_VERSION.
 */
export async function computeToolPolicyHash(specs: readonly ToolSpec[]): Promise<string> {
  const tools = await Promise.all(
    [...specs]
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .map(async (spec) => ({
        name: spec.name,
        description: spec.description,
        risk: spec.risk,
        requires: spec.requires,
        approval: spec.approval,
        inputSchema: await spec.inputSchema.jsonSchema,
      })),
  );
  return createHash("sha256").update(canonicalJson({ version: AUTOPILOT_POLICY_VERSION, tools })).digest("hex");
}

/** The hash of the policy in force now. */
export async function currentAutopilotPolicyHash(source: PolicySource = {}): Promise<string> {
  return computeToolPolicyHash(selectToolSpecs(POLICY_CONTEXT, autopilotToolSpecs(source)));
}

export type PolicyCheck = { ok: true } | { ok: false; approvedHash: string; currentHash: string };

/** Whether the policy a workflow was approved under is still the one in force. */
export async function checkPolicyApproval(
  workflow: { policyHash?: string | null },
  source: PolicySource = {},
): Promise<PolicyCheck> {
  const approvedHash = workflow.policyHash ?? NO_TOOLS_POLICY_HASH;
  const currentHash = await currentAutopilotPolicyHash(source);
  return approvedHash === currentHash ? { ok: true } : { ok: false, approvedHash, currentHash };
}

/** A run that was not started because the tool policy changed after the owner approved it. */
export type PolicyRefusal = {
  status: "refused";
  mode: "active";
  reasonCode: "policy_changed";
  summary: string;
};

const POLICY_CHANGED_SUMMARY =
  "Refused: the tools Autopilot may use changed after you approved this workflow. " +
  "Nothing was run. Review it and approve the new policy to resume.";

/**
 * The one gate in front of an unattended run, shared by the cron runner and "Run now" so
 * that the check and the refusal text cannot drift apart. Returns the refusal to record
 * when an active workflow was approved under another policy, and null when the run may go
 * on. A workflow in observe mode is never refused: a dry run executes no tool, so it runs
 * under the policy in force.
 */
export async function refuseIfPolicyChanged(
  workflow: { mode?: "observe" | "active"; policyHash?: string | null },
  source: PolicySource = {},
): Promise<PolicyRefusal | null> {
  if ((workflow.mode ?? "active") === "observe") return null;
  const approval = await checkPolicyApproval(workflow, source);
  if (approval.ok) return null;
  return { status: "refused", mode: "active", reasonCode: "policy_changed", summary: POLICY_CHANGED_SUMMARY };
}

/** A tool call the model made during a run. */
export type RecordedToolCall = { toolName: string; input: unknown };

/** What a tool returns in observe mode: nothing ran. */
export const OBSERVED_TOOL_RESULT = { observed: true, executed: false, note: "Dry run: this tool was not executed." };

/** Calls kept on a run record; the model is stopped by the step limit long before this. */
export const MAX_RECORDED_TOOL_CALLS = 20;

type Executable = { execute?: (input: unknown, options: unknown) => unknown };

/**
 * The tools an Autopilot run gives the model: the allowlisted tools this owner may use,
 * each wrapped so that every call is recorded. In observe mode the wrapper does not call
 * the tool: the model gets OBSERVED_TOOL_RESULT, so the run shows what it would do and
 * nothing is executed. Returns undefined when the policy offers no tool.
 */
export function buildAutopilotTools(
  owner: { userId: string; tier: ToolContext["tier"] },
  options: { observe: boolean; calls: RecordedToolCall[] },
  source: PolicySource = {},
): ToolSet | undefined {
  const tools = buildToolsForRequest({ ...owner, canRunCode: false }, autopilotToolSpecs(source));
  const names = Object.keys(tools);
  if (names.length === 0) return undefined;

  const wrapped: ToolSet = {};
  for (const name of names) {
    const original = tools[name];
    wrapped[name] = {
      ...original,
      execute: async (input: unknown, executeOptions: unknown) => {
        if (options.calls.length < MAX_RECORDED_TOOL_CALLS) options.calls.push({ toolName: name, input });
        if (options.observe) return OBSERVED_TOOL_RESULT;
        return (original as Executable).execute?.(input, executeOptions);
      },
    } as ToolSet[string];
  }
  return wrapped;
}
