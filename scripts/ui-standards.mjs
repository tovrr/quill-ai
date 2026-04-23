import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const BASELINE_PATH = path.join(ROOT, ".ui-standards-baseline.json");
const REPORT_PATH = path.join(ROOT, "UI_STANDARDS_BASELINE.md");

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mdx", ".html"]);
const IMPORT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

const SVG_ALLOWLIST = new Set([
  "src/components/ui/QuillLogo.tsx",
]);

const RAW_PRIMITIVE_ALLOWLIST = new Set([
  "src/components/ui/button.tsx",
  "src/components/ui/input.tsx",
  "src/components/ui/textarea.tsx",
  "src/components/ui/card.tsx",
  "src/components/ui/badge.tsx",
  "src/components/ui/separator.tsx",
  "src/components/ui/switch.tsx",
  "src/components/ui/dialog.tsx",
  "src/components/ui/select.tsx",
  "src/components/ui/sheet.tsx",
  "src/components/ui/dropdown-menu.tsx",
  "src/components/ui/tabs.tsx",
  "src/components/ui/scroll-area.tsx",
  "src/components/ui/collapsible.tsx",
  "src/components/ui/tooltip.tsx",
]);

// Allow raw primitives in some app pages that intentionally use native controls
RAW_PRIMITIVE_ALLOWLIST.add("src/app/missions/page.tsx");
RAW_PRIMITIVE_ALLOWLIST.add("src/app/admin/sandbox-monitoring/page.tsx");

const DISALLOWED_ICON_PACKAGES = [
  "lucide-react",
  "@radix-ui/react-icons",
];

const RAW_PRIMITIVE_REGEX = /<(button|input|select|textarea|details|summary)\b/g;
const SVG_REGEX = /<svg\b/g;

function toPosix(relPath) {
  return relPath.split(path.sep).join("/");
}

function walkFiles(startDir) {
  const files = [];
  const stack = [startDir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (!SOURCE_EXTENSIONS.has(ext)) continue;
      files.push(fullPath);
    }
  }

  return files;
}

