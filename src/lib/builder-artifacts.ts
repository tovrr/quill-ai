export type BuilderArtifactType = "page" | "react-app" | "nextjs-bundle" | "document";
export type BuilderTarget = "auto" | "page" | "react-app" | "nextjs-bundle";

export type BuilderLocks = {
  layout: boolean;
  colors: boolean;
  sectionOrder: boolean;
  copy: boolean;
};

export const DEFAULT_BUILDER_LOCKS: BuilderLocks = {
  layout: false,
  colors: false,
  sectionOrder: false,
  copy: false,
};

export type BuilderSessionContext = {
  lastArtifactType?: BuilderArtifactType;
  lastArtifactTitle?: string;
  recentRefinements?: string[];
};

type BuilderArtifactBase = {
  artifactVersion: 1;
  type: BuilderArtifactType;
  title?: string;
  metadata?: Record<string, unknown>;
};

export type PageArtifact = BuilderArtifactBase & {
  type: "page";
  payload: {
    html: string;
  };
};

export type DocumentArtifact = BuilderArtifactBase & {
  type: "document";
  payload: {
    markdown: string;
  };
};

export type FileBundleArtifact = BuilderArtifactBase & {
  type: "react-app" | "nextjs-bundle";
  payload: {
    files: Record<string, string>;
    entry?: string;
    dependencies?: string[];
  };
};

export type BuilderArtifact = PageArtifact | DocumentArtifact | FileBundleArtifact;

export type BundleReadiness = {
  inferredType: "react-app" | "nextjs-bundle";
  errors: string[];
  warnings: string[];
};

export type ArtifactQuality = {
  score: number;
  issues: string[];
  recommendations: string[];
};

function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function hasRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!hasRecord(value)) return false;
  return Object.values(value).every((entry) => typeof entry === "string");
}

function inferEntryFromFiles(files: Record<string, string>): string | undefined {
  const candidates = [
    "src/main.ts",
    "src/main.js",
    "src/main.tsx",
    "src/main.jsx",
    "src/index.ts",
    "src/index.js",
    "src/index.tsx",
    "src/index.jsx",
    "main.ts",
    "main.js",
    "main.tsx",
    "main.jsx",
    "index.ts",
    "index.js",
    "index.tsx",
    "index.jsx",
    "App.ts",
    "App.js",
    "App.tsx",
    "App.jsx",
  ];

  for (const path of candidates) {
    if (files[path]) return path;
  }

  return Object.keys(files).find((key) => /\.(tsx|ts|jsx|js)$/i.test(key));
}

function hasNextAppRouterFiles(files: Record<string, string>): boolean {
  const hasRootAppRouter = Boolean(files["app/layout.tsx"] && files["app/page.tsx"]);
  const hasSrcAppRouter = Boolean(files["src/app/layout.tsx"] && files["src/app/page.tsx"]);
  return hasRootAppRouter || hasSrcAppRouter;
}

function packageJsonLooksNextJs(pkgSource: string | undefined): boolean {
  if (!pkgSource) return false;
  const parsed = safeJsonParse(pkgSource);
  if (!hasRecord(parsed)) return false;

  const deps = hasRecord(parsed.dependencies) ? parsed.dependencies : {};
  const devDeps = hasRecord(parsed.devDependencies) ? parsed.devDependencies : {};
  const hasNextDep = typeof deps.next === "string" || typeof devDeps.next === "string";
  return hasNextDep;
}

function inferBundleTypeFromFiles(files: Record<string, string>): "react-app" | "nextjs-bundle" {
  if (hasNextAppRouterFiles(files)) return "nextjs-bundle";
  if (files["next.config.ts"] || files["next.config.js"] || files["next.config.mjs"]) return "nextjs-bundle";
  if (packageJsonLooksNextJs(files["package.json"])) return "nextjs-bundle";
  return "react-app";
}

