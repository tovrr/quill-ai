export function parseBoundedInt(input: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number(input ?? String(fallback));
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  return Math.min(Math.max(rounded, min), max);
}

export function sanitizeGoogleNameQuery(input: string | null, maxLength = 120): string {
  if (!input) return "";
  const trimmed = input.trim();
  if (!trimmed) return "";

  // Keep user text query safe for Google Drive q filter strings.
  return trimmed
    .slice(0, maxLength)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

export async function readSafeErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) {
    return `upstream_${res.status}`;
  }

  return text.slice(0, 800);
}