import type { UIMessage } from "ai";

export const NON_RENDERABLE_ASSISTANT_FALLBACK_TEXT = "I could not render that response. Please retry.";
const INVISIBLE_TEXT_CHARS_REGEX = /[\u200B-\u200D\uFEFF]/g;
const MARKDOWN_DECORATOR_LINE_REGEX = /^([-*_=]{3,}|`{3,})$/;
const TOOL_TERMINAL_STATES = new Set(["result", "output-available", "output-error"]);

type MessageRole = UIMessage["role"] | "tool";

type MessageLike = {
  id?: string;
  role?: MessageRole;
  parts?: unknown;
  content?: unknown;
  metadata?: unknown;
};

type AssistantTextSplit = {
  reasoningText: string;
  finalText: string;
};

const REASONING_SIGNAL_PATTERNS = [
  /^okay(?:[,.!\s]|$)/i,
  /^ok(?:[,.!\s]|$)/i,
  /^no need (?:for|to)\b/i,
  /^so the assistant should\b/i,
  /^the assistant should\b/i,
  /^the user /i,
  /^let me /i,
  /^i need to /i,
  /^i should\b/i,
  /^first[,.!\s]/i,
  /^looking back/i,
  /^wait[,.!\s]/i,
  /^so i need to /i,
  /^the previous /i,
  /\buser asks\b/i,
  /\bextra information\b/i,
  /\bprevious response\b/i,
];

const REASONING_SENTENCE_PATTERNS = [
  ...REASONING_SIGNAL_PATTERNS,
  /^alright[,.!\s]*/i,
  /^check\b/i,
  /^avoid\b/i,
  /^yes[,.!\s]/i,
  /^that'?s\b/i,
  /^just the sentence\b/i,
  /\b(grammar|markdown|respond appropriately|simple sentence|final answer|check for)\b/i,
];

const DIRECT_ANSWER_STARTS = [
  "certainly",
  "of course",
  "absolutely",
  "sure",
  "hello",
  "hi",
  "bonjour",
  "salut",
  "hey",
  "je suis",
  "l'objectif",
  "objectif atteint",
  "quill,",
  "voici",
];

const STREAMING_REASONING_GUARD_REGEX = /\b(let me|i need to|the user|assistant should|check for|final answer|respond appropriately|previous response|extra information|user asks)\b/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function splitIntoSentences(value: string): string[] {
  return value.match(/[^.!?]+(?:[.!?]+|$)/g)?.map((item) => item.trim()).filter(Boolean) ?? [];
}

function normalizeSentenceForDetection(sentence: string): string {
  return normalizeVisibleText(sentence).replace(/^[\s"'`)*_\]]+/, "");
}

function looksLikeReasoningSignal(value: string): boolean {
  return REASONING_SIGNAL_PATTERNS.some((pattern) => pattern.test(value));
}

function looksLikeReasoningSentence(value: string): boolean {
  return REASONING_SENTENCE_PATTERNS.some((pattern) => pattern.test(value));
}

function looksLikeDirectAnswerStart(value: string): boolean {
  return DIRECT_ANSWER_STARTS.some((start) => value.startsWith(start));
}

function looksLikeLikelyFinalSentence(value: string): boolean {
  const normalized = normalizeSentenceForDetection(value).toLowerCase();
  if (!hasRenderableTextValue(normalized)) return false;
  if (normalized.length < 12) return false;
  if (looksLikeReasoningSentence(normalized)) return false;
  if (STREAMING_REASONING_GUARD_REGEX.test(normalized)) return false;
  return /[a-zA-Z\u00C0-\u017F]/.test(normalized);
}

function trimTrailingReasoningFragments(value: string): string {
  const normalized = normalizeVisibleText(value);
  if (!normalized) return "";

  const sentences = splitIntoSentences(normalized);
  if (sentences.length <= 1) return normalized;

  while (sentences.length > 1) {
    const tail = normalizeSentenceForDetection(sentences[sentences.length - 1] ?? "").toLowerCase();
    if (
      !hasRenderableTextValue(tail) ||
      tail.length < 6 ||
      looksLikeReasoningSentence(tail) ||
      STREAMING_REASONING_GUARD_REGEX.test(tail) ||
      /^i need(?:\s|$)/i.test(tail) ||
      /^so i need(?:\s|$)/i.test(tail) ||
      /^so i(?:\s|$)/i.test(tail) ||
      /^i$/i.test(tail) ||
      /^let me(?:\s|$)/i.test(tail) ||
      /^i should(?:\s|$)/i.test(tail)
    ) {
      sentences.pop();
      continue;
    }

    break;
  }

  return sentences.join(" ").trim();
}

