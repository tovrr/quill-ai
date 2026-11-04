import type { Schema, ToolSet } from "ai";
import type { ChatAccessEvaluationResult } from "@/lib/chat/access-gates";
import { buildSearchKnowledgeBaseTool, SEARCH_KNOWLEDGE_BASE_DESCRIPTION, searchKnowledgeBaseInputSchema } from "./knowledge-base";
import { buildRunCodeTool, RUN_CODE_DESCRIPTION, runCodeInputSchema } from "./run-code";

/**
 * What a tool can do to the world, from least to most consequential:
 * `read` reads the user's own data, `network` reaches a third party, `exec` runs code,
 * `write` changes state.
 */
export type ToolRisk = "read" | "network" | "exec" | "write";

export type ToolRequirements = {
  /** A signed-in user: the guest does not get the tool. */
  auth: boolean;
  /** A paid plan. */
  paid: boolean;
  /** The request may execute code (policy-runtime's `canRunCode`). */
  codeExecution: boolean;
};

export type ToolContext = {
  userId: string;
  canRunCode: boolean;
  tier: ChatAccessEvaluationResult["userTier"];
};

export type ToolSpec = {
  name: string;
  description: string;
  inputSchema: Schema<unknown>;
  risk: ToolRisk;
  requires: ToolRequirements;
  /**
   * Declared for the tool-approval work to come. Nothing reads it yet: a tool never
   * waits for an approval, whatever this says.
   */
  approval: "none" | "required";
  build: (ctx: ToolContext) => ToolSet[string];
};

/** The id /api/chat gives a request that has no session; the chat route and the registry share it. */
export const GUEST_USER_ID = "guest";

/** Registration order is the order of the tools the model receives. */
export const TOOL_REGISTRY: readonly ToolSpec[] = [
  {
    name: "run_code",
    description: RUN_CODE_DESCRIPTION,
    inputSchema: runCodeInputSchema,
    risk: "exec",
    requires: { auth: false, paid: false, codeExecution: true },
    approval: "none",
    build: () => buildRunCodeTool(),
  },
  {
    name: "search_knowledge_base",
    description: SEARCH_KNOWLEDGE_BASE_DESCRIPTION,
    inputSchema: searchKnowledgeBaseInputSchema,
    risk: "read",
    requires: { auth: true, paid: false, codeExecution: false },
    approval: "none",
    build: ({ userId }) => buildSearchKnowledgeBaseTool(userId),
  },
];

/** The single place that decides whether a request gets a tool. */
function isToolAllowed(spec: ToolSpec, ctx: ToolContext): boolean {
  if (spec.requires.auth && ctx.userId === GUEST_USER_ID) return false;
  if (spec.requires.paid && ctx.tier !== "pro") return false;
  if (spec.requires.codeExecution && !ctx.canRunCode) return false;
  return true;
}

/** The specs of the tools this context may use, in registration order. */
export function selectToolSpecs(ctx: ToolContext, registry: readonly ToolSpec[] = TOOL_REGISTRY): ToolSpec[] {
  return registry.filter((spec) => isToolAllowed(spec, ctx));
}

/**
 * The tools the model may call on this request, built for this user. `registry` is the
 * list to choose from: the whole registry for a chat request, a narrower one for
 * Autopilot (see src/lib/autopilot/tool-policy.ts).
 */
export function buildToolsForRequest(ctx: ToolContext, registry: readonly ToolSpec[] = TOOL_REGISTRY): ToolSet {
  const tools: ToolSet = {};
  for (const spec of selectToolSpecs(ctx, registry)) {
    tools[spec.name] = spec.build(ctx);
  }
  return tools;
}
