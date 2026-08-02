/**
 * Pure theme helpers — extracted from useThemeShortcut for unit testing
 * and so the cycle order is the single source of truth.
 */

export type ThemeMode = "system" | "light" | "dark";

/** Order the cycle follows: System → Light → Dark → System. */
export const THEME_CYCLE: readonly ThemeMode[] = ["system", "light", "dark"] as const;

/** Returns the next mode in the cycle, wrapping at the end. */
export function nextThemeMode(current: ThemeMode): ThemeMode {
  const idx = THEME_CYCLE.indexOf(current);
  if (idx === -1) return "system";
  return THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]!;
}

/**
 * Resolves the actual visual theme ("light" or "dark") given a chosen
 * theme and the system preference. Mirrors next-themes' `resolvedTheme`
 * semantics without depending on the hook, so it can be unit tested.
 */
export function resolveThemeMode(
  theme: ThemeMode,
  systemPrefersDark: boolean,
): "light" | "dark" {
  if (theme === "light") return "light";
  if (theme === "dark") return "dark";
  return systemPrefersDark ? "dark" : "light";
}
