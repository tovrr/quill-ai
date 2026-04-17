import {
  createUIMessageStream,
  streamText,
  type ModelMessage,
  type UIMessage,
} from "ai";
import { saveMessage, createArtifactVersion } from "@/lib/data/db-helpers";
import { recordModelUsage } from "@/lib/observability/metrics";
import { recordBuilderMetric } from "@/lib/builder/metrics";
import {
  analyzeArtifactQuality,
  parseBuilderArtifact,
  type BuilderTarget,
} from "@/lib/builder/artifacts";
import { NON_RENDERABLE_ASSISTANT_FALLBACK_TEXT } from "@/lib/ai/assistant-message-utils";

type ChatMode = "fast" | "thinking" | "advanced";

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

  return createUIMessageStream({
    originalMessages,
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      writer.write({ type: "start-step" });

      writer.write({ type: "text-start", id: "draft" });
      const draftResult = streamText({
        model,
        system: systemPrompt,
        messages: modelMessages,
      });

      let draftText = "";
      for await (const chunk of draftResult.textStream) {
        draftText += chunk;
        writer.write({ type: "text-delta", id: "draft", delta: chunk });
      }
      writer.write({ type: "text-end", id: "draft" });

      writer.write({ type: "reasoning-start", id: "critic" });
      const criticResult = streamText({
        model,
        prompt: buildBuilderCriticPrompt(userInput, requestedBuilderTarget, draftText),
      });

      let criticText = "";
      for await (const chunk of criticResult.textStream) {
        criticText += chunk;
        writer.write({ type: "reasoning-delta", id: "critic", delta: chunk });
      }
      writer.write({ type: "reasoning-end", id: "critic" });

      writer.write({ type: "text-start", id: "final" });
      const rewriteResult = streamText({
        model,
        system: systemPrompt,
        prompt: buildBuilderRewritePrompt(userInput, criticText, draftText),
      });

      let finalText = "";
      for await (const chunk of rewriteResult.textStream) {
        finalText += chunk;
        writer.write({ type: "text-delta", id: "final", delta: chunk });
      }
      writer.write({ type: "text-end", id: "final" });

      let finalUsage = await rewriteResult.usage;
      let finalMetadata = await rewriteResult.providerMetadata;
      let artifact = parseBuilderArtifact(finalText);

      if (artifact) {
        const quality = analyzeArtifactQuality(artifact);
        if (quality.score < qualityRetryThreshold) {
          writer.write({ type: "reasoning-start", id: "retry-critic" });
          writer.write({
            type: "reasoning-delta",
            id: "retry-critic",
            delta: `Quality check failed (Score: ${quality.score}). Retrying for production quality...\n`,
          });
          writer.write({ type: "reasoning-end", id: "retry-critic" });

          writer.write({ type: "text-start", id: "retry" });
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
            writer.write({ type: "text-delta", id: "retry", delta: chunk });
          }
          writer.write({ type: "text-end", id: "retry" });

          const retriedArtifact = parseBuilderArtifact(retriedText);
          if (retriedArtifact) {
            const retriedQuality = analyzeArtifactQuality(retriedArtifact);
            if (retriedQuality.score >= quality.score) {
              finalText = retriedText;
              artifact = retriedArtifact;
              finalUsage = await retryResult.usage;
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

      if (!finalText.trim()) {
        finalText = NON_RENDERABLE_ASSISTANT_FALLBACK_TEXT;
      }

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
          console.warn('[two-pass-builder] artifact version save failed:', err instanceof Error ? err.message : err);
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
        usage: finalUsage,
        providerMetadata: {
          ...finalMetadata,
          builderTwoPass: true,
        },
      });

      writer.write({ type: "finish-step" });
      writer.write({ type: "finish" });
    },
  });
}