import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  createAutopilotWorkflow: vi.fn(),
  getAutopilotWorkflowById: vi.fn(),
  getAutopilotWorkflowsByUserId: vi.fn(),
  updateAutopilotWorkflowByUserId: vi.fn(),
  deleteAutopilotWorkflowByUserId: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/data/db-helpers", () => ({
  createAutopilotWorkflow: mocks.createAutopilotWorkflow,
  getAutopilotWorkflowById: mocks.getAutopilotWorkflowById,
  getAutopilotWorkflowsByUserId: mocks.getAutopilotWorkflowsByUserId,
  updateAutopilotWorkflowByUserId: mocks.updateAutopilotWorkflowByUserId,
  deleteAutopilotWorkflowByUserId: mocks.deleteAutopilotWorkflowByUserId,
}));
// The tool policy loads the registry; its tool modules are never called here.
vi.mock("@/lib/execution/service", () => ({ executeCode: vi.fn() }));
vi.mock("@/lib/rag/embed", () => ({ embedText: vi.fn() }));
vi.mock("@/lib/rag/search", () => ({ searchChunks: vi.fn() }));

import { GET, POST } from "@/app/api/autopilot/workflows/route";
import { DELETE, PATCH } from "@/app/api/autopilot/workflows/[workflowId]/route";
import { NO_TOOLS_POLICY_HASH, currentAutopilotPolicyHash } from "@/lib/autopilot/tool-policy";
import { AUTOPILOT_MIGRATION_FILE } from "@/lib/autopilot/schema-guard";
import { missingColumnError, postgresError } from "./helpers/db-errors";

const OWNER = "owner-1";

const json = (method: string, body: unknown) =>
  new Request("http://localhost/api/autopilot/workflows", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const patch = (body: unknown) => PATCH(json("PATCH", body), { params: Promise.resolve({ workflowId: "wf-1" }) });

const existing = (overrides: Record<string, unknown> = {}) => ({
  id: "wf-1",
  userId: OWNER,
  mode: "observe",
  status: "active",
  policyHash: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.getSession.mockResolvedValue({ user: { id: OWNER } });
  mocks.createAutopilotWorkflow.mockImplementation(async (input: Record<string, unknown>) => ({ id: "wf-new", ...input }));
  mocks.getAutopilotWorkflowById.mockResolvedValue(existing());
  mocks.updateAutopilotWorkflowByUserId.mockImplementation(async (_id: string, _owner: string, updates: object) => ({
    ...existing(),
    ...updates,
  }));
});

describe("POST /api/autopilot/workflows", () => {
  it("creates the workflow in observe mode, under the tool policy in force", async () => {
    const res = await POST(json("POST", { name: "Digest", prompt: "Summarize the news", cronExpression: "0 8 * * *" }));

    expect(res.status).toBe(201);
    expect(mocks.createAutopilotWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ userId: OWNER, mode: "observe", policyHash: NO_TOOLS_POLICY_HASH }),
    );
    expect((await res.json()).workflow).toMatchObject({ mode: "observe" });
  });

  it("does not let the request choose the mode", async () => {
    await POST(json("POST", { name: "Digest", prompt: "Summarize", cronExpression: "0 8 * * *", mode: "active" }));

    expect(mocks.createAutopilotWorkflow).toHaveBeenCalledWith(expect.objectContaining({ mode: "observe" }));
  });
});

