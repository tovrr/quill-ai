import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const SECRET = "test-cron-secret";

type DueRow = {
  id: string;
  userId: string;
  name: string;
  prompt: string;
  cronExpression: string;
  timezone: string;
  nextRunAt: Date;
};

type OrderSpec = { dir: "asc" | "desc"; column: string };

const mocks = vi.hoisted(() => ({
  dueRows: [] as unknown[],
  limit: vi.fn(),
  generateText: vi.fn(),
  resolveModelForMode: vi.fn(),
  checkTokenBudget: vi.fn(),
  resolveUserEntitlements: vi.fn(),
  createChat: vi.fn(),
  saveMessage: vi.fn(),
  createAutopilotRun: vi.fn(),
  updateAutopilotWorkflowByUserId: vi.fn(),
  recordModelUsage: vi.fn(),
}));

// asc()/desc() return a marker the db mock below can sort by. Everything else in
// drizzle-orm stays real, so the schema and the route's where() clauses still build.
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    asc: (column: { name: string }) => ({ dir: "asc", column: column.name }),
    desc: (column: { name: string }) => ({ dir: "desc", column: column.name }),
  };
});

// The chain honours orderBy (rows come back sorted) but not limit: it hands back every
// row, so the route's own cap is what the "never runs more than" test exercises.
vi.mock("@/db", () => {
  let order: OrderSpec[] = [];
  const chain = {
    select: () => {
      order = [];
      return chain;
    },
    from: () => chain,
    where: () => chain,
    orderBy: (...specs: OrderSpec[]) => {
      order = specs;
      return chain;
    },
    limit: (n: number) => {
      mocks.limit(n);
      const rows = [...(mocks.dueRows as Record<string, unknown>[])];
      for (const { dir, column } of [...order].reverse()) {
        const sign = dir === "asc" ? 1 : -1;
        rows.sort((a, b) => sign * (new Date(a[column] as Date).getTime() - new Date(b[column] as Date).getTime()));
      }
      return Promise.resolve(rows);
    },
  };
  return { db: chain };
});

// Only generateText is faked: the tool registry (loaded through the Autopilot tool policy)
// builds its tools with the real tool() and jsonSchema().
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: mocks.generateText,
}));
// The registry's tool modules are never called here; stub what they import.
vi.mock("@/lib/execution/service", () => ({ executeCode: vi.fn() }));
vi.mock("@/lib/rag/embed", () => ({ embedText: vi.fn() }));
vi.mock("@/lib/rag/search", () => ({ searchChunks: vi.fn() }));
vi.mock("@/lib/chat/model-selection", () => ({ resolveModelForMode: mocks.resolveModelForMode }));
vi.mock("@/lib/chat/token-budgets", () => ({ checkTokenBudget: mocks.checkTokenBudget }));
vi.mock("@/lib/auth/entitlements", () => ({ resolveUserEntitlements: mocks.resolveUserEntitlements }));
vi.mock("@/lib/observability/metrics", () => ({ recordModelUsage: mocks.recordModelUsage }));
vi.mock("@/lib/data/db-helpers", () => ({
  createChat: mocks.createChat,
  saveMessage: mocks.saveMessage,
  createAutopilotRun: mocks.createAutopilotRun,
  updateAutopilotWorkflowByUserId: mocks.updateAutopilotWorkflowByUserId,
}));

import { jsonSchema, tool } from "ai";
import { GET, POST } from "@/app/api/autopilot/cron/route";
import { MAX_WORKFLOWS_PER_INVOCATION } from "@/lib/autopilot/run-workflow";
import { AUTOPILOT_TOOL_ALLOWLIST, currentAutopilotPolicyHash } from "@/lib/autopilot/tool-policy";
import { buildLoopGuardMessage } from "@/lib/agent/loop-guards";
import { TOOL_REGISTRY, type ToolSpec } from "@/lib/tools/registry";

function workflow(n: number, overrides: Partial<DueRow> = {}): DueRow {
  return {
    id: `wf-${n}`,
    userId: `owner-${n}`,
    name: `Workflow ${n}`,
    prompt: `Summarize the news for workflow ${n}`,
    cronExpression: "0 9 * * *",
    timezone: "UTC",
    // Workflow n is due n minutes after the previous one: a higher n is a later nextRunAt.
    nextRunAt: new Date(Date.UTC(2026, 9, 1, 0, n)),
    ...overrides,
  };
}

function cronRequest(method: "GET" | "POST", authorization?: string) {
  return new NextRequest("http://localhost/api/autopilot/cron", {
    method,
    headers: authorization ? { authorization } : undefined,
  });
}

