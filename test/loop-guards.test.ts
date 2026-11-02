import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MAX_UNUSABLE_STEPS,
  INITIAL_LOOP_GUARD_STATE,
  appendNoticeBeforeFinish,
  buildLoopGuardMessage,
  classifyRewrite,
  createLoopGuard,
  foldSteps,
  isEmptyStep,
  isFailedStep,
  isRepeatStep,
  nextLoopState,
  readMaxUnusableSteps,
  shouldStop,
  withLoopGuardNotice,
  type LoopStep,
} from "@/lib/agent/loop-guards";

const empty: LoopStep = { text: "   ", toolCalls: [] };
const said = (text: string): LoopStep => ({ text });
const call = (toolName: string, input: unknown, failed = false): LoopStep => ({
  text: "",
  toolCalls: [{ toolName, input }],
  content: [{ type: failed ? "tool-error" : "tool-result" }],
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isEmptyStep", () => {
  it("is true for no text and no tool call", () => {
    expect(isEmptyStep({})).toBe(true);
    expect(isEmptyStep(empty)).toBe(true);
  });

  it("is false for a step with text or a tool call", () => {
    expect(isEmptyStep(said("Here is the answer."))).toBe(false);
    expect(isEmptyStep(call("search_knowledge_base", { query: "a" }))).toBe(false);
  });
});

describe("isRepeatStep", () => {
  it("detects 2 identical texts in a row", () => {
    expect(isRepeatStep(said("Working on it."), said("  Working on it. "))).toBe(true);
  });

  it("does not flag two different texts, nor two empty steps", () => {
    expect(isRepeatStep(said("First."), said("Second."))).toBe(false);
    expect(isRepeatStep(empty, empty)).toBe(false);
  });

  it("detects the same tool with the same arguments, whatever the key order", () => {
    expect(isRepeatStep(call("t", { a: 1, b: { c: 2, d: 3 } }), call("t", { b: { d: 3, c: 2 }, a: 1 }))).toBe(true);
  });

  it("does not flag the same tool with other arguments, or another tool", () => {
    expect(isRepeatStep(call("t", { q: "a" }), call("t", { q: "b" }))).toBe(false);
    expect(isRepeatStep(call("t", { q: "a" }), call("u", { q: "a" }))).toBe(false);
  });
});

describe("isFailedStep", () => {
  it("is true when every tool call failed", () => {
    expect(isFailedStep(call("t", {}, true))).toBe(true);
  });

  it("is false when a call succeeded, and for a step with no tool call", () => {
    expect(isFailedStep(call("t", {}, false))).toBe(false);
    expect(isFailedStep(said("text"))).toBe(false);
    expect(
      isFailedStep({
        toolCalls: [
          { toolName: "a", input: {} },
          { toolName: "b", input: {} },
        ],
        content: [{ type: "tool-error" }, { type: "tool-result" }],
      }),
    ).toBe(false);
  });
});

describe("shouldStop", () => {
  it("stops after 3 consecutive empty steps and not before", () => {
    let state = INITIAL_LOOP_GUARD_STATE;
    const outcomes = [empty, empty, empty].map((step) => {
      state = nextLoopState(state, step);
      return shouldStop(state, 3);
    });
    expect(outcomes).toEqual([false, false, true]);
    expect(state.reason).toBe("empty_steps");
  });

  it("stops after 2 empty steps when the limit is 2", () => {
    expect(shouldStop(foldSteps([empty, empty]), 2)).toBe(true);
    expect(shouldStop(foldSteps([empty]), 2)).toBe(false);
  });

  it("a useful step resets the counter", () => {
    const state = foldSteps([empty, empty, said("A real answer."), empty, empty]);
    expect(state.unusableSteps).toBe(2);
    expect(shouldStop(state, 3)).toBe(false);
    expect(foldSteps([empty, empty, said("A real answer.")]).unusableSteps).toBe(0);
  });

  it("counts 2 identical texts as a repetition and stops on the third", () => {
    expect(foldSteps([said("Same."), said("Same.")])).toMatchObject({ unusableSteps: 2, reason: "repeated_steps" });
    expect(shouldStop(foldSteps([said("Same."), said("Same.")]), 3)).toBe(false);
    expect(shouldStop(foldSteps([said("Same."), said("Same."), said("Same.")]), 3)).toBe(true);
  });

  it("stops when the same tool is called with the same arguments 3 times", () => {
    const same = call("search_knowledge_base", { query: "q" });
    expect(shouldStop(foldSteps([same, same]), 3)).toBe(false);
    const state = foldSteps([same, same, same]);
    expect(shouldStop(state, 3)).toBe(true);
    expect(state.reason).toBe("repeated_steps");
  });

  it("opens the circuit after 3 failures in a row, even with different calls", () => {
    const steps = [call("t", { n: 1 }, true), call("t", { n: 2 }, true), call("u", { n: 3 }, true)];
    expect(shouldStop(foldSteps(steps.slice(0, 2)), 3)).toBe(false);
    const state = foldSteps(steps);
    expect(shouldStop(state, 3)).toBe(true);
    expect(state.reason).toBe("tool_failures");
  });

  it("a success between failures resets the circuit", () => {
    const state = foldSteps([call("t", { n: 1 }, true), call("t", { n: 2 }, true), call("t", { n: 3 }, false), call("t", { n: 4 }, true)]);
    expect(state.unusableSteps).toBe(1);
  });

  it("never stops on a loop that makes progress", () => {
    const steps = [call("t", { n: 1 }), call("t", { n: 2 }), said("Partial."), call("t", { n: 3 }), said("Done.")];
    expect(shouldStop(foldSteps(steps), 1)).toBe(false);
  });
});