function recoverCleanAnswerSentences(value: string): string | null {
  const normalized = normalizeVisibleText(value);
  if (!normalized) return null;

  const sentences = splitIntoSentences(normalized);
  if (sentences.length < 2) return null;

  const clean = sentences.filter((sentence) => {
    const probe = normalizeSentenceForDetection(sentence).toLowerCase();
    if (!hasRenderableTextValue(probe)) return false;
    if (looksLikeReasoningSentence(probe)) return false;
    if (STREAMING_REASONING_GUARD_REGEX.test(probe)) return false;
    return true;
  });

  if (clean.length === 0) return null;
  return clean.slice(0, 2).join(" ").trim();
}

function extractTrailingFinalLine(value: string): string | null {
  const lines = value
    .split("\n")
    .map((line) => normalizeVisibleText(line))
    .filter(Boolean);

  if (lines.length < 2) return null;

  const lastLine = lines.at(-1) ?? "";
  const leadingLines = lines.slice(0, -1).join(" ").trim();
  if (!hasRenderableTextValue(lastLine) || !hasRenderableTextValue(leadingLines)) {
    return null;
  }

  if (!looksLikeReasoningSentence(normalizeSentenceForDetection(leadingLines))) {
    return null;
  }

  const cleanedLastLine = normalizeVisibleText(lastLine.replace(/^\*\*([\s\S]*?)\*\*(.*)$/u, "$1$2"));
  if (!hasRenderableTextValue(cleanedLastLine)) {
    return null;
  }

  const normalizedCandidate = normalizeSentenceForDetection(cleanedLastLine).toLowerCase();
  if (looksLikeReasoningSentence(normalizedCandidate)) {
    return null;
  }

  if (!looksLikeDirectAnswerStart(normalizedCandidate)) {
    return null;
  }

  return cleanedLastLine;
}

function maybeSplitAssistantReasoningLeak(value: string): AssistantTextSplit | null {
  const normalized = normalizeVisibleText(value);
  if (!normalized) return null;

  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length < 2) return null;

  const firstParagraph = paragraphs[0] ?? "";
  if (!looksLikeReasoningSignal(firstParagraph)) {
    return null;
  }

  const lastParagraph = paragraphs.at(-1) ?? "";
  const boldOnlyMatch = lastParagraph.match(/^\*\*([\s\S]*)\*\*$/);
  const finalText = normalizeVisibleText(boldOnlyMatch ? boldOnlyMatch[1] : lastParagraph);
  if (!hasRenderableTextValue(finalText)) return null;

  const finalLooksLikeReasoning = looksLikeReasoningSignal(finalText);
  if (finalLooksLikeReasoning) return null;

  const reasoningText = normalizeVisibleText(paragraphs.slice(0, -1).join("\n\n"));
  if (!hasRenderableTextValue(reasoningText)) return null;

  return {
    reasoningText,
    finalText,
  };
}

