import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const SECRET = "test-cron-secret";

type DueRow = {
  id: string;
  userId: string;
  name: string;
  prompt: string;
  cronExpression: string;
  timezone: string;
};

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

vi.mock("@/db", () => {
  const chain = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: (n: number) => {
      mocks.limit(n);
      return Promise.resolve(mocks.dueRows);
    },
  };
  return { db: chain };
});

vi.mock("ai", () => ({ generateText: mocks.generateText }));
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

import { GET, POST } from "@/app/api/autopilot/cron/route";
import { MAX_WORKFLOWS_PER_INVOCATION } from "@/lib/autopilot/run-workflow";

function workflow(n: number, overrides: Partial<DueRow> = {}): DueRow {
  return {
    id: `wf-${n}`,
    userId: `owner-${n}`,
    name: `Workflow ${n}`,
    prompt: `Summarize the news for workflow ${n}`,
    cronExpression: "0 9 * * *",
    timezone: "UTC",
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

    // The workflow is rescheduled in the future.
    expect(mocks.updateAutopilotWorkflowByUserId).toHaveBeenCalledWith(
      "wf-1",
      "owner-1",
      expect.objectContaining({ lastRunStatus: "success", nextRunAt: expect.any(Date) }),
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
    expect(mocks.updateAutopilotWorkflowByUserId).toHaveBeenCalledWith(
      "wf-1",
      "owner-1",
      expect.objectContaining({ lastRunStatus: "failed", nextRunAt: expect.any(Date) }),
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

  it("keeps going when one workflow's bookkeeping throws", async () => {
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
});
