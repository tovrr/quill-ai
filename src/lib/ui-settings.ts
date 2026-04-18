import {
  DEFAULT_USER_PROFILE,
  type UserInstructionProfile,
} from "@/lib/extensions/customization";

export type ConversationLayoutMode = "workspace" | "chat";
export type StatusSurfaceMode = "thread" | "hybrid";

export interface AppSettings {
  language: string;
  defaultMode: "fast" | "thinking" | "advanced";
  sendOnEnter: boolean;
  analyticsEnabled: boolean;
  compactMessages: boolean;
  autoOpenCanvas: boolean;
  instructionProfile: UserInstructionProfile;
  conversationLayout: ConversationLayoutMode;
  showAssistantAvatar: boolean;
  assistantBubbles: boolean;
  contextualActions: boolean;
  focusMode: boolean;
  showComposerLabels: boolean;
  statusSurface: StatusSurfaceMode;
}

export const SETTINGS_KEY = "quill-settings";

export const DEFAULT_SETTINGS: AppSettings = {
  language: "en",
  defaultMode: "advanced",
  sendOnEnter: true,
  analyticsEnabled: true,
  compactMessages: false,
  autoOpenCanvas: true,
  instructionProfile: DEFAULT_USER_PROFILE,
  conversationLayout: "workspace",
  showAssistantAvatar: false,
  assistantBubbles: false,
  contextualActions: true,
  focusMode: false,
  showComposerLabels: false,
  statusSurface: "thread",
};

export function loadAppSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore persistence failures in private mode / blocked storage
  }
}