function countMatches(text, regex) {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function collectImportViolations(relPath, text) {
  const violations = [];

  for (const pkg of DISALLOWED_ICON_PACKAGES) {
    const directImportRegex = new RegExp(`(?:from\\s+["'])${pkg.replace("/", "\\/")}(?:["'])`, "g");
    if (directImportRegex.test(text)) {
      violations.push({ file: relPath, reason: `Disallowed icon package import: ${pkg}` });
    }

    const dynamicImportRegex = new RegExp(`import\\(\\s*["']${pkg.replace("/", "\\/")}["']\\s*\\)`, "g");
    if (dynamicImportRegex.test(text)) {
      violations.push({ file: relPath, reason: `Disallowed dynamic icon import: ${pkg}` });
    }
  }

  const heroImportRegex = /from\s+["'](@heroicons\/react[^"']*)["']/g;
  for (const match of text.matchAll(heroImportRegex)) {
    const target = match[1];
    const canonical = /^@heroicons\/react\/(16|20|24)\/(solid|outline)$/;
    if (!canonical.test(target)) {
      violations.push({ file: relPath, reason: `Non-canonical Heroicons import: ${target}` });
    }
  }

  return violations;
}

function analyzeSource() {
  const files = walkFiles(SRC_DIR);

  const svgCounts = {};
  const rawPrimitiveCounts = {};
  const importViolations = [];

  for (const fullPath of files) {
    const relPath = toPosix(path.relative(ROOT, fullPath));
    const text = fs.readFileSync(fullPath, "utf8");

    const svgCount = countMatches(text, SVG_REGEX);
    if (svgCount > 0 && !SVG_ALLOWLIST.has(relPath)) {
      svgCounts[relPath] = svgCount;
    }

    const rawCount = countMatches(text, RAW_PRIMITIVE_REGEX);
    if (rawCount > 0 && !RAW_PRIMITIVE_ALLOWLIST.has(relPath)) {
      rawPrimitiveCounts[relPath] = rawCount;
    }

    if (IMPORT_EXTENSIONS.has(path.extname(fullPath).toLowerCase())) {
      importViolations.push(...collectImportViolations(relPath, text));
    }
  }

  return {
    scannedAt: new Date().toISOString(),
    scannedFiles: files.length,
    svgAllowlist: Array.from(SVG_ALLOWLIST).sort(),
    rawPrimitiveAllowlist: Array.from(RAW_PRIMITIVE_ALLOWLIST).sort(),
    svgCounts,
    rawPrimitiveCounts,
    importViolations,
  };
}

function sortObjectByKey(obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}

function writeBaseline(analysis) {
  const baseline = {
    generatedAt: analysis.scannedAt,
    rules: {
      svgAllowlist: analysis.svgAllowlist,
      rawPrimitiveAllowlist: analysis.rawPrimitiveAllowlist,
    },
    svgCounts: sortObjectByKey(analysis.svgCounts),
    rawPrimitiveCounts: sortObjectByKey(analysis.rawPrimitiveCounts),
  };

  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
}

function writeReport(analysis) {
  const svgRows = Object.entries(sortObjectByKey(analysis.svgCounts));
  const primitiveRows = Object.entries(sortObjectByKey(analysis.rawPrimitiveCounts));
  const importRows = analysis.importViolations;

  const totalSvg = svgRows.reduce((sum, [, count]) => sum + count, 0);
  const totalPrimitives = primitiveRows.reduce((sum, [, count]) => sum + count, 0);

  const lines = [];
  lines.push("# UI Standards Baseline");
  lines.push("");
  lines.push(`Generated: ${analysis.scannedAt}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Scanned files in src: ${analysis.scannedFiles}`);
  lines.push(`- Non-allowlisted inline SVG count: ${totalSvg}`);
  lines.push(`- Raw primitive tag count: ${totalPrimitives}`);
  lines.push(`- Import violations: ${importRows.length}`);
  lines.push("");
  lines.push("## SVG Allowlist");
  lines.push("");
  for (const file of analysis.svgAllowlist) {
    lines.push(`- ${file}`);
  }
  lines.push("");
  lines.push("## Non-Allowlisted Inline SVG Usage");
  lines.push("");
  lines.push("| File | Count |");
  lines.push("| --- | ---: |");
  if (svgRows.length === 0) {
    lines.push("| None | 0 |");
  } else {
    for (const [file, count] of svgRows) {
      lines.push(`| ${file} | ${count} |`);
    }
  }

  lines.push("");
  lines.push("## Raw Primitive Usage");
  lines.push("");
  lines.push("| File | Count |");
  lines.push("| --- | ---: |");
  if (primitiveRows.length === 0) {
    lines.push("| None | 0 |");
  } else {
    for (const [file, count] of primitiveRows) {
      lines.push(`| ${file} | ${count} |`);
    }
  }

  lines.push("");
  lines.push("## Disallowed or Non-Canonical Icon Imports");
  lines.push("");
  lines.push("| File | Violation |");
  lines.push("| --- | --- |");
  if (importRows.length === 0) {
    lines.push("| None | None |");
  } else {
    for (const row of importRows) {
      lines.push(`| ${row.file} | ${row.reason} |`);
    }
  }

  lines.push("");
  fs.writeFileSync(REPORT_PATH, lines.join("\n"), "utf8");
}

function compareAgainstBaseline(analysis, baseline) {
  const issues = [];

  if (analysis.importViolations.length > 0) {
    for (const violation of analysis.importViolations) {
      issues.push(`[import] ${violation.file}: ${violation.reason}`);
    }
  }

  function compareMap(label, current, prior) {
    for (const [file, count] of Object.entries(current)) {
      const baselineCount = prior[file];
      if (baselineCount === undefined) {
        issues.push(`[${label}] New file introduced: ${file} (${count})`);
        continue;
      }
      if (count > baselineCount) {
        issues.push(`[${label}] Count increased for ${file}: baseline=${baselineCount}, current=${count}`);
      }
    }
  }

  compareMap("svg", analysis.svgCounts, baseline.svgCounts ?? {});
  compareMap("raw-primitives", analysis.rawPrimitiveCounts, baseline.rawPrimitiveCounts ?? {});

  return issues;
}

function logSummary(analysis) {
  const svgTotal = Object.values(analysis.svgCounts).reduce((sum, count) => sum + count, 0);
  const primitiveTotal = Object.values(analysis.rawPrimitiveCounts).reduce((sum, count) => sum + count, 0);

  console.log("UI standards scan complete");
  console.log(`- scanned files: ${analysis.scannedFiles}`);
  console.log(`- non-allowlisted svg count: ${svgTotal}`);
  console.log(`- raw primitive count: ${primitiveTotal}`);
  console.log(`- import violations: ${analysis.importViolations.length}`);
}

function usage() {
  console.log("Usage:");
  console.log("  node scripts/ui-standards.mjs audit [--update-baseline] [--write-report]");
  console.log("  node scripts/ui-standards.mjs enforce");
}

const mode = process.argv[2];
const args = new Set(process.argv.slice(3));

if (!mode || (mode !== "audit" && mode !== "enforce")) {
  usage();
  process.exit(1);
}

const analysis = analyzeSource();
logSummary(analysis);

if (mode === "audit") {
  if (args.has("--update-baseline")) {
    writeBaseline(analysis);
    console.log(`Updated baseline: ${path.relative(ROOT, BASELINE_PATH)}`);
  }

  if (args.has("--write-report")) {
    writeReport(analysis);
    console.log(`Wrote report: ${path.relative(ROOT, REPORT_PATH)}`);
  }

  process.exit(0);
}

if (!fs.existsSync(BASELINE_PATH)) {
  console.error(`Missing baseline file: ${path.relative(ROOT, BASELINE_PATH)}`);
  console.error("Run: node scripts/ui-standards.mjs audit --update-baseline --write-report");
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
const issues = compareAgainstBaseline(analysis, baseline);

if (issues.length > 0) {
  console.error("UI standards enforcement failed:\n");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log("UI standards enforcement passed.");