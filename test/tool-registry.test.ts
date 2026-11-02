import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executeCode: vi.fn(),
  embedText: vi.fn(),
  searchChunks: vi.fn(),
}));

// The registry only builds the tools here; nothing reaches the sandbox, the embedding
// API or the database.
vi.mock("@/lib/execution/service", () => ({ executeCode: mocks.executeCode }));
vi.mock("@/lib/rag/embed", () => ({ embedText: mocks.embedText }));
vi.mock("@/lib/rag/search", () => ({ searchChunks: mocks.searchChunks }));

import { buildToolsForRequest, TOOL_REGISTRY, type ToolContext } from "@/lib/tools/registry";

const ALLOWED_RISKS = ["read", "network", "exec", "write"];
const TIERS: ToolContext["tier"][] = ["free", "pro"];

// What /api/chat handed to streamText before the registry existed, frozen from
// `route.ts` @ 9f47546:
//   ...(canRunCode ? { run_code } : {}),
//   ...(userId !== "guest" ? { search_knowledge_base } : {}),
// Key order is part of it: it is the order the model receives the tools in.
const TOOL_NAMES_BEFORE_THE_REGISTRY = [
  { label: "guest", userId: "guest", canRunCode: false, names: [] as string[] },
  { label: "guest with code", userId: "guest", canRunCode: true, names: ["run_code"] },
  { label: "signed in, no code", userId: "user-1", canRunCode: false, names: ["search_knowledge_base"] },
  { label: "signed in, with code", userId: "user-1", canRunCode: true, names: ["run_code", "search_knowledge_base"] },
];

const RUN_CODE_DESCRIPTION_BEFORE =
  "Execute Python code in a sandboxed environment and return stdout, stderr, and exit code. " +
  "Use this to run computations, test logic, or validate code. " +
  "The sandbox has no filesystem persistence between calls.";

const SEARCH_KNOWLEDGE_BASE_DESCRIPTION_BEFORE =
  "Search the user's personal knowledge base for relevant information. " +
  "Use this when the user asks about their documents, notes, or any previously ingested content. " +
  "Returns the most semantically similar text chunks from the knowledge base.";

