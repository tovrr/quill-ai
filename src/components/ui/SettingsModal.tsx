"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  SwatchIcon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  USER_PRESET_TEMPLATES,
  type UserInstructionProfile,
} from "@/lib/extensions/customization";
import { Button } from "@/components/ui/button";
import {
  Select as UiSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  type AppSettings,
  loadAppSettings,
  saveAppSettings,
} from "@/lib/ui-settings";

// ── Types ────────────────────────────────────────────────────────────────────

export type { AppSettings } from "@/lib/ui-settings";
export const loadSettings = loadAppSettings;

// ── Sub-components ───────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <Switch checked={on} onCheckedChange={onChange} />
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-[#1a1a28]">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-quill-text">{label}</p>
        {hint && <p className="text-xs text-quill-muted mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function SettingSelect({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <UiSelect value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-44 rounded-lg border-quill-border-2 bg-[#1a1a28] text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </UiSelect>
  );
}

// ── Sections ─────────────────────────────────────────────────────────────────

type Section = "general" | "usage" | "appearance" | "privacy" | "account";

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  {
    id: "general",
    label: "General",
    icon: <Cog6ToothIcon className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  {
    id: "usage",
    label: "Usage & API",
    icon: <ChartBarIcon className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: <SwatchIcon className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  {
    id: "privacy",
    label: "Privacy",
    icon: <ShieldCheckIcon className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  {
    id: "account",
    label: "Account",
    icon: <UserCircleIcon className="h-3.5 w-3.5" aria-hidden="true" />,
  },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
  { value: "ar", label: "Arabic" },
  { value: "ko", label: "Korean" },
];

const MODES = [
  { value: "fast", label: "Fast", desc: "Quick responses" },
  { value: "thinking", label: "Think", desc: "Deep reasoning" },
  { value: "advanced", label: "Pro", desc: "Best quality" },
] as const;

// ── Main Modal ────────────────────────────────────────────────────────────────

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type UsageData = {
  planLabel: string;
  canUsePaidModes: boolean;
  messagesUsedToday: number;
  recommendedDailyLimit: number;
  usagePercent: number;
  limits: {
    fast: number;
    thinking: number;
    advanced: number;
  };
  webSearchState: "available" | "coming-soon";
  imageGenerationState: "auth-required";
};

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const router = useRouter();
  const [section, setSection] = useState<Section>("general");
  // Loaded fresh on every mount (component unmounts when closed via `if (!open) return null`)
  const [settings, setSettings] = useState<AppSettings>(() => loadAppSettings());
  const [saved, setSaved] = useState(false);
  const [accountName, setAccountName] = useState("User");
  const [accountEmail, setAccountEmail] = useState("user@example.com");
  const [planLabel, setPlanLabel] = useState("Free");
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    const loadAccount = async () => {
      setUsageLoading(true);
      try {
        const [{ authClient }, entitlementsRes, usageRes] = await Promise.all([
          import("@/lib/auth/client"),
          fetch("/api/me/entitlements", { cache: "no-store" }),
          fetch("/api/me/usage", { cache: "no-store" }),
        ]);

        const session = await authClient.getSession();
        const user = session.data?.user;
        if (user) {
          setAccountName(user.name ?? user.email?.split("@")[0] ?? "User");
          setAccountEmail(user.email ?? "");
        }

        if (entitlementsRes.ok) {
          const entitlements = (await entitlementsRes.json()) as { planLabel?: string };
          if (entitlements.planLabel) setPlanLabel(entitlements.planLabel);
        }

        if (usageRes.ok) {
          const usage = (await usageRes.json()) as UsageData;
          setUsageData(usage);
        }
      } catch {
        setPlanLabel("Free");
      } finally {
        setUsageLoading(false);
      }
    };

    void loadAccount();
  }, [open]);

  const update = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
  }, []);

  const handleSave = () => {
    saveAppSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex flex-col bg-[#0d0d15] border border-quill-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
        style={{ width: "680px", maxWidth: "95vw", height: "520px", maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-quill-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-quill-text">Settings</h2>
            <p className="text-xs text-quill-muted mt-0.5">Manage your Quill AI preferences</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-8 w-8 rounded-lg p-0 text-quill-muted hover:text-quill-text hover:bg-quill-surface-2"
          >
            <XMarkIcon className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Left nav */}
          <nav className="w-44 shrink-0 border-r border-quill-border p-3 flex flex-col gap-0.5">
            {SECTIONS.map((s) => (
              <Button
                key={s.id}
                type="button"
                variant="ghost"
                onClick={() => setSection(s.id)}
                className={`flex h-auto w-full items-center justify-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm ${
                  section === s.id
                    ? "bg-[#EF4444] text-white"
                    : "text-quill-muted hover:text-quill-text hover:bg-quill-surface-2"
                }`}
              >
                {s.icon}
                {s.label}
              </Button>
            ))}
          </nav>

          {/* Right content */}
          <div className="flex-1 overflow-y-auto px-6 py-2">

            {/* General */}
            {section === "general" && (
              <div>
                <p className="text-[11px] font-semibold text-quill-muted uppercase tracking-wider pt-3 pb-1">General</p>

                <Row label="Language" hint="Interface and response language">
                  <SettingSelect
                    value={settings.language}
                    onChange={(v) => update("language", v)}
                    options={LANGUAGES}
                  />
                </Row>

                <Row label="Default mode" hint="Model used when starting a new chat">
                  <div className="flex items-center gap-1 p-0.5 rounded-lg bg-quill-bg border border-quill-border">
                    {MODES.map((m) => (
                      <Button
                        key={m.value}
                        type="button"
                        variant="ghost"
                        onClick={() => update("defaultMode", m.value)}
                        aria-label={m.desc}
                        className={`h-auto rounded-md px-2.5 py-1 text-xs font-medium ${
                          settings.defaultMode === m.value
                            ? "bg-[#EF4444] text-white"
                            : "text-quill-muted hover:text-[#A1A7B0]"
                        }`}
                      >
                        {m.label}
                      </Button>
                    ))}
                  </div>
                </Row>

                <Row label="Send on Enter" hint="Press Enter to send; Shift+Enter for new line">
                  <Toggle on={settings.sendOnEnter} onChange={(v) => update("sendOnEnter", v)} />
                </Row>

                <Row label="Auto-open Canvas" hint="Automatically open canvas when a page is generated">
                  <Toggle on={settings.autoOpenCanvas} onChange={(v) => update("autoOpenCanvas", v)} />
                </Row>

                <div className="pt-4">
                  <p className="text-[11px] font-semibold text-quill-muted uppercase tracking-wider pb-2">Quill customization</p>
                  <div className="p-3 rounded-xl bg-quill-surface border border-quill-border space-y-3">
                    <div>
                      <p className="text-xs text-quill-muted mb-1.5">Preset profile</p>
                      <SettingSelect
                        value={settings.instructionProfile.preset}
                        onChange={(v) =>
                          update("instructionProfile", {
                            ...settings.instructionProfile,
                            preset: v as UserInstructionProfile["preset"],
                          })
                        }
                        options={Object.entries(USER_PRESET_TEMPLATES).map(([value, meta]) => ({ value, label: meta.label }))}
                      />
                    </div>

                    <div>
                      <p className="text-xs text-quill-muted mb-1.5">Additional instructions</p>
                      <Textarea
                        value={settings.instructionProfile.additionalInstructions}
                        onChange={(e) =>
                          update("instructionProfile", {
                            ...settings.instructionProfile,
                            additionalInstructions: e.target.value,
                          })
                        }
                        placeholder="Example: Always keep responses concise, avoid placeholders, and prioritize practical execution steps."
                        className="h-22 resize-none rounded-lg bg-[#121220] text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Usage & API */}
            {section === "usage" && (
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-quill-muted uppercase tracking-wider pt-3 pb-1">Live usage</p>

                {usageLoading && (
                  <div className="p-4 rounded-xl bg-quill-surface border border-quill-border text-sm text-[#A1A7B0]">
                    Loading usage data...
                  </div>
                )}

                {!usageLoading && usageData && (
                  <>
                    <div className="p-4 rounded-xl bg-quill-surface border border-quill-border space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-quill-text">Messages today</span>
                        <span className="text-sm font-semibold text-[#F87171]">
                          {usageData.messagesUsedToday} / {usageData.recommendedDailyLimit}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-quill-border overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${usageData.usagePercent}%`, background: "linear-gradient(to right, #EF4444, #F87171)" }}
                        />
                      </div>
                      <p className="text-[11px] text-quill-muted">Current plan: {usageData.planLabel}</p>
                    </div>

                    <p className="text-[11px] font-semibold text-quill-muted uppercase tracking-wider pt-3 pb-1">Per-mode limits</p>
                    <div className="p-3 rounded-xl bg-quill-surface border border-quill-border space-y-2 text-sm text-[#A1A7B0]">
                      <div className="flex items-center justify-between"><span>Fast</span><span>{usageData.limits.fast}/day</span></div>
                      <div className="flex items-center justify-between"><span>Think</span><span>{usageData.limits.thinking}/day</span></div>
                      <div className="flex items-center justify-between"><span>Pro</span><span>{usageData.limits.advanced}/day</span></div>
                    </div>

                    <p className="text-[11px] font-semibold text-quill-muted uppercase tracking-wider pt-3 pb-1">Feature status</p>
                    <div className="p-3 rounded-xl bg-quill-surface border border-quill-border space-y-2 text-sm text-[#A1A7B0]">
                      <div className="flex items-center justify-between">
                        <span>Web search</span>
                        <span className={usageData.webSearchState === "available" ? "text-quill-green" : "text-[#f59e0b]"}>
                          {usageData.webSearchState === "available" ? "Available" : "Coming soon"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Image generation</span>
                        <span className="text-quill-green">Signed-in users</span>
                      </div>
                    </div>
                  </>
                )}

                {!usageLoading && !usageData && (
                  <div className="p-4 rounded-xl bg-quill-surface border border-quill-border text-sm text-[#A1A7B0]">
                    Unable to load usage data right now.
                  </div>
                )}
              </div>
            )}

            {/* Appearance */}
            {section === "appearance" && (
              <div>
                <p className="text-[11px] font-semibold text-quill-muted uppercase tracking-wider pt-3 pb-1">Appearance</p>

                <Row label="Theme" hint="Color scheme for the interface">
                  <div className="flex items-center gap-1 p-0.5 rounded-lg bg-quill-bg border border-quill-border">
                    {[
                      { value: "dark", label: "Dark" },
                      { value: "system", label: "System" },
                    ].map((t) => (
                      <Button
                        key={t.value}
                        type="button"
                        variant="ghost"
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                          t.value === "dark"
                            ? "bg-[#EF4444] text-white"
                            : "text-quill-muted hover:text-[#A1A7B0]"
                        }`}
                      >
                        {t.label}
                      </Button>
                    ))}
                  </div>
                </Row>

                <Row label="Compact messages" hint="Reduce padding between messages for a denser view">
                  <Toggle on={settings.compactMessages} onChange={(v) => update("compactMessages", v)} />
                </Row>

                <Row label="Conversation layout" hint="Workspace uses Gemini-style assistant rendering">
                  <div className="flex items-center gap-1 p-0.5 rounded-lg bg-quill-bg border border-quill-border">
                    {([
                      { value: "workspace", label: "Workspace" },
                      { value: "chat", label: "Chat" },
                    ] as const).map((layout) => (
                      <Button
                        key={layout.value}
                        type="button"
                        variant="ghost"
                        onClick={() => update("conversationLayout", layout.value)}
                        className={`h-auto rounded-md px-2.5 py-1 text-xs font-medium ${
                          settings.conversationLayout === layout.value
                            ? "bg-[#EF4444] text-white"
                            : "text-quill-muted hover:text-[#A1A7B0]"
                        }`}
                      >
                        {layout.label}
                      </Button>
                    ))}
                  </div>
                </Row>

                <Row label="Assistant avatar" hint="Show assistant avatar on each response row">
                  <Toggle on={settings.showAssistantAvatar} onChange={(v) => update("showAssistantAvatar", v)} />
                </Row>

                <Row label="Assistant bubbles" hint="Wrap assistant responses in chat bubbles">
                  <Toggle on={settings.assistantBubbles} onChange={(v) => update("assistantBubbles", v)} />
                </Row>

                <Row label="Contextual actions" hint="Only reveal response actions on hover/focus">
                  <Toggle on={settings.contextualActions} onChange={(v) => update("contextualActions", v)} />
                </Row>

                <Row label="Focus mode" hint="Collapse sidebar and secondary chrome for deep work">
                  <Toggle on={settings.focusMode} onChange={(v) => update("focusMode", v)} />
                </Row>

                <Row label="Status surface" hint="Choose where live execution status appears">
                  <div className="flex items-center gap-1 p-0.5 rounded-lg bg-quill-bg border border-quill-border">
                    {([
                      { value: "thread", label: "Thread" },
                      { value: "hybrid", label: "Hybrid" },
                    ] as const).map((surface) => (
                      <Button
                        key={surface.value}
                        type="button"
                        variant="ghost"
                        onClick={() => update("statusSurface", surface.value)}
                        className={`h-auto rounded-md px-2.5 py-1 text-xs font-medium ${
                          settings.statusSurface === surface.value
                            ? "bg-[#EF4444] text-white"
                            : "text-quill-muted hover:text-[#A1A7B0]"
                        }`}
                      >
                        {surface.label}
                      </Button>
                    ))}
                  </div>
                </Row>

                <Row label="Composer labels" hint="Show text labels for composer icon actions">
                  <Toggle on={settings.showComposerLabels} onChange={(v) => update("showComposerLabels", v)} />
                </Row>

                <div className="mt-4 p-3 rounded-xl bg-quill-surface border border-quill-border">
                  <p className="text-xs text-quill-muted">
                    Additional themes (light mode, high contrast) are coming soon.
                  </p>
                </div>
              </div>
            )}

            {/* Privacy */}
            {section === "privacy" && (
              <div>
                <p className="text-[11px] font-semibold text-quill-muted uppercase tracking-wider pt-3 pb-1">Privacy</p>

                <Row label="Usage analytics" hint="Help improve Quill AI by sharing anonymous usage data">
                  <Toggle on={settings.analyticsEnabled} onChange={(v) => update("analyticsEnabled", v)} />
                </Row>

                <Row label="Chat history" hint="Save conversations to your account for later access">
                  <Toggle on={true} onChange={() => {}} />
                </Row>

                <Row label="Training data" hint="Allow your conversations to improve future models">
                  <Toggle on={false} onChange={() => {}} />
                </Row>

                <div className="mt-4 p-3 rounded-xl bg-quill-surface border border-quill-border space-y-1.5">
                  <p className="text-xs font-medium text-[#A1A7B0]">Data & Privacy</p>
                  <p className="text-xs text-quill-muted">
                    Your conversations are encrypted and stored securely. We never sell your data.
                  </p>
                  <Button type="button" variant="ghost" className="h-auto justify-start p-0 text-xs text-[#EF4444] hover:bg-transparent hover:text-[#F87171]">
                    Download your data
                  </Button>
                </div>
              </div>
            )}

            {/* Account */}
            {section === "account" && (
              <div>
                <p className="text-[11px] font-semibold text-quill-muted uppercase tracking-wider pt-3 pb-1">Account</p>

                <div className="flex items-center gap-3 py-3.5 border-b border-[#1a1a28]">
                  <div className="w-10 h-10 rounded-full bg-linear-to-br from-[#F87171] to-[#F87171] flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {(accountName || accountEmail || "U")[0]?.toUpperCase() ?? "U"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-quill-text">{accountName}</p>
                    <p className="text-xs text-quill-muted">{accountEmail}</p>
                  </div>
                </div>

                <Row label="Current plan" hint="Your active subscription tier">
                  <span className="px-2.5 py-1 rounded-full bg-quill-border text-xs font-medium text-[#A1A7B0]">
                    {planLabel}
                  </span>
                </Row>

                {planLabel === "Free" && (
                  <div className="mt-3 p-4 rounded-xl border border-[#EF444430] bg-[rgba(239,68,68,0.05)]">
                    <p className="text-sm font-semibold text-quill-text">Upgrade to Pro</p>
                    <p className="text-xs text-quill-muted mt-1 mb-3">
                      Unlimited messages, priority access to all models, and advanced features.
                    </p>
                    <Button
                      onClick={() => router.push("/pricing")}
                      type="button"
                      className="h-auto rounded-xl bg-[#EF4444] px-4 py-2 text-xs font-medium text-white hover:bg-[#DC2626]"
                    >
                      View plans
                    </Button>
                  </div>
                )}

                <div className="pt-4 flex flex-col gap-1">
                  <Button type="button" variant="ghost" className="h-auto justify-start p-0 py-1 text-left text-xs text-quill-muted hover:bg-transparent hover:text-[#A1A7B0]">
                    Sign out
                  </Button>
                  <Button type="button" variant="ghost" className="h-auto justify-start p-0 py-1 text-left text-xs text-[#f87171] hover:bg-transparent hover:text-[#fca5a5]">
                    Delete account
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-quill-border shrink-0">
          <span className="text-[11px] text-quill-muted">Quill AI v1.0.0</span>
          <Button
            onClick={handleSave}
            type="button"
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              saved
                ? "bg-quill-green text-white"
                : "bg-[#EF4444] hover:bg-[#DC2626] text-white"
            }`}
          >
            {saved ? (
              <>
                <CheckIcon className="h-3.25 w-3.25" aria-hidden="true" />
                Saved
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

