import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const chunksDir = join(ROOT, ".next", "static", "chunks");

const limits = {
  maxSingleJsKb: Number(process.env.BUNDLE_MAX_SINGLE_JS_KB ?? "650"),
  maxSingleCssKb: Number(process.env.BUNDLE_MAX_SINGLE_CSS_KB ?? "90"),
  maxTotalJsKb: Number(process.env.BUNDLE_MAX_TOTAL_JS_KB ?? "1400"),
  maxTotalCssKb: Number(process.env.BUNDLE_MAX_TOTAL_CSS_KB ?? "250"),
};

function toKb(bytes) {
  return Number((bytes / 1024).toFixed(2));
}

function getFilesByExt(ext) {
  return readdirSync(chunksDir)
    .filter((name) => name.endsWith(ext))
    .map((name) => {
      const filePath = join(chunksDir, name);
      return {
        name,
        bytes: statSync(filePath).size,
      };
    });
}

function summarize(files) {
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  const largest = files.reduce((max, file) => (file.bytes > max.bytes ? file : max), {
    name: "n/a",
    bytes: 0,
  });

  return {
    totalKb: toKb(totalBytes),
    largestName: largest.name,
    largestKb: toKb(largest.bytes),
  };
}

function fail(message) {
  console.error(`BUNDLE_BUDGET_FAIL: ${message}`);
  process.exitCode = 1;
}

try {
  const jsFiles = getFilesByExt(".js");
  const cssFiles = getFilesByExt(".css");

  const js = summarize(jsFiles);
  const css = summarize(cssFiles);

  console.log(
    JSON.stringify(
      {
        event: "bundle.budget.summary",
        limits,
        js,
        css,
      },
      null,
      2
    )
  );

  if (js.largestKb > limits.maxSingleJsKb) {
    fail(`largest JS chunk ${js.largestName} is ${js.largestKb}KB (> ${limits.maxSingleJsKb}KB)`);
  }

  if (css.largestKb > limits.maxSingleCssKb) {
    fail(`largest CSS chunk ${css.largestName} is ${css.largestKb}KB (> ${limits.maxSingleCssKb}KB)`);
  }

  if (js.totalKb > limits.maxTotalJsKb) {
    fail(`total JS chunks are ${js.totalKb}KB (> ${limits.maxTotalJsKb}KB)`);
  }

  if (css.totalKb > limits.maxTotalCssKb) {
    fail(`total CSS chunks are ${css.totalKb}KB (> ${limits.maxTotalCssKb}KB)`);
  }

  if (process.exitCode) {
    process.exit(process.exitCode);
  }

  console.log("BUNDLE_BUDGET_OK");
} catch (error) {
  console.error("BUNDLE_BUDGET_ERROR", error instanceof Error ? error.message : String(error));
  process.exit(1);
}