// A tool's `execute` takes (input, options); the options are unused by both tools.
type Executable = { execute: (input: unknown, options: unknown) => Promise<unknown> };
const callTool = (tool: unknown, input: unknown) => (tool as Executable).execute(input, { toolCallId: "t", messages: [] });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tool registry", () => {
  it("describes every tool with a known risk and a real description", () => {
    expect(TOOL_REGISTRY.length).toBeGreaterThan(0);
    for (const spec of TOOL_REGISTRY) {
      expect(ALLOWED_RISKS, spec.name).toContain(spec.risk);
      expect(spec.description.length, spec.name).toBeGreaterThanOrEqual(20);
    }
  });

  it("names each tool once", () => {
    const names = TOOL_REGISTRY.map((spec) => spec.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("rates run_code as exec and the knowledge base as read", () => {
    const risks = Object.fromEntries(TOOL_REGISTRY.map((spec) => [spec.name, spec.risk]));
    expect(risks).toEqual({ run_code: "exec", search_knowledge_base: "read" });
  });

  it("declares no tool that waits for an approval", () => {
    expect(TOOL_REGISTRY.map((spec) => spec.approval)).toEqual(TOOL_REGISTRY.map(() => "none"));
  });
});

describe("buildToolsForRequest", () => {
  it.each(TOOL_NAMES_BEFORE_THE_REGISTRY)("$label gets the same tools as before", ({ userId, canRunCode, names }) => {
    for (const tier of TIERS) {
      expect(Object.keys(buildToolsForRequest({ userId, canRunCode, tier }))).toEqual(names);
    }
  });

  it("does not give a guest search_knowledge_base", () => {
    for (const canRunCode of [false, true]) {
      for (const tier of TIERS) {
        expect(buildToolsForRequest({ userId: "guest", canRunCode, tier })).not.toHaveProperty("search_knowledge_base");
      }
    }
  });

  it("gives run_code only when canRunCode is true", () => {
    for (const userId of ["guest", "user-1"]) {
      for (const tier of TIERS) {
        expect(buildToolsForRequest({ userId, canRunCode: false, tier })).not.toHaveProperty("run_code");
        expect(buildToolsForRequest({ userId, canRunCode: true, tier })).toHaveProperty("run_code");
      }
    }
  });

  it("hands the model the descriptions it got before", () => {
    const tools = buildToolsForRequest({ userId: "user-1", canRunCode: true, tier: "free" });
    expect(tools.run_code.description).toBe(RUN_CODE_DESCRIPTION_BEFORE);
    expect(tools.search_knowledge_base.description).toBe(SEARCH_KNOWLEDGE_BASE_DESCRIPTION_BEFORE);
  });

  it("builds each tool from the description and schema its spec declares", () => {
    const tools = buildToolsForRequest({ userId: "user-1", canRunCode: true, tier: "pro" });
    for (const spec of TOOL_REGISTRY) {
      expect(tools[spec.name].description, spec.name).toBe(spec.description);
      expect(tools[spec.name].inputSchema, spec.name).toBe(spec.inputSchema);
    }
  });

  it("keeps the input schemas the model got before", () => {
    const tools = buildToolsForRequest({ userId: "user-1", canRunCode: true, tier: "free" });
    expect((tools.run_code.inputSchema as { jsonSchema: unknown }).jsonSchema).toEqual({
      type: "object",
      properties: {
        code: { type: "string", description: "The source code to execute." },
        language: {
          type: "string",
          enum: ["python"],
          description: "The programming language. Currently only 'python' is supported.",
        },
      },
      required: ["code", "language"],
    });
    expect((tools.search_knowledge_base.inputSchema as { jsonSchema: unknown }).jsonSchema).toEqual({
      type: "object",
      properties: {
        query: { type: "string", description: "The search query to find relevant knowledge base content." },
        limit: { type: "number", description: "Maximum number of results to return (1-10, default 5)." },
      },
      required: ["query"],
    });
  });
});

describe("run_code tool", () => {
  it("runs the code with the 15 s timeout and reports the result", async () => {
    mocks.executeCode.mockResolvedValue({ ok: true, stdout: "", stderr: "", exitCode: 0, durationMs: 12 });
    const tools = buildToolsForRequest({ userId: "user-1", canRunCode: true, tier: "free" });

    const output = await callTool(tools.run_code, { code: "print(1)", language: "python" });

    expect(mocks.executeCode).toHaveBeenCalledWith({ code: "print(1)", language: "python", timeoutMs: 15_000 });
    expect(output).toEqual({ ok: true, stdout: "(no output)", stderr: undefined, exitCode: 0, durationMs: 12 });
  });

  it("passes a sandbox error through", async () => {
    mocks.executeCode.mockResolvedValue({ ok: false, stdout: "", stderr: "boom", exitCode: 1, durationMs: 3, error: "failed" });
    const tools = buildToolsForRequest({ userId: "user-1", canRunCode: true, tier: "free" });

    const output = await callTool(tools.run_code, { code: "1/0", language: "python" });

    expect(output).toEqual({ ok: false, stdout: "(no output)", stderr: "boom", exitCode: 1, durationMs: 3, error: "failed" });
  });
});

describe("search_knowledge_base tool", () => {
  const tools = () => buildToolsForRequest({ userId: "user-1", canRunCode: false, tier: "free" });

  it("searches the knowledge base of the signed-in user and rounds the similarity", async () => {
    mocks.embedText.mockResolvedValue([0.1, 0.2]);
    mocks.searchChunks.mockResolvedValue([{ documentTitle: "Notes", content: "hello", similarity: 0.87654 }]);

    const output = await callTool(tools().search_knowledge_base, { query: "hi" });

    expect(mocks.searchChunks).toHaveBeenCalledWith([0.1, 0.2], "user-1", 5);
    expect(output).toEqual({ found: true, results: [{ documentTitle: "Notes", content: "hello", similarity: 0.88 }] });
  });

  it("caps the limit at 10", async () => {
    mocks.embedText.mockResolvedValue([0.1]);
    mocks.searchChunks.mockResolvedValue([]);

    const output = await callTool(tools().search_knowledge_base, { query: "hi", limit: 50 });

    expect(mocks.searchChunks).toHaveBeenCalledWith([0.1], "user-1", 10);
    expect(output).toEqual({ found: false, message: "No relevant content found in the knowledge base." });
  });

  it("says the search is unavailable when embedding fails", async () => {
    mocks.embedText.mockRejectedValue(new Error("no key"));

    const output = await callTool(tools().search_knowledge_base, { query: "hi" });

    expect(output).toEqual({
      found: false,
      message: "Knowledge base search is unavailable (OPENAI_API_KEY not configured).",
    });
  });
});
