/**
 * Autopilot workflow runner.
 *
 * Executes one due workflow directly with the AI SDK, on behalf of the workflow's
 * owner: the owner's token budget is checked, the result is saved in a chat that
 * belongs to the owner, and the usage is recorded against the owner. The runner never
 * throws; every failure comes back as a `failed` result with a readable reason.
 */

import { generateText } from "ai";
import { resolveModelForMode } from "@/lib/chat/model-selection";
import { checkTokenBudget } from "@/lib/chat/token-budgets";
import { resolveUserEntitlements } from "@/lib/auth/entitlements";
import { createChat, saveMessage } from "@/lib/data/db-helpers";
import { recordModelUsage } from "@/lib/observability/metrics";
import { describeErrorForLog, isTimeoutOrAbort } from "@/lib/autopilot/errors";

/** Workflows executed per cron invocation; the rest stay due for the next one. */
export const MAX_WORKFLOWS_PER_INVOCATION = 5;

/**
 * Per-workflow model timeout. MAX_WORKFLOWS_PER_INVOCATION * this value must stay
 * under the route's `maxDuration` (300 s) so one slow model cannot starve the run.
 */
export const WORKFLOW_MODEL_TIMEOUT_MS = 50_000;

const SUMMARY_MAX_CHARS = 2_000;
const CHAT_TITLE_MAX_CHARS = 80;

export type WorkflowRow = {
  id: string;
  userId: string;
  name: string;
  prompt: string;
  cronExpression: string;
  timezone: string;
};

export type WorkflowRunResult = {
  status: "success" | "failed";
  summary: string;
  chatId?: string;
};

function failed(summary: string): WorkflowRunResult {
  return { status: "failed", summary: summary.slice(0, 500) };
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Same shape as the chat route's estimate for the fast mode: prompt size plus an
// expected answer, kept within a bounded range.
function estimateTokens(prompt: string): number {
  return Math.max(800, Math.min(12_000, Math.ceil(prompt.length / 4) + 800));
}

// The workflow row carries no e-mail, so a paid plan granted only through
// PAID_USER_EMAILS resolves as free here (the stricter budget).
async function resolveTier(userId: string): Promise<"free" | "pro"> {
  const entitlement = await resolveUserEntitlements({ userId });
  return entitlement.canUsePaidModes ? "pro" : "free";
}

export async function runWorkflow(workflow: WorkflowRow): Promise<WorkflowRunResult> {
  const { userId } = workflow;

  try {
    const tier = await resolveTier(userId);
    const budget = await checkTokenBudget(userId, tier, estimateTokens(workflow.prompt));
    if (!budget.allowed) {
      return failed(`Token budget exhausted: ${budget.reason ?? "limit reached"}`);
    }

    const resolved = await resolveModelForMode("fast", false);

    const result = await generateText({
      model: resolved.model,
      system:
        "You are Quill running a scheduled Autopilot workflow for the user. " +
        "Carry out the instruction and reply with the finished result only: " +
        "no questions, no offers to continue, no mention of being scheduled. " +
        `Current date and time (UTC): ${new Date().toISOString()}.`,
      prompt: workflow.prompt,
      abortSignal: AbortSignal.timeout(WORKFLOW_MODEL_TIMEOUT_MS),
    });

    const text = result.text.trim();

    let chatId: string | undefined;
    if (text) {
      try {
        const chat = await createChat(userId, `Autopilot: ${workflow.name}`.slice(0, CHAT_TITLE_MAX_CHARS));
        chatId = chat.id;
        await saveMessage({
          chatId,
          role: "assistant",
          content: text,
          parts: [{ type: "text", text }],
        });
      } catch (err) {
        // The run summary still carries the result; do not lose the usage record below.
        // The error message is left out: a failed insert's message carries the saved text.
        console.warn(
          JSON.stringify({
            event: "autopilot.run.persist_failed",
            workflowId: workflow.id,
            ...describeErrorForLog(err),
          }),
        );
      }
    }

    await recordModelUsage({
      userId,
      chatId,
      route: "/api/autopilot/cron",
      feature: "chat",
      mode: "fast",
      provider: resolved.provider,
      model: resolved.modelId,
      usage: result.totalUsage,
      providerMetadata: result.providerMetadata,
    });

    if (!text) {
      return failed("The model returned an empty response.");
    }

    return { status: "success", summary: text.slice(0, SUMMARY_MAX_CHARS), chatId };
  } catch (err) {
    return failed(
      isTimeoutOrAbort(err) ? `The model did not answer within ${WORKFLOW_MODEL_TIMEOUT_MS / 1000} s.` : errorText(err),
    );
  }
}
