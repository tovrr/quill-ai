const SIMPLE_CRON_PART = /^([*]|\d+|\d+-\d+|\*\/\d+|\d+(,\d+)*)$/;

function normalizeWhitespace(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

export function normalizeWorkflowName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const name = normalizeWhitespace(input);
  if (!name) return null;
  return name.length > 80 ? `${name.slice(0, 80).trimEnd()}...` : name;
}

export function normalizeWorkflowPrompt(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const prompt = input.trim();
  if (!prompt) return null;
  if (prompt.length > 4000) return prompt.slice(0, 4000);
  return prompt;
}

export function normalizeTimezone(input: unknown): string {
  if (typeof input !== "string") return "UTC";
  const timezone = input.trim() || "UTC";
  try {
    // Intl throws for invalid timezone names.
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    return "UTC";
  }
}

export function normalizeCronExpression(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const expression = input.trim().replace(/\s+/g, " ");
  if (!expression) return null;

  const parts = expression.split(" ");
  if (parts.length !== 5) return null;
  const valid = parts.every((part) => SIMPLE_CRON_PART.test(part));
  return valid ? expression : null;
}

export function estimateNextRunAt(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}

/**
 * Compute the next Date when a cron expression fires after a given reference time.
 * Uses cron-parser (5-field standard cron). Falls back to +1 hour on parse error.
 */
export function computeNextRunAt(cronExpression: string, timezone = "UTC", after = new Date()): Date {
  try {
    const parser = require("cron-parser") as {
      parseExpression: (
        expr: string,
        opts?: { currentDate?: Date; tz?: string },
      ) => {
        next(): { toDate(): Date };
      };
    };
    const interval = parser.parseExpression(cronExpression, {
      currentDate: after,
      tz: timezone,
    });
    return interval.next().toDate();
  } catch {
    return new Date(after.getTime() + 60 * 60 * 1000);
  }
}
