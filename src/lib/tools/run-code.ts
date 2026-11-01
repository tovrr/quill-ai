import { tool, jsonSchema } from "ai";
import { executeCode } from "@/lib/execution/service";

export const RUN_CODE_DESCRIPTION =
  "Execute Python code in a sandboxed environment and return stdout, stderr, and exit code. " +
  "Use this to run computations, test logic, or validate code. " +
  "The sandbox has no filesystem persistence between calls.";

export const runCodeInputSchema = jsonSchema<{ code: string; language: "python" }>({
  type: "object",
  properties: {
    code: {
      type: "string",
      description: "The source code to execute.",
    },
    language: {
      type: "string",
      enum: ["python"],
      description: "The programming language. Currently only 'python' is supported.",
    },
  },
  required: ["code", "language"],
});

export function buildRunCodeTool() {
  return tool({
    description: RUN_CODE_DESCRIPTION,
    inputSchema: runCodeInputSchema,
    execute: async ({ code, language }: { code: string; language: "python" }) => {
      const result = await executeCode({ code, language, timeoutMs: 15_000 });
      return {
        ok: result.ok,
        stdout: result.stdout || "(no output)",
        stderr: result.stderr || undefined,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        ...(result.error ? { error: result.error } : {}),
      };
    },
  });
}
