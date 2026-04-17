export type McpRegistryEntry = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: "development" | "productivity" | "communication" | "data";
  authType: "none" | "bearer" | "basic";
  trust: "official" | "community";
  tags: string[];
};

// Curated seed list for Registry V1.
export const MCP_REGISTRY: McpRegistryEntry[] = [
  {
    id: "github-official",
    name: "GitHub MCP",
    url: "https://mcp.github.com",
    description: "Search repositories, issues, and pull requests.",
    category: "development",
    authType: "bearer",
    trust: "official",
    tags: ["github", "issues", "pull-requests", "code"],
  },
  {
    id: "slack-official",
    name: "Slack MCP",
    url: "https://mcp.slack.com",
    description: "Read channel context and post messages to Slack.",
    category: "communication",
    authType: "bearer",
    trust: "official",
    tags: ["slack", "chatops", "communication"],
  },
  {
    id: "filesystem-local",
    name: "Filesystem MCP",
    url: "http://localhost:8811",
    description: "Read and write local files through an MCP bridge.",
    category: "development",
    authType: "none",
    trust: "community",
    tags: ["filesystem", "local", "developer-tools"],
  },
  {
    id: "notion-community",
    name: "Notion MCP",
    url: "https://mcp.notion.so",
    description: "Browse and update Notion pages and databases.",
    category: "productivity",
    authType: "bearer",
    trust: "community",
    tags: ["notion", "docs", "knowledge-base"],
  },
  {
    id: "postgres-local",
    name: "Postgres MCP",
    url: "http://localhost:8812",
    description: "Query and inspect a Postgres database safely.",
    category: "data",
    authType: "basic",
    trust: "community",
    tags: ["postgres", "sql", "database"],
  },
  {
    id: "linear-community",
    name: "Linear MCP",
    url: "https://mcp.linear.app",
    description: "Create and triage Linear issues and cycles.",
    category: "productivity",
    authType: "bearer",
    trust: "community",
    tags: ["linear", "planning", "issues"],
  },
];

function containsQuery(entry: McpRegistryEntry, q: string): boolean {
  const haystack = [
    entry.name,
    entry.description,
    entry.url,
    entry.category,
    entry.authType,
    entry.trust,
    ...entry.tags,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(q.toLowerCase());
}

export function listRegistryEntries(args?: {
  q?: string;
  category?: McpRegistryEntry["category"] | "all";
  trust?: McpRegistryEntry["trust"] | "all";
}): McpRegistryEntry[] {
  const q = args?.q?.trim() ?? "";
  const category = args?.category ?? "all";
  const trust = args?.trust ?? "all";

  return MCP_REGISTRY.filter((entry) => {
    if (category !== "all" && entry.category !== category) return false;
    if (trust !== "all" && entry.trust !== trust) return false;
    if (q && !containsQuery(entry, q)) return false;
    return true;
  });
}
