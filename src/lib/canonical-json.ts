/**
 * JSON with the keys of every object sorted, so the same value always gives the same text.
 *
 * Two things rely on it and must never drift apart: the repeat key of the loop guards
 * (src/lib/agent/loop-guards.ts) and the Autopilot tool-policy hash
 * (src/lib/autopilot/tool-policy.ts, whose stored value is compared with a recomputed one).
 * Keep it pure and free of imports: loop-guards.ts may not import from `ai`.
 *
 * An `undefined` object member is left out, as JSON.stringify does; an `undefined` or
 * function value at the top or in an array becomes `null`.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, inner]) => inner !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${canonicalJson(inner)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
