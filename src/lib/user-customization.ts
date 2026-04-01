export type UserPresetId =
  | "custom"
  | "saas-marketer"
  | "fullstack-engineer"
  | "founder-gtm"
  | "analyst-reporting"
  | "creative-copywriter";

export type UserInstructionProfile = {
  preset: UserPresetId;
  additionalInstructions: string;
};

export const DEFAULT_USER_PROFILE: UserInstructionProfile = {
  preset: "custom",
  additionalInstructions: "",
};

export const USER_PRESET_TEMPLATES: Record<UserPresetId, { label: string; instructions: string }> = {
  custom: {
    label: "Custom",
    instructions: "",
  },
  "saas-marketer": {
    label: "SaaS Marketer",
    instructions:
      "Prioritize conversion-focused messaging, clear value props, strong CTA hierarchy, and practical social-proof sections.",
  },
  "fullstack-engineer": {
    label: "Full-stack Engineer",
    instructions:
      "Prefer production-ready architecture, typed code, clear folder structures, and explicit run/build instructions.",
  },
  "founder-gtm": {
    label: "Founder GTM",
    instructions:
      "Optimize for speed and execution. Provide practical launch steps, messaging angles, and measurable next actions.",
  },
  "analyst-reporting": {
    label: "Analyst Reporting",
    instructions:
      "Use concise structured outputs with assumptions, key metrics, and decision-ready recommendations.",
  },
  "creative-copywriter": {
    label: "Creative Copywriter",
    instructions:
      "Use sharp, audience-aware copy with a distinct voice, compelling hooks, and persuasive but natural CTA language.",
  },
};

export function normalizeUserProfile(value: unknown): UserInstructionProfile {
  if (!value || typeof value !== "object") return DEFAULT_USER_PROFILE;

  const candidate = value as Partial<UserInstructionProfile>;
  const preset =
    candidate.preset === "custom" ||
    candidate.preset === "saas-marketer" ||
    candidate.preset === "fullstack-engineer" ||
    candidate.preset === "founder-gtm" ||
    candidate.preset === "analyst-reporting" ||
    candidate.preset === "creative-copywriter"
      ? candidate.preset
      : "custom";

  return {
    preset,
    additionalInstructions:
      typeof candidate.additionalInstructions === "string"
        ? candidate.additionalInstructions.slice(0, 2000)
        : "",
  };
}

export function buildUserCustomizationPrompt(profile: UserInstructionProfile): string | null {
  const presetInstructions = USER_PRESET_TEMPLATES[profile.preset]?.instructions ?? "";
  const additional = profile.additionalInstructions.trim();
  const hasCustom = Boolean(presetInstructions || additional);
  if (!hasCustom) return null;

  const lines: string[] = [
    "User customization profile (follow these unless they conflict with system safety rules or active Killer specialization):",
  ];

  if (profile.preset !== "custom") {
    lines.push(`Preset: ${USER_PRESET_TEMPLATES[profile.preset].label}`);
  }

  if (presetInstructions) {
    lines.push(`Preset instructions: ${presetInstructions}`);
  }

  if (additional) {
    lines.push(`Additional user instructions: ${additional}`);
  }

  return lines.join("\n");
}