describe("PATCH /api/autopilot/workflows/[id]: the owner's approval", () => {
  it("switching observe to active approves the policy in force", async () => {
    const res = await patch({ mode: "active" });

    expect(res.status).toBe(200);
    expect(mocks.updateAutopilotWorkflowByUserId).toHaveBeenCalledWith("wf-1", OWNER, {
      mode: "active",
      policyHash: await currentAutopilotPolicyHash(),
    });
  });

  it("setting active on a workflow that is already active changes nothing", async () => {
    mocks.getAutopilotWorkflowById.mockResolvedValue(existing({ mode: "active" }));

    await patch({ mode: "active" });

    expect(mocks.updateAutopilotWorkflowByUserId).toHaveBeenCalledWith("wf-1", OWNER, { mode: "active" });
  });

  it("switching back to observe keeps the stored hash", async () => {
    mocks.getAutopilotWorkflowById.mockResolvedValue(existing({ mode: "active", policyHash: "approved-earlier" }));

    await patch({ mode: "observe" });

    expect(mocks.updateAutopilotWorkflowByUserId).toHaveBeenCalledWith("wf-1", OWNER, { mode: "observe" });
  });

  it("pausing and resuming do not approve anything", async () => {
    mocks.getAutopilotWorkflowById.mockResolvedValue(existing({ mode: "active", policyHash: "approved-earlier" }));

    await patch({ status: "paused" });
    await patch({ status: "active" });

    expect(mocks.updateAutopilotWorkflowByUserId).toHaveBeenNthCalledWith(1, "wf-1", OWNER, { status: "paused" });
    expect(mocks.updateAutopilotWorkflowByUserId).toHaveBeenNthCalledWith(2, "wf-1", OWNER, { status: "active" });
  });

  it("approvePolicy re-approves a refused workflow without changing its mode", async () => {
    mocks.getAutopilotWorkflowById.mockResolvedValue(existing({ mode: "active", policyHash: "approved-earlier" }));

    const res = await patch({ approvePolicy: true });

    expect(res.status).toBe(200);
    expect(mocks.updateAutopilotWorkflowByUserId).toHaveBeenCalledWith("wf-1", OWNER, {
      policyHash: await currentAutopilotPolicyHash(),
    });
  });

  it("approving after a refused run also clears the refusal, and only then", async () => {
    mocks.getAutopilotWorkflowById.mockResolvedValue(existing({ mode: "active", lastRunStatus: "refused" }));

    await patch({ approvePolicy: true });

    expect(mocks.updateAutopilotWorkflowByUserId).toHaveBeenCalledWith("wf-1", OWNER, {
      policyHash: await currentAutopilotPolicyHash(),
      lastRunStatus: null,
    });

    mocks.updateAutopilotWorkflowByUserId.mockClear();
    mocks.getAutopilotWorkflowById.mockResolvedValue(existing({ mode: "active", lastRunStatus: "failed" }));

    await patch({ approvePolicy: true });

    expect(mocks.updateAutopilotWorkflowByUserId).toHaveBeenCalledWith("wf-1", OWNER, {
      policyHash: await currentAutopilotPolicyHash(),
    });
  });

  it("rejects a mode that does not exist, and an approvePolicy that is not true", async () => {
    expect((await patch({ mode: "turbo" })).status).toBe(400);
    expect((await patch({ approvePolicy: false })).status).toBe(400);
    expect((await patch({ approvePolicy: "yes" })).status).toBe(400);
    expect(mocks.updateAutopilotWorkflowByUserId).not.toHaveBeenCalled();
  });

  it("does not let another user approve a workflow", async () => {
    mocks.getAutopilotWorkflowById.mockResolvedValue(existing({ userId: "someone-else" }));

    expect((await patch({ mode: "active" })).status).toBe(404);
    expect(mocks.updateAutopilotWorkflowByUserId).not.toHaveBeenCalled();
  });
});

describe("a database behind the code (an Autopilot column is missing)", () => {
  const validPost = () => POST(json("POST", { name: "Digest", prompt: "Summarize the news", cronExpression: "0 8 * * *" }));
  const remove = () => DELETE(json("DELETE", undefined), { params: Promise.resolve({ workflowId: "wf-1" }) });

  // Each case: the call, and how to make its first database query fail with a given error.
  const calls: [string, () => Promise<Response>, (err: Error) => void][] = [
    ["GET /workflows", () => GET(), (err) => mocks.getAutopilotWorkflowsByUserId.mockRejectedValue(err)],
    ["POST /workflows", validPost, (err) => mocks.createAutopilotWorkflow.mockRejectedValue(err)],
    ["PATCH /workflows/[id]", () => patch({ status: "paused" }), (err) => mocks.getAutopilotWorkflowById.mockRejectedValue(err)],
    ["DELETE /workflows/[id]", remove, (err) => mocks.deleteAutopilotWorkflowByUserId.mockRejectedValue(err)],
  ];

  it.each(calls)("%s answers 503 naming the migration file, and logs it once", async (_name, call, failWith) => {
    failWith(missingColumnError());

    const res = await call();

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      code: "autopilot_schema_outdated",
      migration: AUTOPILOT_MIGRATION_FILE,
      error: expect.stringContaining(AUTOPILOT_MIGRATION_FILE),
    });
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(JSON.parse(vi.mocked(console.error).mock.calls[0][0] as string)).toMatchObject({
      event: "autopilot.schema.outdated",
      migration: AUTOPILOT_MIGRATION_FILE,
      errorCode: "42703",
    });
  });

  it.each(calls)("%s does not hide another database error", async (_name, call, failWith) => {
    failWith(postgresError("57P01", "connection terminated"));

    await expect(call()).rejects.toThrow("connection terminated");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("does not blame the Autopilot migration for a missing column of another table", async () => {
    mocks.getAutopilotWorkflowsByUserId.mockRejectedValue(missingColumnError("chat", "title"));

    await expect(GET()).rejects.toThrow();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("still answers 401 before touching the database", async () => {
    mocks.getSession.mockResolvedValue(null);
    mocks.getAutopilotWorkflowsByUserId.mockRejectedValue(missingColumnError());

    expect((await GET()).status).toBe(401);
    expect(mocks.getAutopilotWorkflowsByUserId).not.toHaveBeenCalled();
  });
});
