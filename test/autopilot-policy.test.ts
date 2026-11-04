import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonSchema, tool } from "ai";

// The registry only builds tools here; nothing reaches the sandbox, the embedding API or
// the database.
vi.mock("@/lib/execution/service", () => ({ executeCode: vi.fn() }));
vi.mock("@/lib/rag/embed", () => ({ embedText: vi.fn() }));
vi.mock("@/lib/rag/search", () => ({ searchChunks: vi.fn() }));

import {
  AUTOPILOT_TOOL_ALLOWLIST,
  NO_TOOLS_POLICY_HASH,
  OBSERVED_TOOL_RESULT,
  autopilotToolSpecs,
  buildAutopilotTools,
  checkPolicyApproval,
  computeToolPolicyHash,
  currentAutopilotPolicyHash,
  type RecordedToolCall,
} from "@/lib/autopilot/tool-policy";
import type { ToolSpec } from "@/lib/tools/registry";

const execute = vi.fn();

function fakeSpec(overrides: Partial<ToolSpec> = {}): ToolSpec {
  const inputSchema = jsonSchema<{ q: string }>({
    type: "object",
    properties: { q: { type: "string" } },
    required: ["q"],
  });
  return {
    name: "fake_read",
    description: "Reads one thing from the owner's own data and returns it.",
    inputSchema,
    risk: "read",
    requires: { auth: true, paid: false, codeExecution: false },
    approval: "none",
    build: () => tool({ description: "Reads one thing.", inputSchema, execute: async (input) => execute(input) }),
    ...overrides,
  };
}

const OWNER = { userId: "owner-1", tier: "free" as const };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the empty policy (what every workflow was approved under before the hash existed)", () => {
  it("has a pinned hash that is the hash of no tool", async () => {
    expect(await computeToolPolicyHash([])).toBe(NO_TOOLS_POLICY_HASH);
  });

  it("is the policy in force today: Autopilot offers no tool", async () => {
    expect(AUTOPILOT_TOOL_ALLOWLIST).toEqual([]);
    expect(await currentAutopilotPolicyHash()).toBe(NO_TOOLS_POLICY_HASH);
  });

  it("approves a workflow with no stored hash while the policy is empty", async () => {
    expect(await checkPolicyApproval({ policyHash: null })).toEqual({ ok: true });
    expect(await checkPolicyApproval({})).toEqual({ ok: true });
  });

  it("refuses a workflow with no stored hash as soon as the policy gains a tool", async () => {
    const source = { registry: [fakeSpec()], allowlist: ["fake_read"] };
    const check = await checkPolicyApproval({ policyHash: null }, source);
    expect(check).toMatchObject({ ok: false, approvedHash: NO_TOOLS_POLICY_HASH });
  });
});

describe("computeToolPolicyHash", () => {
  it("does not depend on the order of the tools", async () => {
    const a = fakeSpec({ name: "tool_a" });
    const b = fakeSpec({ name: "tool_b" });
    expect(await computeToolPolicyHash([a, b])).toBe(await computeToolPolicyHash([b, a]));
  });

  it("changes when anything a tool declares changes", async () => {
    const base = await computeToolPolicyHash([fakeSpec()]);
    const changes: Array<[string, Partial<ToolSpec>]> = [
      ["name", { name: "fake_other" }],
      ["description", { description: "Reads one thing from the owner's own data, and more." }],
      ["risk", { risk: "write" }],
      ["requires.auth", { requires: { auth: false, paid: false, codeExecution: false } }],
      ["requires.paid", { requires: { auth: true, paid: true, codeExecution: false } }],
      ["requires.codeExecution", { requires: { auth: true, paid: false, codeExecution: true } }],
      ["approval", { approval: "required" }],
      [
        "input schema",
        { inputSchema: jsonSchema({ type: "object", properties: { q: { type: "string" }, limit: { type: "number" } } }) },
      ],
    ];
    const seen = new Set([base]);
    for (const [label, override] of changes) {
      const hash = await computeToolPolicyHash([fakeSpec(override)]);
      expect(seen.has(hash), label).toBe(false);
      seen.add(hash);
    }
  });

  it("does not depend on the key order of the input schema", async () => {
    const one = fakeSpec({ inputSchema: jsonSchema({ type: "object", properties: { a: { type: "string" }, b: { type: "number" } } }) });
    const two = fakeSpec({ inputSchema: jsonSchema({ properties: { b: { type: "number" }, a: { type: "string" } }, type: "object" }) });
    expect(await computeToolPolicyHash([one])).toBe(await computeToolPolicyHash([two]));
  });
});