const MODEL_TEXT = "Here is your daily digest: three items worth reading today.";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.CRON_SECRET = SECRET;

  mocks.dueRows = [];
  mocks.resolveUserEntitlements.mockResolvedValue({ canUsePaidModes: false });
  mocks.checkTokenBudget.mockResolvedValue({ allowed: true, dailyUsed: 0, monthlyUsed: 0 });
  mocks.resolveModelForMode.mockResolvedValue({ model: { id: "fake-model" }, provider: "google", modelId: "fake-model-id" });
  mocks.generateText.mockResolvedValue({
    text: `  ${MODEL_TEXT}  `,
    totalUsage: { inputTokens: 12, outputTokens: 34, totalTokens: 46 },
    providerMetadata: undefined,
  });
  mocks.createChat.mockImplementation(async (userId: string) => ({ id: `chat-for-${userId}` }));
  mocks.saveMessage.mockResolvedValue({ id: "msg-1" });
  mocks.createAutopilotRun.mockResolvedValue({ id: "run-1" });
  mocks.updateAutopilotWorkflowByUserId.mockResolvedValue({ id: "wf" });
  mocks.recordModelUsage.mockResolvedValue(undefined);
});

describe("autopilot cron: authorization", () => {
  it("GET without Authorization returns 401 and runs nothing", async () => {
    mocks.dueRows = [workflow(1)];
    const res = await GET(cronRequest("GET"));
    expect(res.status).toBe(401);
    expect(mocks.generateText).not.toHaveBeenCalled();
    expect(mocks.createChat).not.toHaveBeenCalled();
  });

  it("GET with a wrong bearer returns 401", async () => {
    const res = await GET(cronRequest("GET", "Bearer wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(cronRequest("GET", "Bearer undefined"));
    expect(res.status).toBe(401);
  });

  it("POST without Authorization returns 401", async () => {
    const res = await POST(cronRequest("POST"));
    expect(res.status).toBe(401);
  });
});

describe("autopilot cron: running a due workflow as its owner", () => {
  it("GET with the bearer returns ran: 0 when nothing is due", async () => {
    const res = await GET(cronRequest("GET", `Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ran: 0 });
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("creates the chat for workflow.userId, saves the assistant text and stores the model text as the run summary", async () => {
    const due = workflow(1);
    mocks.dueRows = [due];

    const res = await GET(cronRequest("GET", `Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ran: 1, results: [{ id: "wf-1", status: "success" }] });

    // Budget is checked for the owner, not a guest.
    expect(mocks.checkTokenBudget).toHaveBeenCalledWith("owner-1", "free", expect.any(Number));
    expect(mocks.resolveModelForMode).toHaveBeenCalledWith("fast", false);
    expect(mocks.generateText).toHaveBeenCalledTimes(1);
    expect(mocks.generateText.mock.calls[0][0]).toMatchObject({ prompt: due.prompt });

    // The chat and the message belong to the owner.
    expect(mocks.createChat).toHaveBeenCalledTimes(1);
    expect(mocks.createChat.mock.calls[0][0]).toBe("owner-1");
    expect(mocks.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: "chat-for-owner-1", role: "assistant", content: MODEL_TEXT }),
    );

    // Order: chat, then the assistant message, then the run.
    const order = (fn: { mock: { invocationCallOrder: number[] } }) => fn.mock.invocationCallOrder[0];
    expect(order(mocks.createChat)).toBeLessThan(order(mocks.saveMessage));
    expect(order(mocks.saveMessage)).toBeLessThan(order(mocks.createAutopilotRun));

    // Usage is recorded against the owner and the chat.
    expect(mocks.recordModelUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "owner-1",
        chatId: "chat-for-owner-1",
        route: "/api/autopilot/cron",
        provider: "google",
        model: "fake-model-id",
      }),
    );

    // The run summary is the model text, not a streamed fragment.
    expect(mocks.createAutopilotRun).toHaveBeenCalledTimes(1);
    const run = mocks.createAutopilotRun.mock.calls[0][0];
    expect(run).toMatchObject({ workflowId: "wf-1", userId: "owner-1", status: "success", summary: MODEL_TEXT });
    expect(run.summary).not.toMatch(/data:|\[DONE\]|"type":/);
    expect(run.errorMessage).toBeUndefined();

    // The workflow is claimed (rescheduled) before the model is called, then the run is recorded.
    expect(mocks.updateAutopilotWorkflowByUserId).toHaveBeenCalledTimes(2);
    expect(mocks.updateAutopilotWorkflowByUserId).toHaveBeenNthCalledWith(1, "wf-1", "owner-1", {
      nextRunAt: expect.any(Date),
    });
    expect(mocks.updateAutopilotWorkflowByUserId).toHaveBeenNthCalledWith(
      2,
      "wf-1",
      "owner-1",
      expect.objectContaining({ lastRunAt: expect.any(Date), lastRunStatus: "success" }),
    );
    expect(mocks.updateAutopilotWorkflowByUserId.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.generateText.mock.invocationCallOrder[0],
    );
  });

  it("uses the pro budget tier for an owner with paid access", async () => {
    mocks.dueRows = [workflow(1)];
    mocks.resolveUserEntitlements.mockResolvedValue({ canUsePaidModes: true });

    await GET(cronRequest("GET", `Bearer ${SECRET}`));

    expect(mocks.checkTokenBudget).toHaveBeenCalledWith("owner-1", "pro", expect.any(Number));
  });

  it("POST (manual run) behaves like GET", async () => {
    mocks.dueRows = [workflow(1)];

    const res = await POST(cronRequest("POST", `Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(mocks.createAutopilotRun).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success", summary: MODEL_TEXT }),
    );
  });
});

describe("autopilot cron: failures", () => {
  it("records a failed run with an explicit reason when the token budget is exhausted, and does not call the model", async () => {
    mocks.dueRows = [workflow(1)];
    mocks.checkTokenBudget.mockResolvedValue({
      allowed: false,
      reason: "Daily token limit reached (100,000 / 100,000). Upgrade to Pro for 10x higher limits.",
    });

    const res = await GET(cronRequest("GET", `Bearer ${SECRET}`));
    expect(await res.json()).toMatchObject({ ran: 1, results: [{ id: "wf-1", status: "failed" }] });

    expect(mocks.generateText).not.toHaveBeenCalled();
    expect(mocks.createChat).not.toHaveBeenCalled();
    expect(mocks.saveMessage).not.toHaveBeenCalled();

    const run = mocks.createAutopilotRun.mock.calls[0][0];
    expect(run.status).toBe("failed");
    expect(run.summary).toContain("Token budget exhausted");
    expect(run.summary).toContain("Daily token limit reached");
    expect(run.errorMessage).toBe(run.summary);

    // The workflow still moves on to its next slot instead of retrying every hour.
    expect(mocks.updateAutopilotWorkflowByUserId).toHaveBeenCalledWith("wf-1", "owner-1", {
      nextRunAt: expect.any(Date),
    });
    expect(mocks.updateAutopilotWorkflowByUserId).toHaveBeenCalledWith(
      "wf-1",
      "owner-1",
      expect.objectContaining({ lastRunStatus: "failed" }),
    );
  });

  it("records a failed run when the model call throws", async () => {
    mocks.dueRows = [workflow(1)];
    mocks.generateText.mockRejectedValue(new Error("provider unavailable"));

    await GET(cronRequest("GET", `Bearer ${SECRET}`));

    const run = mocks.createAutopilotRun.mock.calls[0][0];
    expect(run).toMatchObject({ status: "failed", summary: "provider unavailable", errorMessage: "provider unavailable" });
    expect(mocks.createChat).not.toHaveBeenCalled();
  });

  it("records a failed run when no model provider is configured", async () => {
    mocks.dueRows = [workflow(1)];
    mocks.resolveModelForMode.mockRejectedValue(new Error("No model provider configured for fast mode."));

    await GET(cronRequest("GET", `Bearer ${SECRET}`));

    const run = mocks.createAutopilotRun.mock.calls[0][0];
    expect(run.status).toBe("failed");
    expect(run.summary).toContain("No model provider configured");
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("fails an empty model answer without creating an empty chat", async () => {
    mocks.dueRows = [workflow(1)];
    mocks.generateText.mockResolvedValue({ text: "   ", totalUsage: {}, providerMetadata: undefined });

    await GET(cronRequest("GET", `Bearer ${SECRET}`));

    const run = mocks.createAutopilotRun.mock.calls[0][0];
    expect(run).toMatchObject({ status: "failed", summary: "The model returned an empty response." });
    expect(mocks.createChat).not.toHaveBeenCalled();
    expect(mocks.recordModelUsage).toHaveBeenCalledTimes(1);
  });

  it("keeps the model result as a success when the chat cannot be saved, and still records usage", async () => {
    mocks.dueRows = [workflow(1)];
    mocks.createChat.mockRejectedValue(new Error("db down"));

    await GET(cronRequest("GET", `Bearer ${SECRET}`));

    expect(mocks.createAutopilotRun).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success", summary: MODEL_TEXT }),
    );
    expect(mocks.recordModelUsage).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "owner-1", chatId: undefined }),
    );
  });

  it("keeps going when one workflow's run record cannot be saved", async () => {
    mocks.dueRows = [workflow(1), workflow(2)];
    mocks.createAutopilotRun.mockRejectedValueOnce(new Error("insert failed")).mockResolvedValue({ id: "run-2" });

    const res = await GET(cronRequest("GET", `Bearer ${SECRET}`));
    const body = await res.json();

    expect(body.ran).toBe(2);
    expect(body.results).toEqual([
      { id: "wf-1", status: "failed" },
      { id: "wf-2", status: "success" },
    ]);
  });
});

describe("autopilot cron: bookkeeping failures", () => {
  /** What a failed Drizzle write looks like: the message carries the SQL params. */
  function drizzleWriteError(leaked: string) {
    const err = new Error(`Failed query: insert into "autopilot_run" ...\nparams: ${leaked}`);
    err.name = "DrizzleQueryError";
    err.cause = Object.assign(new Error("connection terminated"), { code: "57P01" });
    return err;
  }

  it("still moves nextRunAt forward when the run record cannot be saved", async () => {
    mocks.dueRows = [workflow(1)];
    mocks.createAutopilotRun.mockRejectedValue(new Error("insert failed"));
    const before = Date.now();

    await GET(cronRequest("GET", `Bearer ${SECRET}`));

    const nextRunAts = mocks.updateAutopilotWorkflowByUserId.mock.calls
      .map(([, , updates]) => updates.nextRunAt as Date | undefined)
      .filter((nextRunAt): nextRunAt is Date => nextRunAt instanceof Date);
    expect(nextRunAts.length).toBeGreaterThan(0);
    for (const nextRunAt of nextRunAts) {
      expect(nextRunAt.getTime()).toBeGreaterThan(before);
    }
    // The last-run fields are written even though the run record was lost.
    expect(mocks.updateAutopilotWorkflowByUserId).toHaveBeenCalledWith(
      "wf-1",
      "owner-1",
      expect.objectContaining({ lastRunStatus: "success" }),
    );
  });

  it("does not call the model, and logs the workflow id, when nextRunAt cannot be moved", async () => {
    mocks.dueRows = [workflow(1)];
    mocks.updateAutopilotWorkflowByUserId.mockRejectedValue(drizzleWriteError("a prompt-sized secret"));

    const res = await GET(cronRequest("GET", `Bearer ${SECRET}`));

    expect(await res.json()).toMatchObject({ ran: 0, skipped: 1, results: [{ id: "wf-1", status: "skipped" }] });
    expect(mocks.generateText).not.toHaveBeenCalled();
    expect(mocks.createChat).not.toHaveBeenCalled();
    expect(mocks.recordModelUsage).not.toHaveBeenCalled();
    expect(mocks.createAutopilotRun).not.toHaveBeenCalled();

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(JSON.parse(vi.mocked(console.error).mock.calls[0][0] as string)).toEqual({
      event: "autopilot.cron.claim_failed",
      workflowId: "wf-1",
      errorName: "DrizzleQueryError",
      errorCode: "57P01",
    });
  });

  it("does not bill the workflow again on later ticks while its update keeps failing", async () => {
    mocks.dueRows = [workflow(1)];
    mocks.updateAutopilotWorkflowByUserId.mockRejectedValue(new Error("db read-only"));

    for (let tick = 0; tick < 3; tick += 1) {
      await GET(cronRequest("GET", `Bearer ${SECRET}`));
    }

    expect(mocks.generateText).not.toHaveBeenCalled();
    expect(mocks.recordModelUsage).not.toHaveBeenCalled();
  });

  it("runs the other due workflows when one workflow's update fails", async () => {
    mocks.dueRows = [workflow(1), workflow(2), workflow(3)];
    mocks.updateAutopilotWorkflowByUserId.mockImplementation(async (workflowId: string) => {
      if (workflowId === "wf-2") throw new Error("update failed");
      return { id: workflowId };
    });

    const res = await GET(cronRequest("GET", `Bearer ${SECRET}`));
    const body = await res.json();

    expect(body.results).toEqual([
      { id: "wf-1", status: "success" },
      { id: "wf-2", status: "skipped" },
      { id: "wf-3", status: "success" },
    ]);
    expect(body).toMatchObject({ ran: 2, skipped: 1 });
    expect(mocks.generateText.mock.calls.map(([args]) => args.prompt)).toEqual([
      workflow(1).prompt,
      workflow(3).prompt,
    ]);
  });

  it("keeps the run record and the other workflows when only the last-run update fails", async () => {
    mocks.dueRows = [workflow(1), workflow(2)];
    // Call 1 is wf-1's claim, call 2 is wf-1's last-run update.
    mocks.updateAutopilotWorkflowByUserId
      .mockResolvedValueOnce({ id: "wf-1" })
      .mockRejectedValueOnce(drizzleWriteError("run summary text"))
      .mockResolvedValue({ id: "wf-2" });

    const res = await GET(cronRequest("GET", `Bearer ${SECRET}`));
    const body = await res.json();

    expect(mocks.createAutopilotRun).toHaveBeenCalledTimes(2);
    expect(body.results).toEqual([
      { id: "wf-1", status: "failed" },
      { id: "wf-2", status: "success" },
    ]);
    expect(JSON.parse(vi.mocked(console.error).mock.calls[0][0] as string)).toMatchObject({
      event: "autopilot.cron.workflow_update_failed",
      workflowId: "wf-1",
    });
  });

  it("logs a lost run record with the workflow id and no prompt, answer or SQL parameters", async () => {
    mocks.dueRows = [workflow(1)];
    mocks.createAutopilotRun.mockRejectedValue(drizzleWriteError(MODEL_TEXT));

    await GET(cronRequest("GET", `Bearer ${SECRET}`));

    expect(console.error).toHaveBeenCalledTimes(1);
    const line = vi.mocked(console.error).mock.calls[0][0] as string;
    expect(JSON.parse(line)).toEqual({
      event: "autopilot.cron.run_record_failed",
      workflowId: "wf-1",
      errorName: "DrizzleQueryError",
      errorCode: "57P01",
    });
    expect(line).not.toContain(MODEL_TEXT);
    expect(line).not.toContain(workflow(1).prompt);
    expect(line).not.toContain(SECRET);
  });

  it("logs the message of a bug in the code, which holds no data", async () => {
    mocks.dueRows = [workflow(1)];
    // Thrown, not rejected: it escapes the allSettled and reaches the route's outer catch.
    mocks.createAutopilotRun.mockImplementation(() => {
      throw new TypeError("Cannot read properties of undefined (reading 'id')");
    });

    const res = await GET(cronRequest("GET", `Bearer ${SECRET}`));

    expect(await res.json()).toMatchObject({ results: [{ id: "wf-1", status: "failed" }] });
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(JSON.parse(vi.mocked(console.error).mock.calls[0][0] as string)).toEqual({
      event: "autopilot.cron.workflow_failed",
      workflowId: "wf-1",
      errorName: "TypeError",
      errorMessage: "Cannot read properties of undefined (reading 'id')",
    });
  });

  it("keeps the message out of the log when the unexpected error is a database error", async () => {
    mocks.dueRows = [workflow(1)];
    mocks.createAutopilotRun.mockImplementation(() => {
      throw drizzleWriteError(MODEL_TEXT);
    });

    await GET(cronRequest("GET", `Bearer ${SECRET}`));

    expect(console.error).toHaveBeenCalledTimes(1);
    const line = vi.mocked(console.error).mock.calls[0][0] as string;
    expect(JSON.parse(line)).toEqual({
      event: "autopilot.cron.workflow_failed",
      workflowId: "wf-1",
      errorName: "DrizzleQueryError",
      errorCode: "57P01",
    });
    expect(line).not.toContain(MODEL_TEXT);
  });

  it("does not put the saved text in the log when the chat cannot be saved", async () => {
    mocks.dueRows = [workflow(1)];
    mocks.saveMessage.mockRejectedValue(drizzleWriteError(MODEL_TEXT));

    await GET(cronRequest("GET", `Bearer ${SECRET}`));

    expect(console.warn).toHaveBeenCalledTimes(1);
    const line = vi.mocked(console.warn).mock.calls[0][0] as string;
    expect(JSON.parse(line)).toMatchObject({ event: "autopilot.run.persist_failed", workflowId: "wf-1" });
    expect(line).not.toContain(MODEL_TEXT);
  });
});

describe("autopilot cron: model timeout", () => {
  const TIMEOUT_SUMMARY = "The model did not answer within 50 s.";

  function timeoutError() {
    return new DOMException("The operation was aborted due to timeout", "TimeoutError");
  }

  // The AI SDK's own error classes name themselves AI_*; an abort can sit under `cause`
  // (APICallError) or `lastError` (RetryError).
  function aiSdkError(name: string, message: string, wrapped: Record<string, unknown>) {
    const err = new Error(message);
    err.name = name;
    return Object.assign(err, wrapped);
  }

  async function summaryAfter(error: unknown) {
    mocks.dueRows = [workflow(1)];
    mocks.generateText.mockRejectedValue(error);
    await GET(cronRequest("GET", `Bearer ${SECRET}`));
    return mocks.createAutopilotRun.mock.calls[0][0].summary as string;
  }

  it("explains a plain timeout", async () => {
    expect(await summaryAfter(timeoutError())).toBe(TIMEOUT_SUMMARY);
  });

  it("explains a timeout the AI SDK wrapped in its own error (cause)", async () => {
    const wrapped = aiSdkError("AI_APICallError", "Cannot connect to API: The operation was aborted", {
      cause: timeoutError(),
    });
    expect(await summaryAfter(wrapped)).toBe(TIMEOUT_SUMMARY);
  });

  it("explains a timeout under a RetryError (lastError)", async () => {
    const wrapped = aiSdkError("AI_RetryError", "Failed after 3 attempts. Last error: aborted", {
      reason: "maxRetriesExceeded",
      errors: [timeoutError()],
      lastError: timeoutError(),
    });
    expect(await summaryAfter(wrapped)).toBe(TIMEOUT_SUMMARY);
  });

  it("keeps the raw message for a wrapped error that is not an abort", async () => {
    const wrapped = aiSdkError("AI_APICallError", "Quota exceeded", { cause: new Error("429 Too Many Requests") });
    expect(await summaryAfter(wrapped)).toBe("Quota exceeded");
  });

  it("does not loop on an error whose cause points back at itself", async () => {
    const loop = new Error("loop") as Error & { cause?: unknown };
    loop.cause = loop;
    expect(await summaryAfter(loop)).toBe("loop");
  });
});

describe("autopilot cron: bounded batch", () => {
  it("asks the database for at most MAX_WORKFLOWS_PER_INVOCATION rows", async () => {
    await GET(cronRequest("GET", `Bearer ${SECRET}`));
    expect(mocks.limit).toHaveBeenCalledWith(MAX_WORKFLOWS_PER_INVOCATION);
  });

  it("never runs more than MAX_WORKFLOWS_PER_INVOCATION workflows even if more rows come back", async () => {
    const total = MAX_WORKFLOWS_PER_INVOCATION + 3;
    mocks.dueRows = Array.from({ length: total }, (_, i) => workflow(i + 1));

    const res = await GET(cronRequest("GET", `Bearer ${SECRET}`));
    const body = await res.json();

    expect(MAX_WORKFLOWS_PER_INVOCATION).toBeLessThan(total);
    expect(body.ran).toBe(MAX_WORKFLOWS_PER_INVOCATION);
    expect(mocks.generateText).toHaveBeenCalledTimes(MAX_WORKFLOWS_PER_INVOCATION);
    expect(mocks.createChat).toHaveBeenCalledTimes(MAX_WORKFLOWS_PER_INVOCATION);
    expect(mocks.createAutopilotRun).toHaveBeenCalledTimes(MAX_WORKFLOWS_PER_INVOCATION);
  });

  it("runs the oldest nextRunAt first and leaves the newest due workflows for the next tick", async () => {
    // Seven due workflows, handed out of order: wf-n is due n minutes into the day.
    mocks.dueRows = [4, 7, 1, 6, 3, 5, 2].map((n) => workflow(n));

    const res = await GET(cronRequest("GET", `Bearer ${SECRET}`));
    const body = await res.json();

    const expected = [1, 2, 3, 4, 5].map((n) => `wf-${n}`);
    expect(body.results.map((r: { id: string }) => r.id)).toEqual(expected);
    expect(mocks.generateText.mock.calls.map(([args]) => args.prompt)).toEqual(
      [1, 2, 3, 4, 5].map((n) => workflow(n).prompt),
    );
  });
});

// ─── Tool policy, observe mode, loop guards ──────────────────────────────────────────

const toolExecute = vi.fn();

function fakeAutopilotTool(): ToolSpec {
  const inputSchema = jsonSchema<{ q: string }>({ type: "object", properties: { q: { type: "string" } }, required: ["q"] });
  return {
    name: "fake_read",
    description: "Reads one thing from the owner's own data and returns it.",
    inputSchema,
    risk: "read",
    requires: { auth: true, paid: false, codeExecution: false },
    approval: "none",
    build: () => tool({ description: "Reads one thing.", inputSchema, execute: async (input) => toolExecute(input) }),
  };
}

type Callable = { execute: (input: unknown, options: unknown) => Promise<unknown> };

/**
 * Makes `fake_read` part of the live registry and of the Autopilot allowlist, the way a
 * later change to the code would, and removes it afterwards. Returns the spec so a test
 * can edit it "after the owner approved".
 */
function installFakeTool(): ToolSpec {
  const spec = fakeAutopilotTool();
  (TOOL_REGISTRY as ToolSpec[]).push(spec);
  (AUTOPILOT_TOOL_ALLOWLIST as string[]).push(spec.name);
  return spec;
}

function uninstallFakeTool() {
  const registry = TOOL_REGISTRY as ToolSpec[];
  const allowlist = AUTOPILOT_TOOL_ALLOWLIST as string[];
  const at = registry.findIndex((spec) => spec.name === "fake_read");
  if (at >= 0) registry.splice(at, 1);
  const listed = allowlist.indexOf("fake_read");
  if (listed >= 0) allowlist.splice(listed, 1);
}

afterEach(uninstallFakeTool);

const lastRun = () => mocks.createAutopilotRun.mock.calls.at(-1)?.[0];

describe("autopilot cron: tool policy hash", () => {
  it("refuses a run after the tool registry changed since the owner approved, with 0 model and 0 tool calls", async () => {
    const spec = installFakeTool();
    const approved = await currentAutopilotPolicyHash();
    mocks.dueRows = [workflow(1, { mode: "active", policyHash: approved })];

    // Same policy as approved: the workflow runs.
    let res = await GET(cronRequest("GET", `Bearer ${SECRET}`));
    expect(await res.json()).toMatchObject({ results: [{ id: "wf-1", status: "success" }] });
    expect(mocks.generateText).toHaveBeenCalledTimes(1);

    // The registry changes after approval.
    vi.clearAllMocks();
    mocks.generateText.mockResolvedValue({ text: MODEL_TEXT, totalUsage: {}, providerMetadata: undefined });
    mocks.createAutopilotRun.mockResolvedValue({ id: "run-2" });
    mocks.updateAutopilotWorkflowByUserId.mockResolvedValue({ id: "wf" });
    mocks.resolveUserEntitlements.mockResolvedValue({ canUsePaidModes: false });
    spec.description = "Reads one thing from the owner's own data, and now also writes a log of it.";

    res = await GET(cronRequest("GET", `Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ran: 1, results: [{ id: "wf-1", status: "refused" }] });

    expect(mocks.generateText).not.toHaveBeenCalled();
    expect(toolExecute).not.toHaveBeenCalled();
    expect(mocks.checkTokenBudget).not.toHaveBeenCalled();
    expect(mocks.createChat).not.toHaveBeenCalled();
    expect(mocks.recordModelUsage).not.toHaveBeenCalled();

    expect(lastRun()).toMatchObject({
      workflowId: "wf-1",
      userId: "owner-1",
      status: "refused",
      mode: "active",
      reasonCode: "policy_changed",
    });
    expect(lastRun().summary).toMatch(/^Refused: the tools Autopilot may use changed/);
    expect(lastRun().errorMessage).toBeUndefined();
    expect(mocks.updateAutopilotWorkflowByUserId).toHaveBeenLastCalledWith(
      "wf-1",
      "owner-1",
      expect.objectContaining({ lastRunStatus: "refused" }),
    );
  });

  it("refuses an approved workflow when a tool is added to the policy", async () => {
    const approved = await currentAutopilotPolicyHash();
    mocks.dueRows = [workflow(1, { mode: "active", policyHash: approved })];
    installFakeTool();

    await GET(cronRequest("GET", `Bearer ${SECRET}`));

    expect(mocks.generateText).not.toHaveBeenCalled();
    expect(lastRun()).toMatchObject({ status: "refused", reasonCode: "policy_changed" });
  });

  it("keeps running a workflow that predates the hash (no stored hash) while the policy is empty", async () => {
    mocks.dueRows = [workflow(1, { mode: "active", policyHash: null })];

    await GET(cronRequest("GET", `Bearer ${SECRET}`));

    expect(mocks.generateText).toHaveBeenCalledTimes(1);
    expect(lastRun()).toMatchObject({ status: "success", mode: "active" });
    expect(lastRun().reasonCode).toBeUndefined();
  });

  it("refuses a workflow that predates the hash once the policy gains a tool", async () => {
    installFakeTool();
    mocks.dueRows = [workflow(1, { mode: "active", policyHash: null })];

    await GET(cronRequest("GET", `Bearer ${SECRET}`));

    expect(mocks.generateText).not.toHaveBeenCalled();
    expect(lastRun()).toMatchObject({ status: "refused", reasonCode: "policy_changed" });
  });

  it("refuses only the workflow whose policy changed, and the others still run", async () => {
    installFakeTool();
    const current = await currentAutopilotPolicyHash();
    mocks.dueRows = [workflow(1, { mode: "active", policyHash: null }), workflow(2, { mode: "active", policyHash: current })];

    const res = await GET(cronRequest("GET", `Bearer ${SECRET}`));

    expect(await res.json()).toMatchObject({
      ran: 2,
      results: [
        { id: "wf-1", status: "refused" },
        { id: "wf-2", status: "success" },
      ],
    });
    expect(mocks.generateText).toHaveBeenCalledTimes(1);
  });
});