export function analyzeBundleReadiness(
  type: "react-app" | "nextjs-bundle",
  files: Record<string, string>,
  entry?: string,
): BundleReadiness {
  const errors: string[] = [];
  const warnings: string[] = [];
  const inferredType = inferBundleTypeFromFiles(files);

  if (inferredType !== type) {
    warnings.push(`Bundle looks like ${inferredType} but artifact type is ${type}.`);
  }

  if (type === "react-app") {
    const resolvedEntry = entry ?? inferEntryFromFiles(files);
    if (!resolvedEntry) {
      errors.push("Missing React entry file (expected src/main.tsx, src/index.tsx, or App.tsx). ");
    }
    if (!files["index.html"]) {
      warnings.push("Missing index.html; runtime preview may still work, but export quality is lower.");
    }
    return { inferredType, errors, warnings };
  }

  const pkgSource = files["package.json"];
  if (!pkgSource) {
    errors.push("Missing package.json.");
  }

  if (!hasNextAppRouterFiles(files)) {
    errors.push("Missing App Router core files (app/layout.tsx + app/page.tsx, or src/app equivalents).");
  }

  if (!files["tsconfig.json"]) {
    warnings.push("Missing tsconfig.json.");
  }

  if (!files["next.config.ts"] && !files["next.config.js"] && !files["next.config.mjs"]) {
    warnings.push("Missing next.config file.");
  }

  if (!files["app/globals.css"] && !files["src/app/globals.css"]) {
    warnings.push("Missing app/globals.css (or src/app/globals.css).");
  }

  if (pkgSource) {
    const parsed = safeJsonParse(pkgSource);
    if (!hasRecord(parsed)) {
      errors.push("package.json is not valid JSON.");
    } else {
      const deps = hasRecord(parsed.dependencies) ? parsed.dependencies : {};
      const devDeps = hasRecord(parsed.devDependencies) ? parsed.devDependencies : {};
      if (typeof deps.next !== "string" && typeof devDeps.next !== "string") {
        errors.push("package.json missing Next.js dependency (next).");
      }
      if (typeof deps.react !== "string" && typeof devDeps.react !== "string") {
        errors.push("package.json missing react dependency.");
      }
      if (typeof deps["react-dom"] !== "string" && typeof devDeps["react-dom"] !== "string") {
        errors.push("package.json missing react-dom dependency.");
      }
    }
  }

  return { inferredType, errors, warnings };
}

function looksLikeFilePath(key: string): boolean {
  if (!key) return false;
  return /\.(tsx|ts|jsx|js|css|scss|json|md|html)$/i.test(key) && (key.includes("/") || key.includes("\\"));
}

function decodeJsonStringValue(rawValue: string): string {
  try {
    return JSON.parse(`"${rawValue}"`) as string;
  } catch {
    return rawValue
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\r/g, "\r")
      .replace(/\\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
}

function coerceLooseToArtifact(candidate: unknown): BuilderArtifact | null {
  if (!hasRecord(candidate)) return null;

  // Shape: { files: { ... }, entry?: ... }
  if (isStringRecord(candidate.files)) {
    const files = candidate.files;
    if (Object.keys(files).length === 0) return null;
    const inferredType = inferBundleTypeFromFiles(files);
    const entry = typeof candidate.entry === "string" ? candidate.entry : inferEntryFromFiles(files);

    return {
      artifactVersion: 1,
      type: inferredType,
      title: typeof candidate.title === "string" ? candidate.title : inferredType === "nextjs-bundle" ? "Next.js Bundle" : "React App",
      payload: {
        files,
        entry: inferredType === "react-app" ? entry : undefined,
      },
    };
  }

  // Shape: { "src/...tsx": "...", ... }
  const keys = Object.keys(candidate);
  if (keys.length > 0 && keys.every((key) => looksLikeFilePath(key)) && Object.values(candidate).every((v) => typeof v === "string")) {
    const files = candidate as Record<string, string>;
    const inferredType = inferBundleTypeFromFiles(files);
    return {
      artifactVersion: 1,
      type: inferredType,
      title: inferredType === "nextjs-bundle" ? "Next.js Bundle" : "React App",
      payload: {
        files,
        entry: inferredType === "react-app" ? inferEntryFromFiles(files) : undefined,
      },
    };
  }

  return null;
}

function salvageFileMapFromRawText(content: string): BuilderArtifact | null {
  const fileEntryRegex = /"([^"\n\r]+\.(?:tsx|ts|jsx|js|css|scss|json|md|html))"\s*:\s*"([\s\S]*?)"(?=\s*,\s*"[^"\n\r]+\.(?:tsx|ts|jsx|js|css|scss|json|md|html)"\s*:|\s*}\s*$|\s*$)/gi;
  const files: Record<string, string> = {};

  let match: RegExpExecArray | null = null;
  while ((match = fileEntryRegex.exec(content)) !== null) {
    const path = match[1]?.trim();
    const rawValue = match[2] ?? "";
    if (!path || !looksLikeFilePath(path)) continue;
    files[path] = decodeJsonStringValue(rawValue);
  }

  if (Object.keys(files).length === 0) return null;

  const inferredType = inferBundleTypeFromFiles(files);

  return {
    artifactVersion: 1,
    type: inferredType,
    title: inferredType === "nextjs-bundle" ? "Next.js Bundle" : "React App",
    payload: {
      files,
      entry: inferredType === "react-app" ? inferEntryFromFiles(files) : undefined,
    },
  };
}