describe("the Autopilot policy", () => {
  it("offers only the allowlisted tools, and never one that needs an approval", () => {
    const read = fakeSpec({ name: "allowed_read" });
    const notListed = fakeSpec({ name: "not_listed" });
    const needsApproval = fakeSpec({ name: "needs_approval", approval: "required" });
    const specs = autopilotToolSpecs({
      registry: [read, notListed, needsApproval],
      allowlist: ["allowed_read", "needs_approval"],
    });
    expect(specs.map((spec) => spec.name)).toEqual(["allowed_read"]);
  });

  it("moves the hash when a listed tool changes after approval, and not for a tool it does not list", async () => {
    const listed = fakeSpec({ name: "listed" });
    const other = fakeSpec({ name: "other" });
    const source = { registry: [listed, other], allowlist: ["listed"] };
    const approved = await currentAutopilotPolicyHash(source);

    other.description = "Another tool, edited long after the owner approved the workflow.";
    expect(await currentAutopilotPolicyHash(source)).toBe(approved);

    listed.risk = "write";
    const current = await currentAutopilotPolicyHash(source);
    expect(current).not.toBe(approved);
    expect(await checkPolicyApproval({ policyHash: approved }, source)).toEqual({
      ok: false,
      approvedHash: approved,
      currentHash: current,
    });
  });

  it("approves the policy the owner approved, and approves again after the owner re-approves", async () => {
    const listed = fakeSpec({ name: "listed" });
    const source = { registry: [listed], allowlist: ["listed"] };
    const approved = await currentAutopilotPolicyHash(source);
    expect(await checkPolicyApproval({ policyHash: approved }, source)).toEqual({ ok: true });

    listed.description = "A new description of the same tool, long enough to count.";
    expect((await checkPolicyApproval({ policyHash: approved }, source)).ok).toBe(false);
    const reapproved = await currentAutopilotPolicyHash(source);
    expect(await checkPolicyApproval({ policyHash: reapproved }, source)).toEqual({ ok: true });
  });

  it("does not depend on the owner's plan: the hash pins the code, the plan only narrows", async () => {
    const paid = fakeSpec({ name: "paid_tool", requires: { auth: true, paid: true, codeExecution: false } });
    const source = { registry: [paid], allowlist: ["paid_tool"] };
    expect(await currentAutopilotPolicyHash(source)).not.toBe(NO_TOOLS_POLICY_HASH);
    // A free owner receives no tool, while the policy hash stays the one a pro owner approved.
    const calls: RecordedToolCall[] = [];
    expect(buildAutopilotTools({ userId: "owner-1", tier: "free" }, { observe: false, calls }, source)).toBeUndefined();
    expect(Object.keys(buildAutopilotTools({ userId: "owner-1", tier: "pro" }, { observe: false, calls }, source) ?? {})).toEqual([
      "paid_tool",
    ]);
  });
});

describe("buildAutopilotTools", () => {
  const source = { registry: [fakeSpec()], allowlist: ["fake_read"] };
  type Callable = { execute: (input: unknown, options: unknown) => Promise<unknown> };
  const call = (tools: object | undefined, name: string, input: unknown) =>
    (tools as Record<string, Callable>)[name].execute(input, { toolCallId: "t", messages: [] });

  it("gives the model no tool when the policy offers none", () => {
    expect(buildAutopilotTools(OWNER, { observe: false, calls: [] })).toBeUndefined();
    expect(buildAutopilotTools(OWNER, { observe: true, calls: [] })).toBeUndefined();
  });

  it("in observe mode records the call and never executes the tool", async () => {
    execute.mockResolvedValue({ secret: "must not be returned" });
    const calls: RecordedToolCall[] = [];
    const tools = buildAutopilotTools(OWNER, { observe: true, calls }, source);

    const result = await call(tools, "fake_read", { q: "a" });

    expect(execute).not.toHaveBeenCalled();
    expect(result).toEqual(OBSERVED_TOOL_RESULT);
    expect(calls).toEqual([{ toolName: "fake_read", input: { q: "a" } }]);
  });

  it("in active mode records the call and runs the tool", async () => {
    execute.mockResolvedValue({ found: true });
    const calls: RecordedToolCall[] = [];
    const tools = buildAutopilotTools(OWNER, { observe: false, calls }, source);

    expect(await call(tools, "fake_read", { q: "a" })).toEqual({ found: true });
    expect(execute).toHaveBeenCalledWith({ q: "a" });
    expect(calls).toEqual([{ toolName: "fake_read", input: { q: "a" } }]);
  });

  it("keeps the model's view of the tool: description and input schema are the registry's", () => {
    const tools = buildAutopilotTools(OWNER, { observe: true, calls: [] }, source) as Record<string, { description?: string }>;
    expect(tools.fake_read.description).toBe("Reads one thing.");
  });

  it("never offers a tool that needs code execution, whatever the allowlist says", () => {
    const exec = fakeSpec({ name: "runs_code", risk: "exec", requires: { auth: false, paid: false, codeExecution: true } });
    expect(buildAutopilotTools(OWNER, { observe: false, calls: [] }, { registry: [exec], allowlist: ["runs_code"] })).toBeUndefined();
  });
});