function maybeSplitSingleParagraphReasoningLeak(value: string): AssistantTextSplit | null {
  const normalized = normalizeVisibleText(value);
  if (!normalized) return null;

  const sentenceMatches = splitIntoSentences(normalized);
  if (sentenceMatches.length < 2) return null;

  const normalizedSentences = sentenceMatches.map(normalizeSentenceForDetection);

  if (looksLikeReasoningSignal(normalized)) {
    for (let index = 1; index < normalizedSentences.length; index += 1) {
      const candidate = sentenceMatches.slice(index).join(" ").trim();
      const reasoning = sentenceMatches.slice(0, index).join(" ").trim();
      if (!hasRenderableTextValue(candidate) || !hasRenderableTextValue(reasoning)) continue;

      const normalizedCandidate = normalizeSentenceForDetection(candidate).toLowerCase();
      if (!looksLikeDirectAnswerStart(normalizedCandidate)) continue;
      if (looksLikeReasoningSignal(normalizedCandidate)) continue;

      return {
        reasoningText: reasoning,
        finalText: candidate,
      };
    }

    // Fallback: if the answer doesn't start with a known greeting/prefix,
    // still split at the first likely non-reasoning sentence.
    for (let index = 1; index < normalizedSentences.length; index += 1) {
      const currentSentence = sentenceMatches[index] ?? "";
      if (!looksLikeLikelyFinalSentence(currentSentence)) continue;

      const candidate = sentenceMatches.slice(index).join(" ").trim();
      const reasoning = sentenceMatches.slice(0, index).join(" ").trim();
      if (!hasRenderableTextValue(candidate) || !hasRenderableTextValue(reasoning)) continue;

      return {
        reasoningText: reasoning,
        finalText: candidate,
      };
    }
  }

  const reasoningIndexes = normalizedSentences.reduce<number[]>((accumulator, sentence, index) => {
    if (looksLikeReasoningSentence(sentence)) {
      accumulator.push(index);
    }
    return accumulator;
  }, []);

  if (reasoningIndexes.length === 0) {
    return null;
  }

  const lastReasoningIndex = reasoningIndexes[reasoningIndexes.length - 1] ?? -1;
  const answerStartIndex = normalizedSentences.findIndex(
    (sentence, index) =>
      index > lastReasoningIndex &&
      hasRenderableTextValue(sentence) &&
      !looksLikeReasoningSentence(sentence),
  );

  if (answerStartIndex <= lastReasoningIndex) {
    return null;
  }

  const candidateSentences = normalizedSentences.slice(answerStartIndex);
  const hasDirectAnswerLead = candidateSentences.some((sentence) => looksLikeDirectAnswerStart(sentence.toLowerCase()));
  if (!hasDirectAnswerLead && !looksLikeReasoningSignal(normalized)) {
    return null;
  }

  const finalText = sentenceMatches.slice(answerStartIndex).join(" ").trim();
  const reasoningText = sentenceMatches.slice(0, answerStartIndex).join(" ").trim();
  if (!hasRenderableTextValue(finalText) || !hasRenderableTextValue(reasoningText)) {
    return null;
  }

  if (looksLikeReasoningSentence(normalizeSentenceForDetection(finalText))) {
    return null;
  }

  return {
    reasoningText,
    finalText,
  };
}

export function splitAssistantReasoningLeak(value: string): AssistantTextSplit | null {
  const normalized = normalizeVisibleText(value);
  if (!normalized) return null;

  return maybeSplitAssistantReasoningLeak(normalized) ?? maybeSplitSingleParagraphReasoningLeak(normalized);
}

export function sanitizeAssistantOutputText(value: string): string {
  const normalized = normalizeVisibleText(value);
  if (!normalized) return "";

  const split = splitAssistantReasoningLeak(normalized);
  if (split) {
    const finalCandidate = normalizeSentenceForDetection(split.finalText).toLowerCase();
    if (
      finalCandidate.length >= 12 &&
      !looksLikeReasoningSentence(finalCandidate) &&
      !STREAMING_REASONING_GUARD_REGEX.test(finalCandidate)
    ) {
      return trimTrailingReasoningFragments(split.finalText);
    }
  }

  const trailingLine = extractTrailingFinalLine(normalized);
  if (trailingLine) {
    const trailingCandidate = normalizeSentenceForDetection(trailingLine).toLowerCase();
    if (
      trailingCandidate.length >= 12 &&
      !looksLikeReasoningSentence(trailingCandidate) &&
      !STREAMING_REASONING_GUARD_REGEX.test(trailingCandidate)
    ) {
      return trimTrailingReasoningFragments(trailingLine);
    }
  }

  const trimmed = trimTrailingReasoningFragments(normalized);
  if (splitIntoSentences(trimmed).length <= 1) {
    return recoverCleanAnswerSentences(normalized) ?? trimmed;
  }

  return trimmed;
}

