import { createUIMessageStream, streamText, type ModelMessage, type UIMessage } from "ai";
import { sanitizeForPrompt } from "@/lib/prompt-sanitizer";
import { saveMessage, createArtifactVersion } from "@/lib/data/db-helpers";
import { recordModelUsage } from "@/lib/observability/metrics";
import { recordBuilderMetric } from "@/lib/builder/metrics";
import { analyzeArtifactQuality, parseBuilderArtifact, type BuilderTarget } from "@/lib/builder/artifacts";
import { NON_RENDERABLE_ASSISTANT_FALLBACK_TEXT, sanitizeAssistantOutputText } from "@/lib/ai/assistant-message-utils";
import { validateGeneratedModule } from "@/lib/tools/validator";

type ChatMode = "fast" | "thinking" | "advanced";

type LanguageUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  [key: string]: unknown;
};

type TwoPassBuilderParams = {
  originalMessages?: UIMessage[];
  userInput: string | null;
  requestedBuilderTarget: BuilderTarget;
  model: Parameters<typeof streamText>[0]["model"];
  modelId: string;
  provider: "google" | "openrouter" | "apex";
  modelMessages: ModelMessage[];
  systemPrompt: string;
  qualityRetryThreshold: number;
  shouldPersist: boolean;
  userId?: string;
  chatId?: string;
  selectedMode: ChatMode;
};

function safeRecordBuilderMetric(input: {
  parseSuccess: boolean;
  artifactType?: "page" | "document" | "react-app" | "nextjs-bundle";
  requestedTarget?: BuilderTarget;
}): void {
  try {
    recordBuilderMetric(input);
  } catch (error) {
    console.warn("[chat] builder metric recording failed:", error instanceof Error ? error.message : error);
  }
}

function buildBuilderCriticPrompt(input: string | null, requestedTarget: BuilderTarget, draft: string): string {
  return [
    "You are a strict UI/code quality reviewer for Quill builder artifacts.",
    `Requested target: ${requestedTarget}`,
    "Review the draft artifact and return concise, actionable issues only.",
    "Focus on: artifact validity, missing required sections, mobile responsiveness, accessibility basics, visual hierarchy, CTA clarity, and implementation completeness.",
    "Return max 10 bullets, ordered by impact.",
    "",
    "User request:",
    input ?? "(not provided)",
    "",
    "Draft artifact:",
    draft,
  ].join("\n");
}

function buildBuilderRewritePrompt(input: string | null, critic: string, draft: string): string {
  return [
    "Improve the draft using the critic feedback.",
    "Return only one final artifact block in valid JSON wrapped in <quill-artifact>...</quill-artifact>.",
    "Do not include analysis text before the artifact.",
    "Ensure the artifact is internally consistent and renderable.",
    "",
    "User request:",
    input ?? "(not provided)",
    "",
    "Critic feedback:",
    critic,
    "",
    "Draft artifact:",
    draft,
  ].join("\n");
}

function buildArtifactRepairPrompt(
  input: string | null,
  requestedTarget: BuilderTarget,
  candidateOutput: string,
): string {
  return [
    "You must output exactly one valid Quill artifact envelope and nothing else.",
    "Required format: <quill-artifact>{...}</quill-artifact> with valid JSON.",
    `Requested target: ${requestedTarget}`,
    "Allowed artifact.type values only: page, document, react-app, nextjs-bundle.",
    "Do not include analysis, preface text, markdown fences, or commentary.",
    "If the candidate already contains useful content, convert it into the best valid artifact envelope.",
    "",
    "User request:",
    input ?? "(not provided)",
    "",
    "Candidate output to repair:",
    candidateOutput,
  ].join("\n");
}

function mergeUsage(current: LanguageUsage | undefined, next: LanguageUsage | undefined): LanguageUsage | undefined {
  if (!current) return next;
  if (!next) return current;

  const merged: LanguageUsage = { ...current };
  for (const [key, value] of Object.entries(next)) {
    const currentValue = merged[key];
    if (typeof value === "number" && typeof currentValue === "number") {
      merged[key] = currentValue + value;
      continue;
    }

    if (typeof value === "number" && currentValue === undefined) {
      merged[key] = value;
      continue;
    }

    if (merged[key] === undefined) {
      merged[key] = value;
    }
  }

  return merged;
}

function toArtifactEnvelopeText(artifact: {
  type: "page" | "document" | "react-app" | "nextjs-bundle";
  title?: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}): string {
  const envelope = {
    artifactVersion: 1,
    artifact: {
      type: artifact.type,
      ...(artifact.title ? { title: artifact.title } : {}),
      ...(artifact.metadata ? { metadata: artifact.metadata } : {}),
      payload: artifact.payload,
    },
  };

  return `<quill-artifact>\n${JSON.stringify(envelope, null, 2)}\n</quill-artifact>`;
}

