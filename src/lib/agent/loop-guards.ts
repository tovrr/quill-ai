/**
 * Loop guards for the agent loop (the chat route and the Autopilot runner).
 *
 * A tool loop costs a model call per step, so a loop that makes no progress has to be
 * cut. A step is *unusable* when it is empty (no text and no tool call), when it repeats
 * the step before it (same text, or the same tools with the same arguments), or when
 * every tool call in it failed. Consecutive unusable steps are counted and the loop
 * stops when the count reaches the limit; a useful step resets the count.
 *
 * The functions are pure and import types only: the AI SDK wiring is `createLoopGuard`
 * at the bottom, and the tests need no mock.
 */

import type { StopCondition } from "ai";

/** Why a loop was cut. Recorded on the Autopilot run and in the log. */
export type LoopStopReason = "empty_steps" | "repeated_steps" | "tool_failures";

/** How many consecutive unusable steps stop the loop when AGENT_MAX_UNUSABLE_STEPS is not set. */
export const DEFAULT_MAX_UNUSABLE_STEPS = 3;

/** What the guards need to know about one step. A subset of the AI SDK's StepResult. */
export type LoopStep = {
  text?: string;
  toolCalls?: ReadonlyArray<{ toolName: string; input?: unknown }>;
  /** The step's content parts; a part of type `tool-error` is a failed tool call. */
  content?: ReadonlyArray<{ type: string }>;
};

export type LoopGuardState = {
  /** Consecutive unusable steps so far. */
  unusableSteps: number;
  /** Identity of the previous step: its tool calls, or its text; "" for an empty step. */
  previousKey: string;
  /** Whether the previous step was counted as unusable. */
  previousUnusable: boolean;
  /** Why the latest unusable step was unusable; null after a useful step. */
  reason: LoopStopReason | null;
};

export const INITIAL_LOOP_GUARD_STATE: LoopGuardState = {
  unusableSteps: 0,
  previousKey: "",
  previousUnusable: false,
  reason: null,
};

/**
 * The limit from AGENT_MAX_UNUSABLE_STEPS: a whole number of at least 1. Anything else
 * (unset, empty, 0, negative, not a number) falls back to the default instead of
 * disabling the guard.
 */
export function readMaxUnusableSteps(env: Record<string, string | undefined> = process.env): number {
  const raw = env.AGENT_MAX_UNUSABLE_STEPS?.trim();
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_MAX_UNUSABLE_STEPS;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 ? value : DEFAULT_MAX_UNUSABLE_STEPS;
}