export function sanitizeAssistantOutputTextForStreaming(value: string): string {
  const normalized = normalizeVisibleText(value);
  if (!normalized) return "";

  const split = splitAssistantReasoningLeak(normalized);
  if (split) {
    const finalCandidate = normalizeSentenceForDetection(split.finalText).toLowerCase();
    if (
      finalCandidate.length >= 12 &&
      !looksLikeReasoningSentence(finalCandidate) &&
      !STREAMING_REASONING_GUARD_REGEX.test(finalCandidate)
    ) {
      return trimTrailingReasoningFragments(split.finalText);
    }
  }

  const trailingLine = extractTrailingFinalLine(normalized);
  if (trailingLine) {
    const trailingCandidate = normalizeSentenceForDetection(trailingLine).toLowerCase();
    if (
      trailingCandidate.length >= 12 &&
      !looksLikeReasoningSentence(trailingCandidate) &&
      !STREAMING_REASONING_GUARD_REGEX.test(trailingCandidate)
    ) {
      return trimTrailingReasoningFragments(trailingLine);
    }
  }

  if (looksLikeReasoningSignal(normalized)) return "";
  if (STREAMING_REASONING_GUARD_REGEX.test(normalized.toLowerCase())) return "";

  const normalizedLeading = normalizeSentenceForDetection(normalized).toLowerCase();
  if (!looksLikeDirectAnswerStart(normalizedLeading)) return "";

  const trimmed = trimTrailingReasoningFragments(normalized);
  if (splitIntoSentences(trimmed).length <= 1) {
    return recoverCleanAnswerSentences(normalized) ?? trimmed;
  }

  return trimmed;
}

function normalizeAssistantParts(parts: UIMessage["parts"]): UIMessage["parts"] {
  const output: UIMessage["parts"] = [];

  for (const part of parts) {
    if (!isRecord(part) || typeof part.type !== "string") {
      output.push(part as UIMessage["parts"][number]);
      continue;
    }

    if (part.type !== "text") {
      output.push(part as UIMessage["parts"][number]);
      continue;
    }

    const text = normalizeVisibleText(part.text);
    const split = splitAssistantReasoningLeak(text);
    if (!split) {
      output.push(part as UIMessage["parts"][number]);
      continue;
    }

    output.push({ type: "reasoning", text: split.reasoningText } as UIMessage["parts"][number]);
    output.push({ ...part, text: split.finalText } as UIMessage["parts"][number]);
  }

  return output;
}

export function getMessageParts(message: MessageLike | null | undefined): UIMessage["parts"] {
  if (!message) return [];

  const rawParts = Array.isArray(message.parts)
    ? (message.parts as UIMessage["parts"])
    : [];

  const contentText = normalizeVisibleText(message.content);
  const hasTextLikePart = rawParts.some((part) => {
    if (!isRecord(part) || typeof part.type !== "string") return false;
    if (part.type === "text" || part.type === "reasoning") {
      return hasRenderableTextValue(part.text);
    }
    return false;
  });

  if (rawParts.length === 0) {
    if (contentText.length > 0) {
      const parts = [{ type: "text", text: contentText }] as UIMessage["parts"];
      return message.role === "assistant" ? normalizeAssistantParts(parts) : parts;
    }
    return [];
  }

  if (!hasTextLikePart && contentText.length > 0) {
    const parts = [...rawParts, { type: "text", text: contentText }] as UIMessage["parts"];
    return message.role === "assistant" ? normalizeAssistantParts(parts) : parts;
  }

  return message.role === "assistant" ? normalizeAssistantParts(rawParts) : rawParts;
}

export function getMessagePartTypes(parts: unknown[]): string[] {
  return parts.map((part) => {
    if (!isRecord(part) || typeof part.type !== "string" || part.type.trim().length === 0) {
      return "unknown";
    }

    return part.type;
  });
}

export function extractTextFromMessageParts(parts: unknown[]): string {
  return parts
    .map((part) => {
      if (!isRecord(part) || part.type !== "text") return "";
      return normalizeVisibleText(part.text);
    })
    .join("\n")
    .trim();
}

export function normalizeVisibleText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(INVISIBLE_TEXT_CHARS_REGEX, "").trim();
}

export function hasRenderableTextValue(value: unknown): boolean {
  const normalized = normalizeVisibleText(value);
  if (!normalized) return false;

  const nonEmptyLines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (nonEmptyLines.length === 0) return false;

  const meaningfulLines = nonEmptyLines.filter((line) => !MARKDOWN_DECORATOR_LINE_REGEX.test(line));
  if (meaningfulLines.length === 0) return false;

  const substantive = meaningfulLines
    .join(" ")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .trim();

  return substantive.length > 0;
}

