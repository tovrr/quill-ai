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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
      return [{ type: "text", text: contentText }] as UIMessage["parts"];
    }
    return [];
  }

  if (!hasTextLikePart && contentText.length > 0) {
    return [...rawParts, { type: "text", text: contentText }] as UIMessage["parts"];
  }

  return rawParts;
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