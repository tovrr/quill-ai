import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  streamText: vi.fn(),
  saveMessage: vi.fn(),
  createArtifactVersion: vi.fn(),
  recordModelUsage: vi.fn(),
  recordBuilderMetric: vi.fn(),
  validateGeneratedModule: vi.fn(),
}));

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  streamText: mocks.streamText,
}));
vi.mock("@/lib/data/db-helpers", () => ({
  saveMessage: mocks.saveMessage,
  createArtifactVersion: mocks.createArtifactVersion,
}));
vi.mock("@/lib/observability/metrics", () => ({ recordModelUsage: mocks.recordModelUsage }));
vi.mock("@/lib/builder/metrics", () => ({ recordBuilderMetric: mocks.recordBuilderMetric }));
vi.mock("@/lib/tools/validator", () => ({ validateGeneratedModule: mocks.validateGeneratedModule }));

import { buildTwoPassBuilderStream } from "@/lib/chat/two-pass-builder";

const DRAFT = "Here is a short landing page outline for your bakery.";

// One streamText result per call, in the order the builder makes them.
function modelSays(...texts: string[]) {
  for (const text of texts) {
    mocks.streamText.mockImplementationOnce(() => ({
      textStream: (async function* () {
        yield text;
      })(),
      usage: Promise.resolve({ inputTokens: 10, outputTokens: 5, totalTokens: 15 }),
      providerMetadata: Promise.resolve(undefined),
    }));
  }
}

async function run() {
  const stream = buildTwoPassBuilderStream({
    userInput: "A landing page for my bakery",
    requestedBuilderTarget: "page",
    model: {} as never,
    modelId: "fake-model-id",
    provider: "google",
    modelMessages: [],
    systemPrompt: "system",
    qualityRetryThreshold: 70,
    shouldPersist: true,
    userId: "user-1",
    chatId: "chat-1",
    selectedMode: "advanced",
  });
  const chunks: Array<{ type: string }> = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return chunks;
    chunks.push(value as { type: string });
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mocks.saveMessage.mockResolvedValue({ id: "m1" });
  mocks.recordModelUsage.mockResolvedValue(undefined);
});

describe("two-pass builder: a rewrite that adds nothing stops the passes after it", () => {
  it("stops when the rewrite is identical to the draft: no repair call, the draft is kept, the run still finishes", async () => {
    modelSays(DRAFT, "- add a hero image", `  ${DRAFT}\n`);

    const chunks = await run();

    expect(mocks.streamText).toHaveBeenCalledTimes(3); // draft, critic, rewrite; no repair
    expect(mocks.saveMessage).toHaveBeenCalledWith(expect.objectContaining({ chatId: "chat-1", content: DRAFT }));
    expect(mocks.recordModelUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        providerMetadata: expect.objectContaining({ builderTwoPass: true, builderLoopGuard: "identical_rewrite" }),
      }),
    );
    expect(chunks.at(-1)?.type).toBe("finish");
  });

  it("stops when the rewrite is empty and falls back to the draft", async () => {
    modelSays(DRAFT, "- add a hero image", "   ");

    const chunks = await run();

    expect(mocks.streamText).toHaveBeenCalledTimes(3);
    expect(mocks.saveMessage).toHaveBeenCalledWith(expect.objectContaining({ content: DRAFT }));
    expect(mocks.recordModelUsage).toHaveBeenCalledWith(
      expect.objectContaining({ providerMetadata: expect.objectContaining({ builderLoopGuard: "empty_rewrite" }) }),
    );
    expect(chunks.at(-1)?.type).toBe("finish");
  });

  it("does not stop on a real rewrite: the repair pass still runs when the rewrite is not an artifact", async () => {
    modelSays(DRAFT, "- add a hero image", "A different, improved outline.", "Still no artifact.");

    await run();

    expect(mocks.streamText).toHaveBeenCalledTimes(4); // draft, critic, rewrite, repair
    const metadata = mocks.recordModelUsage.mock.calls[0][0].providerMetadata;
    expect(metadata).not.toHaveProperty("builderLoopGuard");
  });
});
