// ─── Skills Registry ──────────────────────────────────────────────────────────
// Static catalog of all available skills. Each skill defines its metadata,
// category, whether it requires OAuth or API key config, and availability status.

export type SkillCategory = "productivity" | "search" | "code" | "communication" | "data";
export type SkillStatus = "available" | "coming-soon";
export type SkillConfigField = {
  key: string;
  label: string;
  type: "text" | "password" | "url";
  placeholder?: string;
  required?: boolean;
  helpText?: string;
};

export interface Skill {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  category: SkillCategory;
  status: SkillStatus;
  /** If true, skill is on by default for all users (no explicit install needed) */
  builtIn?: boolean;
  /** OAuth connector page — if set, a "Connect" button links here when not authenticated */
  oauthHref?: string;
  /** Configurable fields the user provides (e.g. API keys) */
  configFields?: SkillConfigField[];
  /** Hex or tailwind token for the accent icon color */
  color?: string;
  /** SVG path data for a simple icon (24x24 viewBox) */
  iconPath?: string;
}

export const SKILLS_REGISTRY: Skill[] = [
  {
    id: "web-search",
    name: "Web Search",
    description: "Search the web in real time during any conversation.",
    longDescription:
      "Quill can search the web on your behalf when you enable this skill. Useful for news, research, and up-to-date facts the model may not know.",
    category: "search",
    status: "available",
    builtIn: true,
    color: "text-blue-400",
  },
  {
    id: "code-execution",
    name: "Code Execution",
    description: "Run Python code in a secure sandbox and see live output.",
    longDescription:
      "Quill can execute Python (and other languages) in an isolated container. Enable E2B or Docker via environment variables.",
    category: "code",
    status: "available",
    builtIn: true,
    color: "text-green-400",
  },
  {
    id: "image-generation",
    name: "Image Generation",
    description: "Generate images from text prompts using AI models.",
    longDescription:
      "Quill can create images using providers like DALL-E or Stable Diffusion. Results appear inline in the conversation.",
    category: "code",
    status: "available",
    builtIn: true,
    color: "text-purple-400",
  },
  {
    id: "google-workspace",
    name: "Google Workspace",
    description: "Read and write your Google Docs, Drive files, and Calendar events.",
    longDescription:
      "Quill can list, search, create, and edit your Google Docs and Drive files. Calendar events are read-only. Requires a Google OAuth connection.",
    category: "productivity",
    status: "available",
    oauthHref: "/workspace",
    color: "text-red-400",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Browse issues, PRs, and repos. Create or comment on issues.",
    longDescription:
      "Quill can fetch GitHub issues and pull requests, search repositories, and create new issues. Requires a Personal Access Token.",
    category: "code",
    status: "coming-soon",
    configFields: [
      {
        key: "pat",
        label: "Personal Access Token",
        type: "password",
        placeholder: "ghp_…",
        required: true,
        helpText: "Needs repo and issues scopes.",
      },
    ],
    color: "text-gray-400",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Read and update Notion pages and databases.",
    longDescription:
      "Quill can query your Notion workspace, fetch page content, and append blocks. Requires an internal integration token.",
    category: "productivity",
    status: "coming-soon",
    configFields: [
      {
        key: "token",
        label: "Integration Token",
        type: "password",
        placeholder: "secret_…",
        required: true,
        helpText: "Create an internal integration at notion.so/my-integrations.",
      },
    ],
    color: "text-orange-400",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Send messages and read channel history.",
    longDescription:
      "Quill can post messages to Slack channels on your behalf and fetch recent history for context. Requires an incoming webhook or bot token.",
    category: "communication",
    status: "coming-soon",
    configFields: [
      {
        key: "webhookUrl",
        label: "Webhook URL",
        type: "url",
        placeholder: "https://hooks.slack.com/services/…",
        required: true,
      },
    ],
    color: "text-yellow-400",
  },
  {
    id: "linear",
    name: "Linear",
    description: "Create and query Linear issues and project cycles.",
    category: "productivity",
    status: "coming-soon",
    configFields: [
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        placeholder: "lin_api_…",
        required: true,
      },
    ],
    color: "text-indigo-400",
  },
];

export function getSkillById(id: string): Skill | undefined {
  return SKILLS_REGISTRY.find((s) => s.id === id);
}

export function getAvailableSkills(): Skill[] {
  return SKILLS_REGISTRY.filter((s) => s.status === "available");
}
