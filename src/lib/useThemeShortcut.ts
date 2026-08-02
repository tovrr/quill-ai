"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { nextThemeMode, type ThemeMode } from "@/lib/theme";

/**
 * Global keyboard shortcut to cycle theme:
 *   - Cmd+Shift+L (macOS)
 *   - Ctrl+Shift+L (Windows/Linux)
 *
 * Cycle order: system → light → dark → system → …
 *
 * Skipped while the user is typing in a text input / textarea / contentEditable,
 * so the shortcut never hijacks real "select line" behavior in editors.
 */
export function useThemeShortcut() {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey || e.altKey) return;
      if (e.key !== "L" && e.key !== "l") return;

      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      e.preventDefault();
      setTheme(nextThemeMode((theme ?? "system") as ThemeMode));
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [theme, setTheme]);
}
