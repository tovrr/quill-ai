"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  analyzeArtifactQuality,
  analyzeBundleReadiness,
  parseBuilderArtifact,
  type FileBundleArtifact,
} from "@/lib/builder/artifacts";
import { isCanvasRenderableContent, isHTMLContent } from "@/components/agent/canvas-utils";
import { exportArtifactAsZip, flattenArtifactFiles } from "@/lib/export/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractHTML(content: string): string {
  const trimmed = content.trim();

  const fullFenceMatch = trimmed.match(/^```(?:html)?\n([\s\S]*?)```\s*$/i);
  if (fullFenceMatch) return fullFenceMatch[1].trim();

  const htmlFenceMatch = trimmed.match(/```html\n([\s\S]*?)```/i);
  if (htmlFenceMatch) return htmlFenceMatch[1].trim();

  const htmlDocumentMatch = trimmed.match(/<!doctype html[\s\S]*?<\/html>/i);
  if (htmlDocumentMatch) return htmlDocumentMatch[0].trim();

  const htmlBlockMatch = trimmed.match(/<html[\s\S]*?<\/html>/i);
  if (htmlBlockMatch) return htmlBlockMatch[0].trim();

  return trimmed;
}

function renderInlineCanvas(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[#1a1a2e]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded bg-[#f0f0ff] text-[#5b4dd4] text-[12px] font-mono border border-[#ddd9ff]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function MarkdownDocument({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <div key={i} className="my-4 rounded-xl overflow-hidden border border-[#e0deff]">
          {lang && (
            <div className="px-3 py-1.5 bg-[#f5f3ff] border-b border-[#e0deff] text-[10px] text-[#EF4444] font-mono uppercase tracking-wide">
              {lang}
            </div>
          )}
          <pre className="p-4 bg-[#faf9ff] overflow-x-auto text-[12px] font-mono text-[#3a3a60] leading-relaxed">
            <code>{codeLines.join("\n")}</code>
          </pre>
        </div>
      );
      i++;
      continue;
    }

    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-2xl font-bold text-[#1a1a2e] mt-6 mb-2 leading-tight">
          {renderInlineCanvas(line.slice(2))}
        </h1>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-lg font-bold text-[#1a1a2e] mt-5 mb-1.5">
          {renderInlineCanvas(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-base font-semibold text-[#2a2a4e] mt-4 mb-1">
          {renderInlineCanvas(line.slice(4))}
        </h3>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={i} className="flex gap-2.5 pl-2 py-0.5">
          <span className="text-[#EF4444] mt-1 shrink-0 text-xs">●</span>
          <span className="text-[#3a3a60] text-sm leading-relaxed">
            {renderInlineCanvas(line.slice(2))}
          </span>
        </div>
      );
    } else if (/^\d+\. /.test(line)) {
      const match = line.match(/^(\d+)\. (.*)/);
      if (match) {
        elements.push(
          <div key={i} className="flex gap-2.5 pl-2 py-0.5">
            <span className="text-[#EF4444] shrink-0 tabular-nums text-sm font-medium">{match[1]}.</span>
            <span className="text-[#3a3a60] text-sm leading-relaxed">
              {renderInlineCanvas(match[2])}
            </span>
          </div>
        );
      }
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={i} className="pl-4 border-l-4 border-[#EF4444] text-[#7A7F88] italic my-2 py-1">
          {renderInlineCanvas(line.slice(2))}
        </blockquote>
      );
    } else if (line === "" || line === "---") {
      elements.push(<div key={i} className="h-3" />);
    } else {
      elements.push(
        <p key={i} className="text-[#3a3a60] text-sm leading-relaxed">
          {renderInlineCanvas(line)}
        </p>
      );
    }

    i++;
  }

  return <div className="space-y-1">{elements}</div>;
}

// ---------------------------------------------------------------------------
// Main CanvasPanel
// ---------------------------------------------------------------------------

interface CanvasPanelProps {
  content: string;
  onClose: () => void;
  isWorking?: boolean;
}