export function buildTwoPassBuilderStream(params: TwoPassBuilderParams) {
  const {
    originalMessages,
    userInput,
    requestedBuilderTarget,
    model,
    modelId,
    provider,
    modelMessages,
    systemPrompt,
    qualityRetryThreshold,
    shouldPersist,
    userId,
    chatId,
    selectedMode,
  } = params;

  const safeUserInput = userInput ? sanitizeForPrompt(userInput) : null;
  const safeModelMessages: ModelMessage[] = (modelMessages || []).map((m) => {
    const content = typeof m.content === "string" ? sanitizeForPrompt(m.content) : m.content;
    return { ...m, content } as ModelMessage;
  });

  return createUIMessageStream({
    originalMessages,
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      writer.write({ type: "start-step" });

      const draftResult = streamText({
        model,
        system: systemPrompt,
        messages: safeModelMessages,
      });

      let draftText = "";
      for await (const chunk of draftResult.textStream) {
        draftText += chunk;
      }
      let aggregatedUsage = mergeUsage(undefined, await draftResult.usage);

      const criticResult = streamText({
        model,
        prompt: buildBuilderCriticPrompt(safeUserInput, requestedBuilderTarget, draftText),
      });

      let criticText = "";
      for await (const chunk of criticResult.textStream) {
        criticText += chunk;
      }
      aggregatedUsage = mergeUsage(aggregatedUsage, await criticResult.usage);

      const rewriteResult = streamText({
        model,
        system: systemPrompt,
        prompt: buildBuilderRewritePrompt(safeUserInput, criticText, draftText),
      });

      let finalText = "";
      for await (const chunk of rewriteResult.textStream) {
        finalText += chunk;
      }
      aggregatedUsage = mergeUsage(aggregatedUsage, await rewriteResult.usage);

      let finalMetadata = await rewriteResult.providerMetadata;
      let artifact = parseBuilderArtifact(finalText);

      if (!artifact) {
        const repairResult = streamText({
          model,
          system: systemPrompt,
          prompt: buildArtifactRepairPrompt(safeUserInput, requestedBuilderTarget, finalText),
        });

        let repairedText = "";
        for await (const chunk of repairResult.textStream) {
          repairedText += chunk;
        }

        aggregatedUsage = mergeUsage(aggregatedUsage, await repairResult.usage);

        const repairedArtifact = parseBuilderArtifact(repairedText);
        if (repairedArtifact) {
          finalText = repairedText;
          artifact = repairedArtifact;
          finalMetadata = await repairResult.providerMetadata;
        }
      }

      if (artifact) {
        const quality = analyzeArtifactQuality(artifact);
        if (quality.score < qualityRetryThreshold) {
          const qualityRetryPrompt = [
            "Improve this artifact to meet production quality.",
            `Current score: ${quality.score}/100. Target: >= ${qualityRetryThreshold}.`,
            quality.issues.length > 0 ? `Critical issues: ${quality.issues.join("; ")}` : "",
            quality.recommendations.length > 0 ? `Recommendations: ${quality.recommendations.join("; ")}` : "",
            "Return only one corrected artifact block in valid JSON wrapped in <quill-artifact>...</quill-artifact>.",
            "Do not include commentary.",
            "",
            "Current artifact:",
            finalText,
          ]
            .filter(Boolean)
            .join("\n");

          const retryResult = streamText({
            model,
            system: systemPrompt,
            prompt: qualityRetryPrompt,
          });

          let retriedText = "";
          for await (const chunk of retryResult.textStream) {
            retriedText += chunk;
          }
          aggregatedUsage = mergeUsage(aggregatedUsage, await retryResult.usage);

          const retriedArtifact = parseBuilderArtifact(retriedText);
          if (retriedArtifact) {
            const retriedQuality = analyzeArtifactQuality(retriedArtifact);
            if (retriedQuality.score >= qualityRetryThreshold) {
              finalText = retriedText;
              artifact = retriedArtifact;
              finalMetadata = await retryResult.providerMetadata;
            }
          }
        }
      }

      safeRecordBuilderMetric({
        parseSuccess: Boolean(artifact),
        artifactType: artifact?.type,
        requestedTarget: requestedBuilderTarget,
      });

      if (artifact) {
        finalText = toArtifactEnvelopeText(artifact);
      }

      let artifactValidationResult: { success: boolean; exitCode: number; details?: string } | undefined;
      if (artifact && (artifact.type === "react-app" || artifact.type === "nextjs-bundle")) {
        try {
          // Validate in-memory file map (artifact.payload.files) before persisting
          const files = (artifact.payload as any).files as Record<string, string>;
          if (files && Object.keys(files).length > 0) {
            artifactValidationResult = await validateGeneratedModule(files as any);
          }
        } catch (err) {
          console.warn("[two-pass-builder] artifact validation failed:", err instanceof Error ? err.message : err);
        }
      }

      if (!artifact) {
        const artifactStart = finalText.indexOf("<quill-artifact>");
        if (artifactStart >= 0) {
          finalText = finalText.slice(artifactStart).trim();
        } else {
          finalText = sanitizeAssistantOutputText(finalText) || NON_RENDERABLE_ASSISTANT_FALLBACK_TEXT;
        }
      }

      if (!finalText.trim()) {
        finalText = NON_RENDERABLE_ASSISTANT_FALLBACK_TEXT;
      }

      writer.write({ type: "text-start", id: "final" });
      writer.write({ type: "text-delta", id: "final", delta: finalText });
      writer.write({ type: "text-end", id: "final" });

      if (finalText.trim() && shouldPersist && chatId) {
        await saveMessage({
          chatId,
          role: "assistant",
          content: finalText,
          parts: [{ type: "text", text: finalText }],
        });
      }

      if (artifact && shouldPersist && userId) {
        try {
          await createArtifactVersion({
            userId,
            chatId: chatId ?? undefined,
            title: artifact.title ?? requestedBuilderTarget,
            artifactType: artifact.type,
            payload: artifact.payload,
          });
        } catch (err) {
          console.warn("[two-pass-builder] artifact version save failed:", err instanceof Error ? err.message : err);
        }
      }
      await recordModelUsage({
        userId: shouldPersist ? userId : undefined,
        chatId: shouldPersist ? chatId : undefined,
        route: "/api/chat",
        feature: "chat",
        mode: selectedMode,
        provider,
        model: modelId,
        usage: aggregatedUsage,
        providerMetadata: {
          ...finalMetadata,
          builderTwoPass: true,
          artifactValidation: artifactValidationResult,
        },
      });

      writer.write({ type: "finish-step" });
      writer.write({ type: "finish" });
    },
  });
}
