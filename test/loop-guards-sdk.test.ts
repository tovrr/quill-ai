import { describe, expect, it, vi } from "vitest";
import { jsonSchema, simulateReadableStream, stepCountIs, streamText, tool } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { appendNoticeBeforeFinish, buildLoopGuardMessage, createLoopGuard } from "@/lib/agent/loop-guards";

// The guards read the AI SDK's real step results, so this runs the SDK's own loop with a
// scripted model instead of hand-made steps.

const usage = {
  inputTokens: { total: 3, noCache: 3, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

type ToolCall = { name: string; input: object } | { text: string } | null;

// One scripted model response per call: a tool call, a text answer, or an empty answer when null.
function scriptedModel(script: ToolCall[]) {
  let n = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      const next = script[Math.min(n, script.length - 1)];
      n += 1;
      const parts = next && "text" in next
        ? [
            { type: "text-start", id: "t" },
            { type: "text-delta", id: "t", delta: next.text },
            { type: "text-end", id: "t" },
            { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
          ]
        : next
        ? [
            { type: "tool-call", toolCallId: `call-${n}`, toolName: next.name, input: JSON.stringify(next.input) },
            { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
          ]
        : [{ type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage }];
      return {
        stream: simulateReadableStream({ chunks: [{ type: "stream-start", warnings: [] }, ...parts] as never[] }),
      };
    },
  });
}

const lookup = (execute: () => Promise<unknown>) =>
  tool({
    description: "Looks one thing up.",
    inputSchema: jsonSchema<{ q: string }>({ type: "object", properties: { q: { type: "string" } }, required: ["q"] }),
    execute,
  });

async function runLoop(script: ToolCall[], execute: () => Promise<unknown>) {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  warn.mockClear(); // the spy is shared by the tests of this file
  const model = scriptedModel(script);
  const guard = createLoopGuard({ limit: 3, label: "sdk-test" });
  const result = streamText({
    model,
    prompt: "go",
    tools: { lookup: lookup(execute) },
    stopWhen: [stepCountIs(10), guard.stopWhen],
    onStepFinish: guard.onStepFinish,
  });

  const chunks: Array<{ type: string; delta?: string }> = [];
  const reader = appendNoticeBeforeFinish(result.toUIMessageStream(), guard.notice).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value as { type: string; delta?: string });
  }
  // The events onStepFinish and stopWhen logged, by event name and code.
  const logged = warn.mock.calls.map((call) => JSON.parse(String(call[0])) as { event: string; code: string });
  return { guard, chunks, modelCalls: model.doStreamCalls.length, logged };
}

describe("loop guards on the AI SDK's real loop", () => {
  it("cuts a loop that calls the same tool with the same arguments, and tells the user", async () => {
    const execute = vi.fn(async () => ({ found: false }));
    const { guard, chunks, modelCalls, logged } = await runLoop([{ name: "lookup", input: { q: "same" } }], execute);

    expect(modelCalls).toBe(3);
    expect(execute).toHaveBeenCalledTimes(3);
    expect(guard.stopReason()).toBe("repeated_steps");
    // onStepFinish receives what the guard can read: it logs the 2nd and 3rd identical step.
    expect(logged.filter((entry) => entry.event === "sdk-test.loop_guard.unusable_step").map((entry) => entry.code)).toEqual([
      "repeated_steps",
      "repeated_steps",
    ]);
    const notice = chunks.find((chunk) => chunk.type === "text-delta" && chunk.delta === buildLoopGuardMessage("repeated_steps"));
    expect(notice).toBeDefined();
    expect(chunks.at(-1)?.type).toBe("finish");
  });

  it("opens the circuit after 3 failing tool calls in a row, even with different arguments", async () => {
    const execute = vi.fn(async () => {
      throw new Error("backend down");
    });
    const { guard, chunks, modelCalls } = await runLoop(
      [
        { name: "lookup", input: { q: "a" } },
        { name: "lookup", input: { q: "b" } },
        { name: "lookup", input: { q: "c" } },
        { name: "lookup", input: { q: "d" } },
      ],
      execute,
    );

    expect(modelCalls).toBe(3);
    expect(guard.stopReason()).toBe("tool_failures");
    const text = chunks.filter((chunk) => chunk.type === "text-delta").map((chunk) => chunk.delta).join("");
    expect(text).toContain(buildLoopGuardMessage("tool_failures"));
    expect(text).not.toContain("backend down");
  });

  it("does not interfere with a loop that makes progress and then answers", async () => {
    const execute = vi.fn(async () => ({ found: true }));
    const { guard, chunks, modelCalls, logged } = await runLoop(
      [
        { name: "lookup", input: { q: "a" } },
        { name: "lookup", input: { q: "b" } },
        { text: "Here is what I found." },
      ],
      execute,
    );

    expect(modelCalls).toBe(3);
    expect(guard.stopReason()).toBeNull();
    expect(guard.notice()).toBeNull();
    expect(logged).toEqual([]); // no false "unusable step" on a step that made progress
    expect(chunks.some((chunk) => chunk.delta === buildLoopGuardMessage("repeated_steps"))).toBe(false);
  });
});