function validateArtifact(candidate: unknown): BuilderArtifact | null {
  if (!hasRecord(candidate)) return null;
  if (candidate.artifactVersion !== 1) return null;

  const type = candidate.type;
  const payload = candidate.payload;
  if (type !== "page" && type !== "react-app" && type !== "nextjs-bundle" && type !== "document") {
    return null;
  }

  if (!hasRecord(payload)) return null;

  if (type === "page") {
    if (typeof payload.html !== "string" || !payload.html.trim()) return null;
    return candidate as BuilderArtifact;
  }

  if (type === "document") {
    if (typeof payload.markdown !== "string" || !payload.markdown.trim()) return null;
    return candidate as BuilderArtifact;
  }

  if (!isStringRecord(payload.files) || Object.keys(payload.files).length === 0) return null;
  if (payload.entry !== undefined && typeof payload.entry !== "string") return null;
  if (
    payload.dependencies !== undefined &&
    (!Array.isArray(payload.dependencies) || payload.dependencies.some((dep) => typeof dep !== "string"))
  ) {
    return null;
  }

  return candidate as BuilderArtifact;
}

function unwrapEnvelope(parsed: unknown): unknown {
  if (!hasRecord(parsed)) return parsed;
  if (hasRecord(parsed.artifact)) {
    // Accept envelope form:
    // {
    //   "artifactVersion": 1,
    //   "artifact": { "type": "nextjs-bundle", "payload": { ... } }
    // }
    // by preserving version metadata for downstream validation.
    if ((parsed.artifact as Record<string, unknown>).artifactVersion === undefined) {
      return {
        ...(parsed.artifact as Record<string, unknown>),
        artifactVersion: parsed.artifactVersion,
      };
    }
    return parsed.artifact;
  }
  return parsed;
}

function extractTaggedArtifactJson(content: string): string | null {
  const tagged = content.match(/<quill-artifact>\s*([\s\S]*?)\s*<\/quill-artifact>/i);
  if (tagged?.[1]) return tagged[1].trim();

  // Tolerate truncated outputs where the opening tag exists but closing tag is missing.
  const openTagIndex = content.search(/<quill-artifact>/i);
  if (openTagIndex >= 0) {
    return content.slice(openTagIndex).replace(/<quill-artifact>/i, "").trim();
  }

  return null;
}

function decodeLooseJsonString(input: string): string {
  return input
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function salvagePageArtifactFromRawText(content: string): BuilderArtifact | null {
  const hasArtifactHints =
    /<quill-artifact>/i.test(content) ||
    /"artifactVersion"\s*:/i.test(content) ||
    /"type"\s*:\s*"page"/i.test(content);

  if (!hasArtifactHints) return null;

  // Preferred path: recover the html string literal and decode escaped sequences.
  const htmlStringMatch = content.match(/"html"\s*:\s*"((?:\\.|[^"\\])*)"/i);
  const decodedHtml = htmlStringMatch?.[1] ? decodeLooseJsonString(htmlStringMatch[1]).trim() : "";

  let html = decodedHtml;
  if (!html) {
    // Fallback for partially malformed outputs: extract an inline document directly.
    const lower = content.toLowerCase();
    const doctypeStart = lower.indexOf("<!doctype html");
    const htmlStart = doctypeStart >= 0 ? doctypeStart : lower.indexOf("<html");
    if (htmlStart < 0) return null;

    const htmlEnd = lower.indexOf("</html>", htmlStart);
    if (htmlEnd < 0) return null;
    html = content.slice(htmlStart, htmlEnd + "</html>".length).trim();
  }

  if (!html || !/<html[\s\S]*<\/html>/i.test(html)) return null;

  const titleMatch = content.match(/"title"\s*:\s*"((?:\\.|[^"\\])*)"/i);
  const title = titleMatch?.[1] ? decodeLooseJsonString(titleMatch[1]).trim() : "Generated Page";

  return {
    artifactVersion: 1,
    type: "page",
    title,
    payload: {
      html,
    },
  };
}