export function isRenderableMessagePart(part: unknown): boolean {
  if (!isRecord(part) || typeof part.type !== "string") return false;

  if (part.type === "text" || part.type === "reasoning") {
    return hasRenderableTextValue(part.text);
  }

  if (part.type === "file") {
    return typeof part.url === "string" && part.url.trim().length > 0;
  }

  if (part.type === "image") {
    const imageUrl = typeof part.image === "string"
      ? part.image
      : typeof part.url === "string"
        ? part.url
        : "";
    return imageUrl.trim().length > 0;
  }

  if (part.type === "dynamic-tool") {
    const toolName = normalizeVisibleText(part.toolName);
    const state = normalizeVisibleText(part.state);
    if (toolName.length === 0 && state.length === 0) return false;
    return TOOL_TERMINAL_STATES.has(state);
  }

  if (part.type.startsWith("tool-")) {
    const inferredName = normalizeVisibleText(part.type.replace(/^tool-/, ""));
    const explicitName = normalizeVisibleText(part.toolName);
    const state = normalizeVisibleText(part.state);
    if (inferredName.length === 0 && explicitName.length === 0 && state.length === 0) return false;
    return TOOL_TERMINAL_STATES.has(state);
  }

  return false;
}

export function hasRenderableAssistantContent(message: MessageLike | null | undefined): boolean {
  if (!message || message.role !== "assistant") return false;

  return getMessageParts(message).some((part) => {
    if (!isRecord(part) || typeof part.type !== "string") return false;

    const partRecord = part as Record<string, unknown>;
    const partType = partRecord.type;

    if (partType === "text" || partType === "reasoning") {
      return hasRenderableTextValue(partRecord.text);
    }

    if (partType === "file") {
      return typeof partRecord.url === "string" && partRecord.url.trim().length > 0;
    }

    if (partType === "image") {
      const imageUrl = typeof partRecord.image === "string"
        ? partRecord.image
        : typeof partRecord.url === "string"
          ? partRecord.url
          : "";
      return imageUrl.trim().length > 0;
    }

    return false;
  });
}

export function createAssistantFallbackParts(
  text = NON_RENDERABLE_ASSISTANT_FALLBACK_TEXT,
): UIMessage["parts"] {
  return [{ type: "text", text }] as UIMessage["parts"];
}

export function buildAssistantFallbackMessage(
  text: string,
  existing?: Partial<UIMessage>,
): UIMessage {
  const nextMessage: UIMessage = {
    id:
      typeof existing?.id === "string" && existing.id.trim().length > 0
        ? existing.id
        : crypto.randomUUID(),
    role: "assistant",
    parts: createAssistantFallbackParts(text),
  };

  if (existing && "metadata" in existing) {
    return { ...nextMessage, metadata: existing.metadata } as UIMessage;
  }

  return nextMessage;
}

export function normalizeAssistantMessage(
  message: UIMessage,
  fallbackText = NON_RENDERABLE_ASSISTANT_FALLBACK_TEXT,
): UIMessage {
  const parts = getMessageParts(message);

  if (message.role !== "assistant") {
    return { ...message, parts };
  }

  if (parts.some((part) => isRenderableMessagePart(part))) {
    return { ...message, parts };
  }

  return {
    ...message,
    parts: createAssistantFallbackParts(fallbackText),
  };
}

export function sanitizeStoredMessage(input: {
  role: MessageRole;
  content: string;
  parts?: unknown[] | null;
  fallbackText?: string;
}): {
  content: string;
  parts: unknown[] | null;
  usedFallback: boolean;
  originalPartTypes: string[];
} {
  const baseParts = Array.isArray(input.parts)
    ? input.parts
    : typeof input.content === "string" && input.content.trim().length > 0
      ? ([{ type: "text", text: input.content }] as unknown[])
      : [];

  if (input.role === "assistant") {
    const candidate: UIMessage = {
      id: "storage-normalization",
      role: "assistant",
      parts: baseParts as UIMessage["parts"],
    };

    if (!hasRenderableAssistantContent(candidate)) {
      const fallbackText = input.fallbackText ?? NON_RENDERABLE_ASSISTANT_FALLBACK_TEXT;
      return {
        content: fallbackText,
        parts: createAssistantFallbackParts(fallbackText) as unknown[],
        usedFallback: true,
        originalPartTypes: getMessagePartTypes(baseParts),
      };
    }
  }

  const normalizedContent =
    input.content.trim() || extractTextFromMessageParts(baseParts) || "[non-text content]";

  return {
    content: normalizedContent,
    parts: baseParts.length > 0 ? baseParts : null,
    usedFallback: false,
    originalPartTypes: getMessagePartTypes(baseParts),
  };
}