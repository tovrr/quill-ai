"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  ComputerDesktopIcon,
  MoonIcon,
  SunIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { useThemeShortcut } from "@/lib/useThemeShortcut";
import { nextThemeMode, type ThemeMode } from "@/lib/theme";

/**
 * Three-state theme toggle (System / Light / Dark).
 *
 * - Click to cycle: System → Light → Dark → System
 * - Keyboard shortcut: Cmd/Ctrl+Shift+L (registered globally via useThemeShortcut)
 * - Renders a neutral placeholder on SSR/initial hydration to avoid
 *   a flash of the wrong icon (next-themes can't read localStorage on the server).
 */
export function ThemeToggle({ className }: { className?: string }) {
  // Mount the global keyboard shortcut exactly once per app.
  useThemeShortcut();

  const [mounted, setMounted] = React.useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const current = (theme ?? "system") as ThemeMode;
  const next = nextThemeMode(current);

  const onClick = () => setTheme(next);

  const label = React.useMemo(() => {
    if (!mounted) return "Theme";
    if (current === "system") return `Theme: System (${resolvedTheme ?? "…"})`;
    return `Theme: ${current[0]!.toUpperCase()}${current.slice(1)}`;
  }, [mounted, current, resolvedTheme]);

  const Icon = !mounted
    ? ComputerDesktopIcon
    : current === "system"
    ? ComputerDesktopIcon
    : resolvedTheme === "dark"
    ? MoonIcon
    : SunIcon;

  return (
    <Button
      type="button"
      onClick={onClick}
      variant="outline"
      size="icon"
      aria-label={label}
      title={`${label} — click to switch to ${next} (⌘/Ctrl+Shift+L)`}
      className={className}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </Button>
  );
}