function extractJsonFence(content: string): string | null {
  const fences = content.match(/```json\n([\s\S]*?)```/gi);
  if (!fences || fences.length === 0) return null;

  for (const fence of fences) {
    const body = fence.replace(/^```json\n/i, "").replace(/```$/i, "").trim();
    if (body.includes("artifactVersion") || body.includes("\"type\"")) {
      return body;
    }
  }
  return null;
}

export function parseBuilderArtifact(content: string): BuilderArtifact | null {
  if (!content.trim()) return null;

  const tagged = extractTaggedArtifactJson(content);
  if (tagged) {
    const parsed = unwrapEnvelope(safeJsonParse(tagged));
    const artifact = validateArtifact(parsed);
    if (artifact) return artifact;
  }

  const jsonFence = extractJsonFence(content);
  if (jsonFence) {
    const parsed = unwrapEnvelope(safeJsonParse(jsonFence));
    const artifact = validateArtifact(parsed);
    if (artifact) return artifact;
  }

  const direct = unwrapEnvelope(safeJsonParse(content.trim()));
  const validatedDirect = validateArtifact(direct);
  if (validatedDirect) return validatedDirect;

  const coercedDirect = coerceLooseToArtifact(direct);
  if (coercedDirect) return coercedDirect;

  const salvagedPage = salvagePageArtifactFromRawText(content);
  if (salvagedPage) return salvagedPage;

  // Last-resort salvage for partial file-map outputs that are not valid standalone JSON.
  return salvageFileMapFromRawText(content);
}

export function shouldAutoOpenCanvas(content: string): boolean {
  const artifact = parseBuilderArtifact(content);
  if (!artifact) return false;
  return artifact.type === "page";
}

export function analyzeArtifactQuality(artifact: BuilderArtifact): ArtifactQuality {
  if (artifact.type === "page") {
    const html = artifact.payload.html.toLowerCase();
    const issues: string[] = [];
    const recommendations: string[] = [];

    const hasHero = /<section[^>]*id=["'][^"']*hero|<h1/i.test(html);
    const hasPricing = /pricing/i.test(html);
    const hasTestimonials = /testimonial/i.test(html);
    const hasCta = /get started|start|book|contact|trial|signup|sign up/i.test(html);
    const hasViewport = /<meta[^>]*name=["']viewport["']/i.test(html);
    const hasMobileMediaQuery = /@media\s*\(max-width:\s*(768|767|640|600)px\)/i.test(html);
    const hasInlineStyles = /<style[\s\S]*?>[\s\S]*?<\/style>/i.test(html);
    const hasSectionMarkers = /data-quill-section=["'](hero|features|pricing|testimonials|cta)["']/i.test(html);

    if (!hasHero) issues.push("Missing clear hero section or H1 heading.");
    if (!hasCta) issues.push("Primary call-to-action is weak or missing.");
    if (!hasViewport) issues.push("Missing mobile viewport meta tag.");
    if (!hasInlineStyles) issues.push("No inline CSS detected; style reliability may be poor.");

    if (!hasPricing) recommendations.push("Add a pricing section for better conversion structure.");
    if (!hasTestimonials) recommendations.push("Add testimonials or social proof.");
    if (!hasMobileMediaQuery) recommendations.push("Add mobile media queries for small screens.");
    if (!hasSectionMarkers) recommendations.push("Add data-quill-section markers for precise section-level regeneration.");

    const score = Math.max(0, Math.min(100, 100 - issues.length * 18 - recommendations.length * 6));
    return { score, issues, recommendations };
  }

  if (artifact.type === "react-app" || artifact.type === "nextjs-bundle") {
    const readiness = analyzeBundleReadiness(artifact.type, artifact.payload.files, artifact.payload.entry);
    const issues = [...readiness.errors];
    const recommendations = [...readiness.warnings];
    const score = Math.max(0, Math.min(100, 100 - issues.length * 20 - recommendations.length * 8));
    return { score, issues, recommendations };
  }

  if (artifact.type !== "document") {
    return { score: 0, issues: ["Unsupported artifact type for quality analysis."], recommendations: [] };
  }

  const markdown = artifact.payload.markdown.trim();
  const hasHeadings = /^#{1,3}\s+/m.test(markdown);
  const hasList = /^(-|\*|\d+\.)\s+/m.test(markdown);
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (markdown.length < 180) issues.push("Document content is very short.");
  if (!hasHeadings) recommendations.push("Add headings to improve scanability.");
  if (!hasList) recommendations.push("Add bullet or numbered lists for structure.");

  const score = Math.max(0, Math.min(100, 100 - issues.length * 20 - recommendations.length * 8));
  return { score, issues, recommendations };
}
