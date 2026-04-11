import { convertToModelMessages, type ModelMessage } from "ai";
import {
  chatRequestSchema,
  type ChatRequestBody,
  type ChatRequestPart,
} from "@/lib/chat-request";

export function parseChatRequestBody(rawBody: unknown):
  | { success: true; data: ChatRequestBody }
  | { success: false; issuePath: string; message: string } {
  const parsed = chatRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      success: false,
      issuePath: issue?.path?.length ? issue.path.join(".") : "body",
      message: issue?.message ?? "Request payload is malformed.",
    };
  }

  return { success: true, data: parsed.data };
}

export function requestHasImageInput(body: ChatRequestBody): boolean {
  if (!body.messages) return false;

  for (const message of body.messages) {
    if (Array.isArray(message.parts)) {
      for (const part of message.parts) {
        if (part.type === "file" && typeof part.mediaType === "string" && part.mediaType.startsWith("image/")) {
          return true;
        }
      }
    }

    if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (typeof block.type === "string" && block.type.startsWith("image")) {
          return true;
        }
      }
    }
  }

  return false;
}

export function extractTextMessages(body: ChatRequestBody): Array<{ role: string; content: string }> {
  if (body.messages && body.messages.length > 0) {
    return body.messages
      .map((message) => {
        if (typeof message.content === "string" && message.content.trim()) {
          return { role: message.role ?? "user", content: message.content };
        }

        if (Array.isArray(message.content)) {
          const text = message.content
            .filter((block) => block.type === "text")
            .map((block) => (typeof block.text === "string" ? block.text : ""))
            .join("");
          if (text.trim()) return { role: message.role ?? "user", content: text };
        }

        if (Array.isArray(message.parts)) {
          const text = message.parts
            .filter((part) => part.type === "text")
            .map((part) => (typeof part.text === "string" ? part.text : ""))
            .join("");
          if (text.trim()) return { role: message.role ?? "user", content: text };
        }

        const stringified = JSON.stringify(message);
        if (stringified && stringified.length > 2) {
          return { role: message.role || "user", content: stringified };
        }
        return null;
      })
      .filter((m): m is { role: string; content: string } => m !== null && m.content.trim().length > 0);
  }

  if (typeof body.text === "string" && body.text.trim()) {
    return [{ role: "user", content: body.text }];
  }

  if (body.message && typeof body.message === "object") {
    const msg = body.message as { role?: string; content?: string };
    if (msg.content && msg.content.trim()) {
      return [{ role: msg.role || "user", content: msg.content }];
    }
  }

  return [];
}

function decodeDataUrlText(url: string): string | null {
  const match = url.match(/^data:([^;,]*)(;base64)?,(.*)$/i);
  if (!match) return null;

  const [, , isBase64, payload] = match;
  try {
    const decoded = isBase64
      ? Buffer.from(payload, "base64").toString("utf8")
      : decodeURIComponent(payload);
    return decoded;
  } catch {
    return null;
  }
}

function isTextLikeMediaType(mediaType: string): boolean {
  const normalized = mediaType.toLowerCase();
  return (
    normalized.startsWith("text/") ||
    normalized === "application/json" ||
    normalized === "application/xml" ||
    normalized === "application/javascript" ||
    normalized === "application/x-javascript" ||
    normalized === "application/csv" ||
    normalized === "text/csv"
  );
}

function sanitizePartsForModel(parts: ChatRequestPart[]): unknown[] {
  const output: unknown[] = [];

  for (const part of parts) {
    if (!part || typeof part !== "object") {
      output.push(part);
      continue;
    }

    const candidate = part as ChatRequestPart & {
      type?: unknown;
      url?: unknown;
      mediaType?: unknown;
      filename?: unknown;
    };

    if (
      candidate.type === "file" &&
      typeof candidate.url === "string" &&
      candidate.url.startsWith("data:")
    ) {
      const mediaType = typeof candidate.mediaType === "string" ? candidate.mediaType : "application/octet-stream";
      const filename = typeof candidate.filename === "string" && candidate.filename.trim().length > 0
        ? candidate.filename.trim()
        : "attachment";

      if (isTextLikeMediaType(mediaType)) {
        const decoded = decodeDataUrlText(candidate.url);
        if (decoded && decoded.trim().length > 0) {
          const excerpt = decoded.slice(0, 12_000);
          output.push({
            type: "text",
            text: [`[Attached file: ${filename} (${mediaType})]`, excerpt].join("\n\n"),
          });
          continue;
        }
      }

      output.push({
        type: "text",
        text: `[Attached file: ${filename} (${mediaType}) was provided, but direct inline file URLs are not supported for this provider.]`,
      });
      continue;
    }

    output.push(part);
  }

  return output;
}

export async function extractModelMessages(body: ChatRequestBody): Promise<ModelMessage[]> {
  if (body.messages && body.messages.length > 0) {
    const normalized = body.messages
      .map((message) => {
        const role = typeof message.role === "string" ? message.role : "user";

        if (Array.isArray(message.parts) && message.parts.length > 0) {
          return { role, parts: sanitizePartsForModel(message.parts) };
        }

        if (typeof message.content === "string" && message.content.trim()) {
          return {
            role,
            parts: [{ type: "text", text: message.content }],
          };
        }

        if (Array.isArray(message.content)) {
          const text = message.content
            .filter((block) => block.type === "text" && typeof block.text === "string")
            .map((block) => block.text as string)
            .join("");

          if (text.trim()) {
            return {
              role,
              parts: [{ type: "text", text }],
            };
          }
        }

        return null;
      })
      .filter((m): m is { role: string; parts: unknown[] } => m !== null);

    if (normalized.length > 0) {
      try {
        return await convertToModelMessages(normalized as any);
      } catch (error) {
        console.warn("[chat] convertToModelMessages fallback:", error instanceof Error ? error.message : error);
      }
    }
  }

  return extractTextMessages(body).map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));
}

export function summarizeLastUserInput(body: ChatRequestBody): string | null {
  if (!body.messages) return null;

  const lastUserMessage = [...body.messages].reverse().find((message) => message.role === "user");
  if (!lastUserMessage) return null;

  if (Array.isArray(lastUserMessage.parts)) {
    const text = lastUserMessage.parts
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text as string)
      .join("\n")
      .trim();

    const files = lastUserMessage.parts
      .filter((part) => part.type === "file")
      .map((part, index: number) =>
        typeof part.filename === "string" && part.filename.trim()
          ? part.filename.trim()
          : `file-${index + 1}`
      );

    if (text && files.length > 0) {
      return `${text}\n\n[Attached: ${files.join(", ")}]`;
    }
    if (text) return text;
    if (files.length > 0) return `[Attached files: ${files.join(", ")}]`;
  }

  if (typeof lastUserMessage.content === "string" && lastUserMessage.content.trim()) {
    return lastUserMessage.content.trim();
  }

  return null;
}

export function getLastUserParts(body: ChatRequestBody): ChatRequestPart[] | undefined {
  if (!body.messages) return undefined;

  const lastUserMessage = [...body.messages].reverse().find((message) => message.role === "user");
  if (!lastUserMessage) return undefined;

  if (Array.isArray(lastUserMessage.parts) && lastUserMessage.parts.length > 0) {
    return lastUserMessage.parts;
  }

  if (typeof lastUserMessage.content === "string" && lastUserMessage.content.trim()) {
    return [{ type: "text", text: lastUserMessage.content.trim() }];
  }

  return undefined;
}