// JSON with the keys of every object sorted, so the same arguments give the same string.
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, inner]) => inner !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${stableStringify(inner)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** The identity of a step for repeat detection: its tool calls when it has any, else its text. */
function stepKey(step: LoopStep): string {
  const calls = step.toolCalls ?? [];
  if (calls.length > 0) {
    return `calls:${calls.map((call) => `${call.toolName}(${stableStringify(call.input)})`).join(";")}`;
  }
  const text = (step.text ?? "").trim();
  return text ? `text:${text}` : "";
}

/** No text and no tool call. */
export function isEmptyStep(step: LoopStep): boolean {
  return stepKey(step) === "";
}

/** Every tool call in the step failed. A step that made no tool call has not failed. */
export function isFailedStep(step: LoopStep): boolean {
  const calls = step.toolCalls?.length ?? 0;
  if (calls === 0) return false;
  const errors = (step.content ?? []).filter((part) => part.type === "tool-error").length;
  return errors >= calls;
}

/** The step says, or does, exactly what the one before it did. An empty step repeats nothing. */
export function isRepeatStep(previous: LoopStep, step: LoopStep): boolean {
  const key = stepKey(step);
  return key !== "" && key === stepKey(previous);
}

/**
 * The state after one more step. A run of identical steps counts in full: the first
 * repeat also makes the step it repeats unusable, so three identical steps in a row
 * count 3, and two identical texts are already a repetition.
 */
export function nextLoopState(state: LoopGuardState, step: LoopStep): LoopGuardState {
  const key = stepKey(step);
  let reason: LoopStopReason | null = null;
  let added = 0;

  if (key === "") {
    reason = "empty_steps";
    added = 1;
  } else if (isFailedStep(step)) {
    reason = "tool_failures";
    added = 1;
  } else if (key === state.previousKey) {
    reason = "repeated_steps";
    added = state.previousUnusable ? 1 : 2;
  }

  return {
    unusableSteps: reason ? state.unusableSteps + added : 0,
    previousKey: key,
    previousUnusable: reason !== null,
    reason,
  };
}

/** The state after a list of steps, oldest first. */
export function foldSteps(steps: readonly LoopStep[]): LoopGuardState {
  return steps.reduce(nextLoopState, INITIAL_LOOP_GUARD_STATE);
}

/** True when the loop has to stop. */
export function shouldStop(state: LoopGuardState, limit: number = readMaxUnusableSteps()): boolean {
  return state.unusableSteps >= Math.max(1, limit);
}

const NOTICE_REASON_TEXT: Record<LoopStopReason, string> = {
  empty_steps: "the assistant kept returning empty answers",
  repeated_steps: "the assistant kept repeating the same step",
  tool_failures: "its tools kept failing",
};

/** What the user reads when a guard cuts the loop: readable, no error text, no internals. */
export function buildLoopGuardMessage(reason: LoopStopReason): string {
  return (
    `I stopped here because ${NOTICE_REASON_TEXT[reason]} and more steps would not have helped. ` +
    "You can rephrase the request or try again."
  );
}

/** The saved text of an answer: the model's text, then the notice when a guard cut the loop. */
export function withLoopGuardNotice(text: string, reason: LoopStopReason | null): string {
  const notice = reason ? buildLoopGuardMessage(reason) : "";
  return [text.trim(), notice].filter(Boolean).join("\n\n");
}

export type RewriteStop = "empty_rewrite" | "identical_rewrite";

/**
 * The two-pass builder's check on its rewrite: a rewrite that is empty, or the same as
 * the draft, adds nothing, so the passes after it (repair, quality retry) are skipped.
 */
export function classifyRewrite(draft: string, rewrite: string): RewriteStop | null {
  const next = rewrite.trim();
  if (!next) return "empty_rewrite";
  return next === draft.trim() ? "identical_rewrite" : null;
}

type UiChunk = { type: string; [key: string]: unknown };

/**
 * Passes a UI message stream through and, just before its `finish` chunk, adds the
 * notice as one more text part. Nothing is added when `getNotice` returns null at that
 * point, which is the case for every stream a guard did not cut.
 */
export function appendNoticeBeforeFinish<T extends UiChunk>(
  stream: ReadableStream<T>,
  getNotice: () => string | null,
): ReadableStream<T> {
  return stream.pipeThrough(
    new TransformStream<T, T>({
      transform(chunk, controller) {
        const notice = chunk.type === "finish" ? getNotice() : null;
        if (notice) {
          const id = "loop-guard-notice";
          for (const extra of [
            { type: "start-step" },
            { type: "text-start", id },
            { type: "text-delta", id, delta: notice },
            { type: "text-end", id },
            { type: "finish-step" },
          ]) {
            controller.enqueue(extra as unknown as T);
          }
        }
        controller.enqueue(chunk);
      },
    }),
  );
}

export type LoopGuard = {
  /** For `stopWhen`: true once the unusable-step limit is reached. */
  stopWhen: StopCondition<any, any>;
  /** For `onStepFinish`: logs each unusable step with its code. */
  onStepFinish: (step: LoopStep) => void;
  /** Why the guard cut the loop; null when it did not. */
  stopReason: () => LoopStopReason | null;
  /** The readable message for the user; null when the guard did not cut the loop. */
  notice: () => string | null;
};

/**
 * One guard per request or run. `stopWhen` works from the steps the SDK hands it, so it
 * does not depend on whether `onStepFinish` has run before it.
 */
export function createLoopGuard(options: { limit?: number; label?: string } = {}): LoopGuard {
  const limit = options.limit ?? readMaxUnusableSteps();
  const label = options.label ?? "agent";
  let state = INITIAL_LOOP_GUARD_STATE;
  let tripped: LoopStopReason | null = null;

  return {
    stopWhen: ({ steps }) => {
      const folded = foldSteps(steps);
      if (!shouldStop(folded, limit)) return false;
      if (tripped === null) {
        tripped = folded.reason ?? "empty_steps";
        console.warn(
          JSON.stringify({ event: `${label}.loop_guard.tripped`, code: tripped, unusableSteps: folded.unusableSteps, limit }),
        );
      }
      return true;
    },
    onStepFinish: (step) => {
      state = nextLoopState(state, step);
      if (state.reason) {
        console.warn(
          JSON.stringify({ event: `${label}.loop_guard.unusable_step`, code: state.reason, unusableSteps: state.unusableSteps, limit }),
        );
      }
    },
    stopReason: () => tripped,
    notice: () => (tripped ? buildLoopGuardMessage(tripped) : null),
  };
}
