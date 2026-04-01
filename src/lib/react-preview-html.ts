/**
 * Generates a self-contained HTML preview document for a React artifact bundle.
 *
 * The returned HTML is designed to be loaded via a blob: URL inside a sandboxed
 * iframe (sandbox="allow-scripts allow-forms allow-popups").  Blob-URL documents
 * are NOT subject to the parent page's Content-Security-Policy, so Babel
 * standalone and ES-module imports from esm.sh work without any changes to
 * next.config.ts.
 */

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

/**
 * Embed a JS value as JSON inside a <script> block without the risk of
 * "</script>" appearing in the literal and breaking the HTML parser.
 */
function toEmbeddedJson(value: unknown): string {
  return JSON.stringify(value).replace(/<\//g, "<\\/");
}

export function generatePreviewHtml(
  files: Record<string, string>,
  entry?: string,
): string {
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
      body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; background: #0b0b13; color: #e7e7f0; }
      .preview-error { padding: 12px 14px; margin: 10px; border-radius: 10px; border: 1px solid rgba(239,68,68,0.4); background: rgba(239,68,68,0.1); color: #f7b0b0; font-size: 12px; white-space: pre-wrap; font-family: monospace; }
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
      window.addEventListener("unhandledrejection", (event) => {
        showError("Unhandled rejection: " + (event.reason?.message || String(event.reason)));
      });

      const moduleUrlCache = new Map();

      const dirname = (path) => {
        const idx = path.lastIndexOf("/");
        return idx >= 0 ? path.slice(0, idx) : "";
      };

      const normalize = (path) =>
        path
          .replace(/\\\\/g, "/")
          .replace(/\\/\\.\\/g, "/")
          .replace(/^\\.\\//,  "")
          .replace(/\\/+/g, "/");

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
        for (const ext of [".tsx", ".ts", ".jsx", ".js"]) {
          if (files[resolved + ext]) return resolved + ext;
        }
        for (const suffix of ["/index.tsx", "/index.ts", "/index.jsx", "/index.js"]) {
          if (files[resolved + suffix]) return resolved + suffix;
        }
        return resolved;
      };

      const rewriteImports = (code, fromPath) => {
        const rewriteSpecifier = (spec) => {
          if (!spec.startsWith(".")) return spec;
          return toModuleUrl(resolveFile(fromPath, spec));
        };
        code = code.replace(/(import\\s+[\\s\\S]*?from\\s*['"])([^'"]+)(['"])/g, (_, a, spec, c) => a + rewriteSpecifier(spec) + c);
        code = code.replace(/(export\\s+[\\s\\S]*?from\\s*['"])([^'"]+)(['"])/g, (_, a, spec, c) => a + rewriteSpecifier(spec) + c);
        code = code.replace(/(import\\(\\s*['"])([^'"]+)(['"]\\s*\\))/g,         (_, a, spec, c) => a + rewriteSpecifier(spec) + c);
        return code;
      };

      const toModuleUrl = (filePath) => {
        if (moduleUrlCache.has(filePath)) return moduleUrlCache.get(filePath);
        const source = files[filePath];
        if (typeof source !== "string") throw new Error("Missing module: " + filePath);

        if (/\.(css|scss)$/i.test(filePath)) {
          const cssText = JSON.stringify(source);
          const cssModule = [
            "const css = " + cssText + ";",
            "const style = document.createElement('style');",
            "style.setAttribute('data-quill-preview-style', '1');",
            "style.textContent = css;",
            "document.head.appendChild(style);",
            "export default css;",
          ].join("\n");

          const cssBlob = new Blob([cssModule], { type: "text/javascript" });
          const cssUrl = URL.createObjectURL(cssBlob);
          moduleUrlCache.set(filePath, cssUrl);
          return cssUrl;
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
        showError("No entry file found in the React artifact. Expected one of: src/main.tsx, src/index.tsx, App.tsx");
      } else {
        try {
          const entryUrl = toModuleUrl(entry);
          await import(entryUrl);
        } catch (err) {
          showError("Preview error: " + (err instanceof Error ? err.message : String(err)));
        }
      }
    </script>
  </body>
</html>`;
}