describe("AGENT_MAX_UNUSABLE_STEPS", () => {
  it("defaults to 3 when unset", () => {
    expect(DEFAULT_MAX_UNUSABLE_STEPS).toBe(3);
    expect(readMaxUnusableSteps({})).toBe(3);
  });

  it("is read from the environment", () => {
    expect(readMaxUnusableSteps({ AGENT_MAX_UNUSABLE_STEPS: "5" })).toBe(5);
    expect(readMaxUnusableSteps({ AGENT_MAX_UNUSABLE_STEPS: " 2 " })).toBe(2);
  });

  it("falls back to the default for a value that would disable the guard", () => {
    for (const bad of ["", "0", "-1", "abc", "2.5", "1e3"]) {
      expect(readMaxUnusableSteps({ AGENT_MAX_UNUSABLE_STEPS: bad }), bad).toBe(3);
    }
  });

  it("is what shouldStop uses when no limit is given", () => {
    const original = process.env.AGENT_MAX_UNUSABLE_STEPS;
    try {
      process.env.AGENT_MAX_UNUSABLE_STEPS = "2";
      expect(shouldStop(foldSteps([empty, empty]))).toBe(true);
      delete process.env.AGENT_MAX_UNUSABLE_STEPS;
      expect(shouldStop(foldSteps([empty, empty]))).toBe(false);
    } finally {
      if (original === undefined) delete process.env.AGENT_MAX_UNUSABLE_STEPS;
      else process.env.AGENT_MAX_UNUSABLE_STEPS = original;
    }
  });
});

describe("the message the user reads", () => {
  it("is readable for every reason: no stack, no code name, no raw error", () => {
    for (const reason of ["empty_steps", "repeated_steps", "tool_failures"] as const) {
      const message = buildLoopGuardMessage(reason);
      expect(message, reason).toMatch(/^I stopped here because /);
      expect(message, reason).not.toMatch(/Error|undefined|\bat \w+\.|_steps|_failures|\{|\}/);
    }
  });

  it("is added after the model's text, or alone when there is none", () => {
    expect(withLoopGuardNotice("Partial answer.", "tool_failures")).toBe(`Partial answer.\n\n${buildLoopGuardMessage("tool_failures")}`);
    expect(withLoopGuardNotice("", "empty_steps")).toBe(buildLoopGuardMessage("empty_steps"));
    expect(withLoopGuardNotice(" Final. ", null)).toBe("Final.");
  });
});

describe("createLoopGuard", () => {
  const stepsOf = (...steps: LoopStep[]) => ({ steps }) as Parameters<ReturnType<typeof createLoopGuard>["stopWhen"]>[0];

  it("stops, records the reason and builds the notice once the limit is reached", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const guard = createLoopGuard({ limit: 3, label: "test" });
    expect(guard.notice()).toBeNull();

    expect(await guard.stopWhen(stepsOf(empty, empty))).toBe(false);
    expect(guard.stopReason()).toBeNull();

    expect(await guard.stopWhen(stepsOf(empty, empty, empty))).toBe(true);
    expect(guard.stopReason()).toBe("empty_steps");
    expect(guard.notice()).toBe(buildLoopGuardMessage("empty_steps"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"event":"test.loop_guard.tripped"'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"code":"empty_steps"'));
  });

  it("logs each unusable step by its code, without the step's content", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const guard = createLoopGuard({ limit: 3 });
    guard.onStepFinish(said("secret customer text"));
    expect(warn).not.toHaveBeenCalled();
    guard.onStepFinish(said("secret customer text"));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('"code":"repeated_steps"');
    expect(warn.mock.calls[0][0]).not.toContain("secret customer text");
  });

  it("does not trip on a loop that makes progress", async () => {
    const guard = createLoopGuard({ limit: 2 });
    expect(await guard.stopWhen(stepsOf(call("t", { n: 1 }), call("t", { n: 2 }), said("Done.")))).toBe(false);
    expect(guard.notice()).toBeNull();
  });
});

describe("classifyRewrite", () => {
  it("stops on an empty rewrite", () => {
    expect(classifyRewrite("draft", "")).toBe("empty_rewrite");
    expect(classifyRewrite("draft", " \n ")).toBe("empty_rewrite");
  });

  it("stops on a rewrite identical to the draft, ignoring surrounding whitespace", () => {
    expect(classifyRewrite("<quill-artifact>x</quill-artifact>", "\n<quill-artifact>x</quill-artifact> ")).toBe("identical_rewrite");
  });

  it("lets a real rewrite through", () => {
    expect(classifyRewrite("draft", "draft, improved")).toBeNull();
  });
});

describe("appendNoticeBeforeFinish", () => {
  const streamOf = (chunks: Array<{ type: string; [key: string]: unknown }>) =>
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    });

  async function drain(stream: ReadableStream<{ type: string }>) {
    const out: Array<{ type: string; [key: string]: unknown }> = [];
    const reader = stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return out;
      out.push(value as { type: string });
    }
  }

  const base = [{ type: "start" }, { type: "text-delta", id: "0", delta: "Hi" }, { type: "finish-step" }, { type: "finish" }];

  it("puts the notice as a text part just before finish", async () => {
    const out = await drain(appendNoticeBeforeFinish(streamOf(base), () => "I stopped here."));
    expect(out.map((chunk) => chunk.type)).toEqual([
      "start",
      "text-delta",
      "finish-step",
      "start-step",
      "text-start",
      "text-delta",
      "text-end",
      "finish-step",
      "finish",
    ]);
    expect(out[5]).toMatchObject({ delta: "I stopped here." });
  });

  it("leaves the stream untouched when there is no notice", async () => {
    const out = await drain(appendNoticeBeforeFinish(streamOf(base), () => null));
    expect(out).toEqual(base);
  });
});
