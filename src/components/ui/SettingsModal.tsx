"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AppSettings {
  language: string;
  defaultMode: "fast" | "thinking" | "advanced";
  sendOnEnter: boolean;
  analyticsEnabled: boolean;
  compactMessages: boolean;
  autoOpenCanvas: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  language: "en",
  defaultMode: "advanced",
  sendOnEnter: true,
  analyticsEnabled: true,
  compactMessages: false,
  autoOpenCanvas: true,
};

const SETTINGS_KEY = "quill-settings";

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0"
      style={{ background: on ? "#7c6af7" : "#2a2a3e" }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: on ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-[#1a1a28]">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#e8e8f0]">{label}</p>
        {hint && <p className="text-xs text-[#6b6b8a] mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[#1a1a28] border border-[#2a2a3e] text-sm text-[#e8e8f0] rounded-lg px-3 py-1.5 outline-none focus:border-[#7c6af7] transition-colors cursor-pointer"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ── Sections ─────────────────────────────────────────────────────────────────

type Section = "general" | "appearance" | "privacy" | "account";

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  {
    id: "general",
    label: "General",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
      </svg>
    ),
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a10 10 0 0 1 0 20" fill="currentColor" opacity="0.15" />
      </svg>
    ),
  },
  {
    id: "privacy",
    label: "Privacy",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    id: "account",
    label: "Account",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
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

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [section, setSection] = useState<Section>("general");
  // Loaded fresh on every mount (component unmounts when closed via `if (!open) return null`)
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [saved, setSaved] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const update = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
  }, []);

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex flex-col bg-[#0d0d15] border border-[#1e1e2e] rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
        style={{ width: "680px", maxWidth: "95vw", height: "520px", maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e2e] shrink-0">
          <div>
            <h2 className="text-base font-semibold text-[#e8e8f0]">Settings</h2>
            <p className="text-xs text-[#6b6b8a] mt-0.5">Manage your Quill AI preferences</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6b6b8a] hover:text-[#e8e8f0] hover:bg-[#16161f] transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Left nav */}
          <nav className="w-44 shrink-0 border-r border-[#1e1e2e] p-3 flex flex-col gap-0.5">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-all text-left ${
                  section === s.id
                    ? "bg-[#7c6af7] text-white"
                    : "text-[#6b6b8a] hover:text-[#e8e8f0] hover:bg-[#16161f]"
                }`}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </nav>

          {/* Right content */}
          <div className="flex-1 overflow-y-auto px-6 py-2">

            {/* General */}
            {section === "general" && (
              <div>
                <p className="text-[11px] font-semibold text-[#6b6b8a] uppercase tracking-wider pt-3 pb-1">General</p>

                <Row label="Language" hint="Interface and response language">
                  <Select
                    value={settings.language}
                    onChange={(v) => update("language", v)}
                    options={LANGUAGES}
                  />
                </Row>

                <Row label="Default mode" hint="Model used when starting a new chat">
                  <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#0a0a0f] border border-[#1e1e2e]">
                    {MODES.map((m) => (
                      <button
                        key={m.value}
                        onClick={() => update("defaultMode", m.value)}
                        title={m.desc}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                          settings.defaultMode === m.value
                            ? "bg-[#7c6af7] text-white"
                            : "text-[#6b6b8a] hover:text-[#a8a8c0]"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </Row>

                <Row label="Send on Enter" hint="Press Enter to send; Shift+Enter for new line">
                  <Toggle on={settings.sendOnEnter} onChange={(v) => update("sendOnEnter", v)} />
                </Row>

                <Row label="Auto-open Canvas" hint="Automatically open canvas when a page is generated">
                  <Toggle on={settings.autoOpenCanvas} onChange={(v) => update("autoOpenCanvas", v)} />
                </Row>
              </div>
            )}

            {/* Appearance */}
            {section === "appearance" && (
              <div>
                <p className="text-[11px] font-semibold text-[#6b6b8a] uppercase tracking-wider pt-3 pb-1">Appearance</p>

                <Row label="Theme" hint="Color scheme for the interface">
                  <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#0a0a0f] border border-[#1e1e2e]">
                    {[
                      { value: "dark", label: "Dark" },
                      { value: "system", label: "System" },
                    ].map((t) => (
                      <button
                        key={t.value}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                          t.value === "dark"
                            ? "bg-[#7c6af7] text-white"
                            : "text-[#6b6b8a] hover:text-[#a8a8c0]"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </Row>

                <Row label="Compact messages" hint="Reduce padding between messages for a denser view">
                  <Toggle on={settings.compactMessages} onChange={(v) => update("compactMessages", v)} />
                </Row>

                <div className="mt-4 p-3 rounded-xl bg-[#111118] border border-[#1e1e2e]">
                  <p className="text-xs text-[#6b6b8a]">
                    Additional themes (light mode, high contrast) are coming soon.
                  </p>
                </div>
              </div>
            )}

            {/* Privacy */}
            {section === "privacy" && (
              <div>
                <p className="text-[11px] font-semibold text-[#6b6b8a] uppercase tracking-wider pt-3 pb-1">Privacy</p>

                <Row label="Usage analytics" hint="Help improve Quill AI by sharing anonymous usage data">
                  <Toggle on={settings.analyticsEnabled} onChange={(v) => update("analyticsEnabled", v)} />
                </Row>

                <Row label="Chat history" hint="Save conversations to your account for later access">
                  <Toggle on={true} onChange={() => {}} />
                </Row>

                <Row label="Training data" hint="Allow your conversations to improve future models">
                  <Toggle on={false} onChange={() => {}} />
                </Row>

                <div className="mt-4 p-3 rounded-xl bg-[#111118] border border-[#1e1e2e] space-y-1.5">
                  <p className="text-xs font-medium text-[#a8a8c0]">Data & Privacy</p>
                  <p className="text-xs text-[#6b6b8a]">
                    Your conversations are encrypted and stored securely. We never sell your data.
                  </p>
                  <button className="text-xs text-[#7c6af7] hover:text-[#a78bfa] transition-colors">
                    Download your data
                  </button>
                </div>
              </div>
            )}

            {/* Account */}
            {section === "account" && (
              <div>
                <p className="text-[11px] font-semibold text-[#6b6b8a] uppercase tracking-wider pt-3 pb-1">Account</p>

                <div className="flex items-center gap-3 py-3.5 border-b border-[#1a1a28]">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#a78bfa] to-[#60a5fa] flex items-center justify-center text-sm font-bold text-white shrink-0">
                    U
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#e8e8f0]">User</p>
                    <p className="text-xs text-[#6b6b8a]">user@example.com</p>
                  </div>
                </div>

                <Row label="Current plan" hint="Your active subscription tier">
                  <span className="px-2.5 py-1 rounded-full bg-[#1e1e2e] text-xs font-medium text-[#a8a8c0]">
                    Free
                  </span>
                </Row>

                <div className="mt-3 p-4 rounded-xl border border-[#7c6af730] bg-[rgba(124,106,247,0.05)]">
                  <p className="text-sm font-semibold text-[#e8e8f0]">Upgrade to Pro</p>
                  <p className="text-xs text-[#6b6b8a] mt-1 mb-3">
                    Unlimited messages, priority access to all models, and advanced features.
                  </p>
                  <button className="px-4 py-2 rounded-xl bg-[#7c6af7] hover:bg-[#6b58e8] text-white text-xs font-medium transition-all">
                    View plans
                  </button>
                </div>

                <div className="pt-4 flex flex-col gap-1">
                  <button className="text-xs text-[#6b6b8a] hover:text-[#a8a8c0] transition-colors text-left py-1">
                    Sign out
                  </button>
                  <button className="text-xs text-[#f87171] hover:text-[#fca5a5] transition-colors text-left py-1">
                    Delete account
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[#1e1e2e] shrink-0">
          <span className="text-[11px] text-[#6b6b8a]">Quill AI v1.0.0</span>
          <button
            onClick={handleSave}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              saved
                ? "bg-[#34d399] text-white"
                : "bg-[#7c6af7] hover:bg-[#6b58e8] text-white"
            }`}
          >
            {saved ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Saved
              </>
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
