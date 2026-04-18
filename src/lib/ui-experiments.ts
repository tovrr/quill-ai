import { loadAppSettings } from "@/lib/ui-settings";

const UI_VARIANT_KEY = "quill-ui-variant-v1";

export type UiVariant = "control" | "workspace-default";

export function getUiVariant(): UiVariant {
  if (typeof window === "undefined") return "control";

  const existing = localStorage.getItem(UI_VARIANT_KEY);
  if (existing === "control" || existing === "workspace-default") {
    return existing;
  }

  const assigned: UiVariant = Math.random() < 0.5 ? "control" : "workspace-default";
  localStorage.setItem(UI_VARIANT_KEY, assigned);
  return assigned;
}

export function trackUiEvent(event: string, payload: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;

  const settings = loadAppSettings();
  if (!settings.analyticsEnabled) return;

  console.info(
    "[ui.telemetry]",
    JSON.stringify({
      event,
      ts: Date.now(),
      variant: getUiVariant(),
      ...payload,
    }),
  );
}