describe("autopilot cron: observe mode", () => {
  // Stands in for the SDK: it offers the model's tool call to the tool's own execute.
  function modelCallsFakeRead() {
    mocks.generateText.mockImplementation(async (args: { tools?: Record<string, Callable> }) => {
      await args.tools?.fake_read.execute({ q: "weekly revenue" }, { toolCallId: "c1", messages: [] });
      return { text: "Plan: look up the weekly revenue, then summarize it.", totalUsage: {}, providerMetadata: undefined };
    });
  }

  it("records the model's text and the tool call it would make, and executes nothing", async () => {
    installFakeTool();
    modelCallsFakeRead();
    mocks.dueRows = [workflow(1, { mode: "observe", policyHash: await currentAutopilotPolicyHash() })];

    const res = await GET(cronRequest("GET", `Bearer ${SECRET}`));
    expect(await res.json()).toMatchObject({ ran: 1, results: [{ id: "wf-1", status: "success" }] });

    expect(mocks.generateText).toHaveBeenCalledTimes(1);
    expect(toolExecute).not.toHaveBeenCalled();
    expect(lastRun()).toMatchObject({
      status: "success",
      mode: "observe",
      summary: "Plan: look up the weekly revenue, then summarize it.",
      toolCalls: [{ toolName: "fake_read", input: { q: "weekly revenue" } }],
    });
  });

  it("leaves no chat behind, but records the usage it cost", async () => {
    mocks.dueRows = [workflow(1, { mode: "observe", policyHash: null })];

    await GET(cronRequest("GET", `Bearer ${SECRET}`));

    expect(mocks.createChat).not.toHaveBeenCalled();
    expect(mocks.saveMessage).not.toHaveBeenCalled();
    expect(mocks.recordModelUsage).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner-1", chatId: undefined }));
    expect(lastRun()).toMatchObject({ status: "success", mode: "observe", summary: MODEL_TEXT });
  });

  it("is a dry run under the policy in force, so a changed policy does not refuse it", async () => {
    installFakeTool();
    mocks.dueRows = [workflow(1, { mode: "observe", policyHash: null })];

    await GET(cronRequest("GET", `Bearer ${SECRET}`));

    expect(mocks.generateText).toHaveBeenCalledTimes(1);
    expect(lastRun()).toMatchObject({ status: "success", mode: "observe" });
  });

  it("runs the tool for real once the workflow is active", async () => {
    installFakeTool();
    toolExecute.mockResolvedValue({ found: true });
    modelCallsFakeRead();
    mocks.dueRows = [workflow(1, { mode: "active", policyHash: await currentAutopilotPolicyHash() })];

    await GET(cronRequest("GET", `Bearer ${SECRET}`));

    expect(toolExecute).toHaveBeenCalledTimes(1);
    expect(toolExecute).toHaveBeenCalledWith({ q: "weekly revenue" });
    expect(lastRun()).toMatchObject({
      status: "success",
      mode: "active",
      toolCalls: [{ toolName: "fake_read", input: { q: "weekly revenue" } }],
    });
    expect(mocks.createChat).toHaveBeenCalledTimes(1);
  });
});