type Tab = "preview" | "code";

function getBundleEntry(files: Record<string, string>, preferred?: string): string | null {
  if (preferred && files[preferred]) return preferred;

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

  const firstSource = Object.keys(files).find((k) => /(^|\/)(main|index|app)\.(tsx|ts|jsx|js)$/i.test(k));
  if (firstSource) return firstSource;

  const fallbackSource = Object.keys(files).find((k) => /\.(tsx|ts|jsx|js)$/i.test(k));
  return fallbackSource ?? null;
}

function toEmbeddedJson(value: unknown): string {
  return JSON.stringify(value).replace(/<\//g, "<\\/");
}

function createReactRuntimeSrcDoc(files: Record<string, string>, entry?: string): string {
  const resolvedEntry = getBundleEntry(files, entry);
  const filesJson = toEmbeddedJson(files);
  const entryJson = toEmbeddedJson(resolvedEntry ?? "");

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React Preview</title>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script type="importmap">
      {
        "imports": {
          "react": "https://esm.sh/react@19",
          "react-dom": "https://esm.sh/react-dom@19",
          "react-dom/client": "https://esm.sh/react-dom@19/client",
          "react/jsx-runtime": "https://esm.sh/react@19/jsx-runtime"
        }
      }
    </script>
    <style>
      html, body, #root { height: 100%; margin: 0; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; background: #0b0b13; color: #e7e7f0; }
      .preview-error { padding: 12px 14px; margin: 10px; border-radius: 10px; border: 1px solid rgba(239,68,68,0.4); background: rgba(239,68,68,0.1); color: #f7b0b0; font-size: 12px; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <div id="preview-error" class="preview-error" style="display:none"></div>
    <script type="module">
      const files = ${filesJson};
      const entry = ${entryJson};

      const errorEl = document.getElementById("preview-error");
      const showError = (message) => {
        if (!errorEl) return;
        errorEl.style.display = "block";
        errorEl.textContent = message;
      };

      window.addEventListener("error", (event) => {
        showError("Runtime error: " + (event.error?.message || event.message || "Unknown error"));
      });

      const moduleUrlCache = new Map();

      const dirname = (path) => {
        const idx = path.lastIndexOf("/");
        return idx >= 0 ? path.slice(0, idx) : "";
      };

      const normalize = (path) => path
        .replace(/\\\\/g, "/")
        .replace(/\/\.\//g, "/")
        .replace(/^\.\//, "")
        .replace(/\/+/g, "/");

      const resolveRelative = (fromPath, request) => {
        if (!request.startsWith(".")) return request;
        const fromDir = dirname(fromPath).split("/").filter(Boolean);
        const reqParts = request.split("/");

        for (const part of reqParts) {
          if (!part || part === ".") continue;
          if (part === "..") fromDir.pop();
          else fromDir.push(part);
        }

        return normalize(fromDir.join("/"));
      };

      const resolveFile = (fromPath, request) => {
        const resolved = resolveRelative(fromPath, request);
        if (!request.startsWith(".")) return request;

        if (files[resolved]) return resolved;

        const extensions = [".tsx", ".ts", ".jsx", ".js"];
        for (const ext of extensions) {
          if (files[resolved + ext]) return resolved + ext;
        }

        const indexExtensions = ["/index.tsx", "/index.ts", "/index.jsx", "/index.js"];
        for (const suffix of indexExtensions) {
          if (files[resolved + suffix]) return resolved + suffix;
        }

        return resolved;
      };

      const rewriteImports = (code, fromPath) => {
        const rewriteSpecifier = (spec) => {
          if (!spec.startsWith(".")) return spec;
          const resolved = resolveFile(fromPath, spec);
          return toModuleUrl(resolved);
        };

        code = code.replace(/(import\\s+[^\"']*?from\\s*[\"'])([^\"']+)([\"'])/g, (_, a, spec, c) => {
          return a + rewriteSpecifier(spec) + c;
        });

        code = code.replace(/(export\\s+[^\"']*?from\\s*[\"'])([^\"']+)([\"'])/g, (_, a, spec, c) => {
          return a + rewriteSpecifier(spec) + c;
        });

        code = code.replace(/(import\\(\\s*[\"'])([^\"']+)([\"']\\s*\\))/g, (_, a, spec, c) => {
          return a + rewriteSpecifier(spec) + c;
        });

        return code;
      };

      const toModuleUrl = (filePath) => {
        if (moduleUrlCache.has(filePath)) return moduleUrlCache.get(filePath);

        const source = files[filePath];
        if (typeof source !== "string") {
          throw new Error("Missing module in artifact files: " + filePath);
        }

        const transformed = Babel.transform(source, {
          sourceType: "module",
          presets: ["typescript", "react"],
          filename: filePath,
        }).code;

        const rewritten = rewriteImports(transformed, filePath);
        const blob = new Blob([rewritten], { type: "text/javascript" });
        const url = URL.createObjectURL(blob);
        moduleUrlCache.set(filePath, url);
        return url;
      };

      if (!entry) {
        showError("No entry file found for React preview.");
      } else {
        try {
          const entryUrl = toModuleUrl(entry);
          await import(entryUrl);
        } catch (error) {
          showError("Preview failed: " + (error instanceof Error ? error.message : String(error)));
        }
      }
    </script>
  </body>
</html>`;
}

function FileBundlePreview({
  files,
  entry,
  type,
}: {
  files: Record<string, string>;
  entry?: string;
  type: "react-app" | "nextjs-bundle";
}) {
  const paths = Object.keys(files).sort();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const defaultPath = entry && files[entry] ? entry : paths[0] ?? null;
  const activePath = selectedPath && files[selectedPath] ? selectedPath : defaultPath;
  const activeCode = activePath ? files[activePath] : "";

  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-[220px_1fr] bg-[#0d0d15]">
      <div className="border-b md:border-b-0 md:border-r border-quill-border overflow-auto max-h-45 md:max-h-none">
        <div className="px-3 py-2 border-b border-quill-border text-[11px] font-semibold uppercase tracking-wide text-[#8f90aa]">
          {type === "react-app" ? "React app files" : "Next.js bundle files"}
        </div>
        <div className="p-2 space-y-1">
          {paths.map((path) => (
            <button
              key={path}
              type="button"
              onClick={() => setSelectedPath(path)}
              className={`px-2 py-1 rounded text-[12px] font-mono truncate ${
                path === activePath ? "bg-quill-border text-quill-text" : "text-[#9b9bb7]"
              }`}
              title={path}
            >
              {path}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-auto min-h-0">
        <pre className="p-5 text-[12px] font-mono text-[#C1C7D0] leading-relaxed whitespace-pre-wrap break-all">
          {activeCode}
        </pre>
      </div>
    </div>
  );
}

function createNextJsSetupScript(files: Record<string, string>): string {
  const escaped = JSON.stringify(files, null, 2).replace(/<\//g, "<\\/");

  return [
    "$ErrorActionPreference = \"Stop\"",
    "$Target = if ($args.Length -gt 0) { $args[0] } else { \"./quill-nextjs-app\" }",
    "New-Item -ItemType Directory -Path $Target -Force | Out-Null",
    "$json = @'",
    escaped,
    "'@",
    "$files = $json | ConvertFrom-Json -AsHashtable",
    "foreach ($path in $files.Keys) {",
    "  $fullPath = Join-Path $Target $path",
    "  $dir = Split-Path $fullPath -Parent",
    "  if ($dir) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }",
    "  Set-Content -Path $fullPath -Value $files[$path] -Encoding UTF8",
    "}",
    "Write-Host \"Next.js bundle files written to $Target\"",
    "Push-Location $Target",
    "try {",
    "  npm install",
    "  npm run build",
    "  Write-Host \"Bundle validated. Run: npm run dev\"",
    "} finally {",
    "  Pop-Location",
    "}",
  ].join("\n");
}

function applyMobilePreviewGuardrails(html: string): string {
  if (!html.trim()) return html;

  const guardrails = `<style id="quill-mobile-guardrails">
@media (max-width: 768px) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  html, body { overflow-x: hidden !important; }
  img, svg, canvas, video { max-width: 100% !important; height: auto !important; }
}
</style>`;

  const onePageLinkGuard = `<script id="quill-onepage-link-guard">
(function () {
  const isBypassHref = (href) => {
    const value = (href || "").trim();
    return (
      value.length === 0 ||
      value.startsWith("#") ||
      value.startsWith("javascript:") ||
      value.startsWith("mailto:") ||
      value.startsWith("tel:")
    );
  };

  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest("a");
    if (!anchor) return;

    const href = anchor.getAttribute("href") || "";
    if (isBypassHref(href)) return;

    if (/^https?:\/\//i.test(href)) {
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
      return;
    }

    event.preventDefault();

    const hashIndex = href.indexOf("#");
    if (hashIndex >= 0) {
      const rawId = href.slice(hashIndex + 1).trim();
      if (rawId) {
        const decodedId = decodeURIComponent(rawId);
        const el = document.getElementById(decodedId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          history.replaceState(null, "", "#" + encodeURIComponent(decodedId));
        }
      }
    }
  }, true);
})();
</script>`;

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${guardrails}${onePageLinkGuard}</head>`);
  }

  return `${guardrails}${onePageLinkGuard}${html}`;
}

export function CanvasPanel({ content, onClose, isWorking = false }: CanvasPanelProps) {
  const [preferredTab, setPreferredTab] = useState<Tab>("preview");
  const [copied, setCopied] = useState(false);
  const streamContainerRef = useRef<HTMLDivElement>(null);
  const [bundleValidation, setBundleValidation] = useState<{
    running: boolean;
    ok: boolean | null;
    phase?: string;
    output?: string;
  }>({ running: false, ok: null });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // When the content changes and resolves to a react-app artifact, POST the
  // files to /api/preview and load the returned HTML via a blob: URL.  Blob-URL
  // documents are not subject to the parent page's CSP, so Babel + esm.sh work.
  useEffect(() => {
    const localArtifact = parseBuilderArtifact(content);
    const bundle =
      localArtifact && localArtifact.type === "react-app" ? localArtifact : null;

    if (!bundle) return;

    let cancelled = false;

    fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: bundle.payload.files,
        entry: bundle.payload.entry,
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("Preview generation failed");
        return r.text();
      })
      .then((html) => {
        if (cancelled) return;
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
        previewUrlRef.current = blobUrl;
        setPreviewUrl(blobUrl);
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl(null);
      })

    return () => {
      cancelled = true;
    };
  }, [content]);

  // Revoke blob URL on unmount to prevent memory leaks.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const artifact = parseBuilderArtifact(content);
  const hasArtifactEnvelope = /<quill-artifact>/i.test(content) || /```json\n[\s\S]*artifactVersion/i.test(content);
  const artifactParseFailed = !isWorking && hasArtifactEnvelope && !artifact;
  const isArtifact = Boolean(artifact);
  const artifactType = artifact?.type ?? (isHTMLContent(content) ? "page" : "document");

  const isHTML = artifactType === "page";
  const htmlSrc = isArtifact
    ? artifact?.type === "page"
      ? artifact.payload.html
      : ""
    : isHTML
    ? extractHTML(content)
    : "";
  const htmlPreviewSrc = isHTML ? applyMobilePreviewGuardrails(htmlSrc) : "";

  const markdownSrc = isArtifact
    ? artifact?.type === "document"
      ? artifact.payload.markdown
      : ""
    : !isHTML
    ? content
    : "";

  const fileBundle: FileBundleArtifact | null =
    artifact && (artifact.type === "react-app" || artifact.type === "nextjs-bundle") ? artifact : null;
  const artifactQuality = artifact ? analyzeArtifactQuality(artifact) : null;
  const bundleReadiness = fileBundle
    ? analyzeBundleReadiness(fileBundle.type, fileBundle.payload.files, fileBundle.payload.entry)
    : null;
  const isReactApp = fileBundle?.type === "react-app";
  // Loading is implicit: react-app but no blob URL yet = fetch in progress.
  const canRunReactPreview = isReactApp && Boolean(previewUrl);
  const previewLoading = isReactApp && !previewUrl;
  const hasPreview = isHTML || (fileBundle?.type === "react-app" && canRunReactPreview);
  const effectiveTab: Tab = isWorking || !hasPreview ? "code" : preferredTab;
  const showRawStream = isWorking && !isHTML && !fileBundle;

  useEffect(() => {
    if (!isWorking || effectiveTab !== "code") return;
    const el = streamContainerRef.current;
    if (!el) return;

    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [content, isWorking, effectiveTab]);

  const copyText = isArtifact
    ? JSON.stringify({ artifactVersion: 1, artifact }, null, 2)
    : isHTML
    ? htmlSrc
    : content;

  const downloadText = isArtifact
    ? JSON.stringify({ artifactVersion: 1, artifact }, null, 2)
    : isHTML
    ? htmlSrc
    : content;

  const downloadMime = isArtifact ? "application/json" : isHTML ? "text/html" : "text/markdown";
  const downloadExt = isArtifact ? "json" : isHTML ? "html" : "md";
  const artifactLabel = artifactType === "react-app" ? "react app" : artifactType === "nextjs-bundle" ? "next.js bundle" : artifactType;
  const qualityTone = artifactQuality
    ? artifactQuality.score >= 80
      ? { label: "Ready", className: "text-[#9be7b5]" }
      : artifactQuality.score >= 60
        ? { label: "Needs review", className: "text-[#fcd48f]" }
        : { label: "Needs work", className: "text-[#f7b0b0]" }
    : null;

  const handleCopy = () => {
    navigator.clipboard.writeText(copyText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const blob = new Blob([downloadText], { type: downloadMime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quill-${artifactType}.${downloadExt}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSetupScript = () => {
    if (!fileBundle || fileBundle.type !== "nextjs-bundle") return;
    const script = createNextJsSetupScript(fileBundle.payload.files);
    const blob = new Blob([script], { type: "text/x-powershell" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "quill-nextjs-setup.ps1";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleValidateBundle = async () => {
    if (!fileBundle || fileBundle.type !== "nextjs-bundle") return;

    setBundleValidation({ running: true, ok: null, phase: "starting" });
    try {
      const response = await fetch("/api/validate-bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: fileBundle.type,
          files: fileBundle.payload.files,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; phase?: string; output?: string; error?: string }
        | null;

      if (!response.ok) {
        setBundleValidation({
          running: false,
          ok: false,
          phase: data?.phase ?? "request",
          output: data?.error ?? "Validation request failed.",
        });
        return;
      }

      setBundleValidation({
        running: false,
        ok: Boolean(data?.ok),
        phase: data?.phase,
        output: data?.output,
      });
    } catch (error) {
      setBundleValidation({
        running: false,
        ok: false,
        phase: "request",
        output: error instanceof Error ? error.message : "Validation failed.",
      });
    }
  };

  const handleExportAsZip = async () => {
    if (!artifact) return;

    const files = flattenArtifactFiles(artifact.payload);
    if (Object.keys(files).length === 0) return;

    try {
      await exportArtifactAsZip({
        artifactType: artifact.type,
        artifactTitle: artifact.title ?? "artifact",
        files,
        onProgress: (status) => console.log("[export]", status),
        onError: (error) => {
          console.error("[export] Error:", error);
          alert(`Export failed: ${error}`);
        },
      });
    } catch (error) {
      console.error("[export] Export failed:", error);
    }
  };

  const handleOpenInTab = () => {
    const blob = new Blob([htmlSrc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const dark = isHTML || artifactType === "react-app" || artifactType === "nextjs-bundle";

  return (
    <div
      className="flex flex-col h-full w-full md:w-130"
      style={{
        borderLeft: "1px solid #272B33",
        background: dark ? "#0E1015" : "#fafafe",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{
          borderBottom: `1px solid ${dark ? "#272B33" : "#e8e6ff"}`,
          background: dark ? "#0d0d15" : "#fff",
        }}
      >
        {/* Left: icon + title + tabs */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-linear-to-br from-quill-accent to-quill-accent-2 flex items-center justify-center shrink-0">
              {isHTML ? (
                <CodeBracketIcon className="h-2.5 w-2.5 text-white" aria-hidden="true" />
              ) : (
                <DocumentTextIcon className="h-2.5 w-2.5 text-white" aria-hidden="true" />
              )}
            </div>
            <span className={`text-sm font-semibold ${dark ? "text-quill-text" : "text-[#1a1a2e]"}`}>
              Canvas
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${dark ? "bg-quill-border text-quill-accent" : "bg-[#f0f0ff] text-quill-accent"}`}>
              {artifactLabel}
            </span>
            {isWorking && (
              <span className="text-[11px] text-[#fcd48f]">Generating...</span>
            )}
            {qualityTone && (
              <span className={`hidden md:inline text-[11px] ${qualityTone.className}`}>
                {qualityTone.label}
              </span>
            )}
          </div>

          {/* Preview / Code tabs */}
          {(isHTML || fileBundle?.type === "react-app") && content && (
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-quill-surface border border-quill-border">
              {(isHTML || (fileBundle?.type === "react-app" && canRunReactPreview)) && (
                <button
                  onClick={() => setPreferredTab("preview")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    effectiveTab === "preview" ? "bg-quill-accent text-white" : "text-quill-muted hover:text-[#A1A7B0]"
                  }`}
                >
                  Preview
                </button>
              )}
              <button
                onClick={() => setPreferredTab("code")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    effectiveTab === "code" ? "bg-quill-accent text-white" : "text-quill-muted hover:text-[#A1A7B0]"
                }`}
              >
                Code
              </button>
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-0.5">
          {/* Open in new tab — HTML only */}
          {isHTML && content && (
            <button
              onClick={handleOpenInTab}
              title="Open in new tab"
              className="p-1.5 rounded-lg text-quill-muted hover:text-quill-text hover:bg-quill-border transition-all"
            >
              <ArrowTopRightOnSquareIcon className="h-3.25 w-3.25" aria-hidden="true" />
            </button>
          )}

          {/* Copy */}
          <button
            onClick={handleCopy}
            disabled={!content}
            title="Copy source"
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all disabled:opacity-40 ${
              dark
                ? "text-quill-muted hover:text-quill-text hover:bg-quill-border"
                : "text-[#7A7F88] hover:bg-[#f0f0ff] hover:text-[#EF4444]"
            }`}
          >
            {copied ? (
              <CheckIcon className="h-3 w-3" aria-hidden="true" />
            ) : (
              <DocumentTextIcon className="h-3 w-3" aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            disabled={!content}
            title={`Download .${downloadExt}`}
            className={`p-1.5 rounded-lg transition-all disabled:opacity-40 ${
              dark
                ? "text-quill-muted hover:text-quill-text hover:bg-quill-border"
                : "text-[#7A7F88] hover:bg-[#f0f0ff] hover:text-[#EF4444]"
            }`}
          >
            <ArrowDownTrayIcon className="h-3.25 w-3.25" aria-hidden="true" />
          </button>

          {/* Export as ZIP — For bundled artifacts */}
          {fileBundle && (
            <button
              onClick={handleExportAsZip}
              disabled={!content}
              title="Export files as ZIP"
              className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all disabled:opacity-40 ${
                dark
                  ? "text-quill-muted hover:text-quill-text hover:bg-quill-border"
                  : "text-[#7A7F88] hover:bg-[#f0f0ff] hover:text-[#EF4444]"
              }`}
            >
              Export ZIP
            </button>
          )}

          {fileBundle?.type === "nextjs-bundle" && (
            <button
              onClick={handleDownloadSetupScript}
              title="Download setup script"
              className="px-2 py-1.5 rounded-lg text-[11px] font-medium text-quill-muted hover:text-quill-text hover:bg-quill-border transition-all"
            >
              Export PS
            </button>
          )}

          {fileBundle?.type === "nextjs-bundle" && (
            <button
              onClick={handleValidateBundle}
              disabled={bundleValidation.running}
              title="Validate bundle locally"
              className="px-2 py-1.5 rounded-lg text-[11px] font-medium text-quill-muted hover:text-quill-text hover:bg-quill-border transition-all disabled:opacity-40"
            >
              {bundleValidation.running ? "Validating..." : "Validate"}
            </button>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            title="Close canvas"
            className={`p-1.5 rounded-lg transition-all ${
              dark
                ? "text-quill-muted hover:text-quill-text hover:bg-quill-border"
                : "text-[#8E949E] hover:bg-[#f0f0ff] hover:text-[#7A7F88]"
            }`}
          >
            <XMarkIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {!content ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${dark ? "bg-quill-surface" : "bg-[#f0f0ff]"}`}>
              <CodeBracketIcon className="h-5.5 w-5.5 text-[#EF4444]" aria-hidden="true" />
            </div>
            <div>
              <p className={`text-sm font-medium ${dark ? "text-quill-text" : "text-[#2a2a4e]"}`}>
                Canvas is empty
              </p>
              <p className={`text-xs mt-1 max-w-55 ${dark ? "text-quill-muted" : "text-[#8E949E]"}`}>
                Ask Quill to build a landing page, UI component, or write a document to see it rendered here.
              </p>
            </div>
          </div>
        ) : artifactParseFailed ? (
          <div className="h-full overflow-y-auto bg-[#0d0d15]">
            <div className="p-5 space-y-3">
              <div className="rounded-xl border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] p-3">
                <p className="text-sm font-semibold text-[#f7b0b0]">Builder artifact could not be parsed</p>
                <p className="text-xs text-[#d2d2e6] mt-1">
                  Ask Quill to re-send the response as a valid artifact block wrapped in &lt;quill-artifact&gt; with artifactVersion=1.
                </p>
              </div>

              <div className="rounded-xl border border-quill-border bg-[#11111a]">
                <div className="px-3 py-2 border-b border-quill-border text-[11px] font-semibold uppercase tracking-wide text-[#8f90aa]">
                  Raw response
                </div>
                <pre className="p-4 text-[12px] font-mono text-[#C1C7D0] leading-relaxed whitespace-pre-wrap break-all max-h-120 overflow-auto">
                  {content}
                </pre>
              </div>
            </div>
          </div>
        ) : isHTML ? (
          effectiveTab === "preview" ? (
            /* Live iframe */
            <iframe
              key={htmlPreviewSrc}
              srcDoc={htmlPreviewSrc}
              sandbox="allow-scripts allow-forms allow-popups"
              className="w-full h-full border-0"
              title="Page preview"
            />
          ) : (
            /* Code view */
            <div ref={streamContainerRef} className="h-full overflow-auto bg-[#0d0d15]">
              <pre className="p-6 text-[12px] font-mono text-[#C1C7D0] leading-relaxed whitespace-pre-wrap break-all">
                {htmlSrc}
              </pre>
            </div>
          )
        ) : fileBundle?.type === "react-app" ? (
          effectiveTab === "preview" ? (
            previewUrl ? (
              <iframe
                key={previewUrl}
                src={previewUrl}
                sandbox="allow-scripts allow-forms allow-popups"
                className="w-full h-full border-0 bg-[#0d0d15]"
                title="React app preview"
              />
            ) : (
              /* Loading state while the server generates the preview blob */
              <div className="flex items-center justify-center h-full gap-3 text-[#9b9bb7]">
                <ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span className="text-sm">Building preview…</span>
              </div>
            )
          ) : (
            <FileBundlePreview files={fileBundle.payload.files} entry={fileBundle.payload.entry} type={fileBundle.type} />
          )
        ) : fileBundle ? (
          <div className="h-full flex flex-col">
            {fileBundle.type === "nextjs-bundle" && bundleReadiness && (
              <details className="mx-4 mt-4 rounded-xl border border-quill-border bg-[#11111a]">
                <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-medium text-[#8f90aa]">
                  Export readiness
                  <span className={bundleReadiness.errors.length > 0 ? "text-[#f7b0b0]" : "text-[#9be7b5]"}>
                    {bundleReadiness.errors.length > 0 ? `${bundleReadiness.errors.length} issue(s)` : "Ready"}
                  </span>
                </summary>
                <div className="border-t border-quill-border p-3 space-y-1.5">
                  {bundleReadiness.errors.length > 0 && (
                    <ul className="text-xs text-[#f7b0b0] space-y-1">
                      {bundleReadiness.errors.slice(0, 3).map((err) => (
                        <li key={err}>• {err}</li>
                      ))}
                    </ul>
                  )}
                  {bundleReadiness.warnings.length > 0 && (
                    <ul className="text-xs text-[#d2d2e6] space-y-1">
                      {bundleReadiness.warnings.slice(0, 3).map((warn) => (
                        <li key={warn}>• {warn}</li>
                      ))}
                    </ul>
                  )}

                  {bundleValidation.ok !== null && (
                    <div className="mt-2 pt-2 border-t border-quill-border space-y-1">
                      <p className={`text-xs font-medium ${bundleValidation.ok ? "text-[#9be7b5]" : "text-[#f7b0b0]"}`}>
                        Local validation {bundleValidation.ok ? "passed" : "failed"}
                        {bundleValidation.phase ? ` (${bundleValidation.phase})` : ""}
                      </p>
                      {bundleValidation.output && (
                        <pre className="max-h-32 overflow-auto text-[10px] text-[#bcbcd6] bg-[#0d0d15] border border-quill-border rounded p-2 whitespace-pre-wrap break-all">
                          {bundleValidation.output}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </details>
            )}
            <div className="min-h-0 flex-1 mt-3">
              <FileBundlePreview files={fileBundle.payload.files} entry={fileBundle.payload.entry} type={fileBundle.type} />
            </div>
          </div>
        ) : showRawStream ? (
          <div ref={streamContainerRef} className="h-full overflow-auto bg-[#0d0d15]">
            <pre className="p-6 text-[12px] font-mono text-[#C1C7D0] leading-relaxed whitespace-pre-wrap break-all">
              {content}
            </pre>
          </div>
        ) : (
          /* Markdown document */
          <div className="h-full overflow-y-auto">
            <div className="px-10 py-8">
              <MarkdownDocument text={markdownSrc || content} />
            </div>
          </div>
        )}
      </div>

      {content && (
        <div className="md:hidden shrink-0 border-t border-quill-border bg-[#0d0d15] px-3 py-2 pb-safe">
          <div className="grid grid-cols-5 gap-1.5 text-[11px]">
            {(isHTML || (fileBundle?.type === "react-app" && canRunReactPreview)) && (
              <button
                onClick={() => setPreferredTab("preview")}
                className={`h-9 rounded-lg border ${effectiveTab === "preview" ? "border-[rgba(239,68,68,0.5)] text-[#f7b0b0] bg-[rgba(239,68,68,0.12)]" : "border-quill-border text-quill-muted"}`}
              >
                Preview
              </button>
            )}
            <button
              onClick={() => setPreferredTab("code")}
              className={`h-9 rounded-lg border ${effectiveTab === "code" ? "border-[rgba(239,68,68,0.5)] text-[#f7b0b0] bg-[rgba(239,68,68,0.12)]" : "border-quill-border text-quill-muted"}`}
            >
              Code
            </button>
            <button onClick={handleCopy} className="h-9 rounded-lg border border-quill-border text-quill-muted">Copy</button>
            <button onClick={handleDownload} className="h-9 rounded-lg border border-quill-border text-quill-muted">Save</button>
            <button onClick={onClose} className="h-9 rounded-lg border border-quill-border text-quill-muted">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
