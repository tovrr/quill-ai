import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getAutopilotWorkflowById: vi.fn(),
  createAutopilotRun: vi.fn(),
  updateAutopilotWorkflowByUserId: vi.fn(),
  getRecentAutopilotRunsByUserId: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/data/db-helpers", () => ({
  getAutopilotWorkflowById: mocks.getAutopilotWorkflowById,
  createAutopilotRun: mocks.createAutopilotRun,
  updateAutopilotWorkflowByUserId: mocks.updateAutopilotWorkflowByUserId,
  getRecentAutopilotRunsByUserId: mocks.getRecentAutopilotRunsByUserId,
}));
// The tool policy loads the registry; its tool modules are never called here.
vi.mock("@/lib/execution/service", () => ({ executeCode: vi.fn() }));
vi.mock("@/lib/rag/embed", () => ({ embedText: vi.fn() }));
vi.mock("@/lib/rag/search", () => ({ searchChunks: vi.fn() }));

import { POST } from "@/app/api/autopilot/workflows/[workflowId]/run/route";
import { GET as listRuns } from "@/app/api/autopilot/runs/route";
import { NO_TOOLS_POLICY_HASH } from "@/lib/autopilot/tool-policy";
import { AUTOPILOT_MIGRATION_FILE } from "@/lib/autopilot/schema-guard";
import { missingColumnError, postgresError } from "./helpers/db-errors";

const OWNER = "owner-1";
const STALE_HASH = "approved-under-an-older-policy";

const runNow = () =>
  POST(new Request("http://localhost/api/autopilot/workflows/wf-1/run", { method: "POST" }), {
    params: Promise.resolve({ workflowId: "wf-1" }),
  });

const workflow = (overrides: Record<string, unknown> = {}) => ({
  id: "wf-1",
  userId: OWNER,
  status: "active",
  mode: "active",
  policyHash: NO_TOOLS_POLICY_HASH,
  lastRunStatus: null,
  ...overrides,
});

const recordedRun = () => mocks.createAutopilotRun.mock.calls[0][0];
const workflowUpdate = () => mocks.updateAutopilotWorkflowByUserId.mock.calls[0][2];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.getSession.mockResolvedValue({ user: { id: OWNER } });
  mocks.getAutopilotWorkflowById.mockResolvedValue(workflow());
  mocks.createAutopilotRun.mockImplementation(async (input: Record<string, unknown>) => ({ id: "run-1", ...input }));
  mocks.updateAutopilotWorkflowByUserId.mockResolvedValue({ id: "wf-1" });
});

describe("POST /api/autopilot/workflows/[id]/run: the policy check of the cron", () => {
  it("refuses an active workflow approved under another policy, and never records a success", async () => {
    mocks.getAutopilotWorkflowById.mockResolvedValue(workflow({ policyHash: STALE_HASH }));

    const res = await runNow();

    expect(res.status).toBe(201);
    expect((await res.json()).run).toMatchObject({ status: "refused", reasonCode: "policy_changed" });
    expect(recordedRun()).toMatchObject({
      workflowId: "wf-1",
      userId: OWNER,
      status: "refused",
      mode: "active",
      reasonCode: "policy_changed",
      summary: expect.stringMatching(/^Refused: the tools Autopilot may use changed/),
    });
    expect(workflowUpdate()).toMatchObject({ lastRunStatus: "refused", lastRunAt: expect.any(Date) });
    for (const [, , updates] of mocks.updateAutopilotWorkflowByUserId.mock.calls) {
      expect(updates.lastRunStatus).not.toBe("success");
    }
    for (const [input] of mocks.createAutopilotRun.mock.calls) {
      expect(input.status).not.toBe("success");
    }
  });

  it("leaves a workflow whose last run was refused refused, so the page keeps offering the approval", async () => {
    mocks.getAutopilotWorkflowById.mockResolvedValue(workflow({ policyHash: STALE_HASH, lastRunStatus: "refused" }));

    await runNow();

    expect(recordedRun().status).toBe("refused");
    expect(workflowUpdate().lastRunStatus).toBe("refused");
  });

  it("records the placeholder success when the policy is the one the owner approved", async () => {
    const res = await runNow();

    expect(res.status).toBe(201);
    expect(recordedRun()).toMatchObject({ status: "success", mode: "active" });
    expect(recordedRun().reasonCode).toBeUndefined();
    expect(workflowUpdate()).toMatchObject({ lastRunStatus: "success", lastRunAt: expect.any(Date) });
  });

  it("does not refuse a workflow that predates the hash while the policy is empty", async () => {
    mocks.getAutopilotWorkflowById.mockResolvedValue(workflow({ policyHash: null }));

    await runNow();

    expect(recordedRun().status).toBe("success");
  });

  it("does not refuse a dry run: observe mode runs under the policy in force", async () => {
    mocks.getAutopilotWorkflowById.mockResolvedValue(workflow({ mode: "observe", policyHash: STALE_HASH }));

    await runNow();

    expect(recordedRun()).toMatchObject({ status: "success", mode: "observe" });
  });

  it("does not run a paused workflow, another owner's workflow, or an anonymous request", async () => {
    mocks.getAutopilotWorkflowById.mockResolvedValue(workflow({ status: "paused", policyHash: STALE_HASH }));
    expect((await runNow()).status).toBe(400);

    mocks.getAutopilotWorkflowById.mockResolvedValue(workflow({ userId: "someone-else" }));
    expect((await runNow()).status).toBe(404);

    mocks.getSession.mockResolvedValue(null);
    expect((await runNow()).status).toBe(401);

    expect(mocks.createAutopilotRun).not.toHaveBeenCalled();
    expect(mocks.updateAutopilotWorkflowByUserId).not.toHaveBeenCalled();
  });
});

describe("a database behind the code (an Autopilot column is missing)", () => {
  it("Run now answers 503 naming the migration file when the workflow cannot be read", async () => {
    mocks.getAutopilotWorkflowById.mockRejectedValue(missingColumnError("autopilot_workflow", "policyHash"));

    const res = await runNow();

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: "autopilot_schema_outdated", migration: AUTOPILOT_MIGRATION_FILE });
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("Run now answers 503 when the run cannot be recorded", async () => {
    mocks.createAutopilotRun.mockRejectedValue(missingColumnError("autopilot_run", "reasonCode"));

    const res = await runNow();

    expect(res.status).toBe(503);
    expect(mocks.updateAutopilotWorkflowByUserId).not.toHaveBeenCalled();
  });

  it("the runs list answers 503 too, and the line it logs holds no SQL", async () => {
    mocks.getRecentAutopilotRunsByUserId.mockRejectedValue(missingColumnError("autopilot_run", "toolCalls"));

    const res = await listRuns(new Request("http://localhost/api/autopilot/runs"));

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: "autopilot_schema_outdated" });
    const line = vi.mocked(console.error).mock.calls[0][0] as string;
    expect(JSON.parse(line)).toMatchObject({ event: "autopilot.schema.outdated", errorCode: "42703" });
    expect(line).not.toContain("select");
  });

  it("does not hide another database error", async () => {
    mocks.getAutopilotWorkflowById.mockRejectedValue(postgresError("57P01", "connection terminated"));
    await expect(runNow()).rejects.toThrow("connection terminated");

    mocks.getRecentAutopilotRunsByUserId.mockRejectedValue(postgresError("57P01", "connection terminated"));
    await expect(listRuns(new Request("http://localhost/api/autopilot/runs"))).rejects.toThrow("connection terminated");

    expect(console.error).not.toHaveBeenCalled();
  });
});