describe("autopilot cron: loop guards record their code on the run", () => {
  type Step = { text: string; toolCalls: { toolName: string; input: unknown }[]; content: { type: string }[] };
  const emptyStep: Step = { text: "", toolCalls: [], content: [] };
  const callStep = (input: unknown, failed = false): Step => ({
    text: "",
    toolCalls: [{ toolName: "fake_read", input }],
    content: [{ type: failed ? "tool-error" : "tool-result" }],
  });

  // Stands in for the SDK loop: after each step it calls onStepFinish, then the stop conditions.
  function modelTakes(steps: Step[]) {
    mocks.generateText.mockImplementation(
      async (args: {
        stopWhen: Array<(options: { steps: Step[] }) => boolean | PromiseLike<boolean>>;
        onStepFinish: (step: Step) => void;
      }) => {
        const taken: Step[] = [];
        for (const step of steps) {
          taken.push(step);
          args.onStepFinish(step);
          const stops = await Promise.all(args.stopWhen.map((condition) => condition({ steps: taken })));
          if (stops.some(Boolean)) break;
        }
        return { text: "", totalUsage: {}, providerMetadata: undefined };
      },
    );
  }

  const cases: Array<[string, string, Step[]]> = [
    ["3 empty steps", "empty_steps", [emptyStep, emptyStep, emptyStep, emptyStep]],
    ["the same tool and arguments 3 times", "repeated_steps", [callStep({ q: "a" }), callStep({ q: "a" }), callStep({ q: "a" }), callStep({ q: "a" })]],
    ["3 failures in a row", "tool_failures", [callStep({ q: "a" }, true), callStep({ q: "b" }, true), callStep({ q: "c" }, true), callStep({ q: "d" }, true)]],
  ];

  it.each(cases)("%s: the run stops, is failed, and records %s with a readable message", async (_label, code, steps) => {
    installFakeTool();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    modelTakes(steps);
    mocks.dueRows = [workflow(1, { mode: "active", policyHash: await currentAutopilotPolicyHash() })];

    const res = await GET(cronRequest("GET", `Bearer ${SECRET}`));
    expect(await res.json()).toMatchObject({ results: [{ id: "wf-1", status: "failed" }] });

    expect(lastRun()).toMatchObject({
      status: "failed",
      mode: "active",
      reasonCode: code,
      summary: buildLoopGuardMessage(code as "empty_steps"),
    });
    expect(lastRun().errorMessage).toBe(lastRun().summary);
    expect(lastRun().summary).not.toMatch(/Error|undefined/);
  });

  it("does not stop a run that makes progress", async () => {
    installFakeTool();
    mocks.generateText.mockImplementation(
      async (args: { stopWhen: Array<(options: { steps: Step[] }) => boolean | PromiseLike<boolean>> }) => {
        const taken = [callStep({ q: "a" }), callStep({ q: "b" }), callStep({ q: "c" })];
        for (let n = 1; n <= taken.length; n++) {
          const stops = await Promise.all(args.stopWhen.map((condition) => condition({ steps: taken.slice(0, n) })));
          expect(stops.some(Boolean)).toBe(false);
        }
        return { text: MODEL_TEXT, totalUsage: {}, providerMetadata: undefined };
      },
    );
    mocks.dueRows = [workflow(1, { mode: "active", policyHash: await currentAutopilotPolicyHash() })];

    await GET(cronRequest("GET", `Bearer ${SECRET}`));

    expect(lastRun()).toMatchObject({ status: "success", summary: MODEL_TEXT });
  });

  it("records empty_response when a model with no tools returns nothing", async () => {
    mocks.generateText.mockResolvedValue({ text: "   ", totalUsage: {}, providerMetadata: undefined });
    mocks.dueRows = [workflow(1)];

    await GET(cronRequest("GET", `Bearer ${SECRET}`));

    expect(lastRun()).toMatchObject({ status: "failed", reasonCode: "empty_response", summary: "The model returned an empty response." });
  });
});
