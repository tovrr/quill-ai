import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readWorkspaceFile(relativePath) {
  const absolutePath = resolve(process.cwd(), relativePath);
  return readFile(absolutePath, "utf8");
}

async function main() {
  const pageSource = await readWorkspaceFile("src/app/agent/page.tsx");
  const statusBarSource = await readWorkspaceFile("src/components/agent/AgentStatusBar.tsx");

  // Guard 1: Canvas build intent supports document workflows.
  const docKeywords = [
    '"doc"',
    '"docs"',
    '"document"',
    '"report"',
    '"slides"',
    '"deck"',
    '"sheet"',
    '"spreadsheet"',
    '"table"',
  ];
  for (const keyword of docKeywords) {
    assert(
      pageSource.includes(keyword),
      `Missing document intent keyword in isLikelyCanvasBuildIntent: ${keyword}`,
    );
  }

  // Guard 2: Assistant display canonicalization preserves structured parts.
  assert(
    pageSource.includes("if (hasRenderableAssistantContent(normalized))"),
    "canonicalizeAssistantForDisplay no longer preserves assistant message parts.",
  );
  assert(
    pageSource.includes("const fallbackText = extractTextFromMessageParts"),
    "canonicalizeAssistantForDisplay fallback extraction is missing.",
  );

  // Guard 3: Status bar receives task and step wiring from AgentPage.
  assert(
    pageSource.includes("taskTitle={activeTaskTitle}"),
    "AgentStatusBar taskTitle wiring is missing from AgentPage.",
  );
  assert(
    pageSource.includes("stepCount={statusStepCount}"),
    "AgentStatusBar stepCount wiring is missing from AgentPage.",
  );
  assert(
    pageSource.includes("totalSteps={statusStepCount !== undefined ? 3 : undefined}"),
    "AgentStatusBar totalSteps wiring is missing from AgentPage.",
  );

  // Guard 4: Progress calculation handles zero and invalid totals safely.
  assert(
    statusBarSource.includes('typeof stepCount === "number"'),
    "AgentStatusBar progress guard for stepCount is missing.",
  );
  assert(
    statusBarSource.includes('typeof totalSteps === "number"'),
    "AgentStatusBar progress guard for totalSteps is missing.",
  );
  assert(
    statusBarSource.includes("totalSteps > 0"),
    "AgentStatusBar progress must guard against zero total steps.",
  );

  console.log("Agent remediation regression checks passed.");
}

main().catch((error) => {
  console.error("Agent remediation regression checks failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
