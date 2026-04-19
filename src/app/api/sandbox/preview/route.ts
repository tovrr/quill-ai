import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { createPreviewSandbox, isPreviewSandboxAvailable, E2B_PREVIEW_TEMPLATES } from "@/lib/execution/service";

// Preview sandbox boot can take 30–60 s (npm install + dev server start)
export const maxDuration = 90;

function jsonResponse(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * POST /api/sandbox/preview
 *
 * Spin up an E2B preview sandbox for a builder artifact and return a live URL.
 *
 * Body:
 *   artifactType  "nextjs-bundle" | "node"
 *   files         Record<string, string>  — path → file content
 *   startCommand  string (optional, defaults to "npm install && npm run dev")
 *   port          number (optional, defaults to 3000)
 */
export async function POST(req: Request) {
  // Auth gate — preview sandboxes are paid infrastructure
  let userId: string;
  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session?.user?.id) {
      return jsonResponse({ error: "Authentication required." }, 401);
    }
    userId = session.user.id;
  } catch {
    return jsonResponse({ error: "Authentication required." }, 401);
  }

  if (!isPreviewSandboxAvailable()) {
    return jsonResponse({ error: "Live preview sandboxes are not enabled on this server." }, 503);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const artifactType = typeof body.artifactType === "string" ? body.artifactType : null;
  const files =
    body.files && typeof body.files === "object" && !Array.isArray(body.files)
      ? (body.files as Record<string, string>)
      : null;
  const startCommand =
    typeof body.startCommand === "string" ? body.startCommand : "npm install --legacy-peer-deps && npm run dev";
  const port = typeof body.port === "number" && body.port > 0 ? body.port : 3000;

  if (!artifactType) {
    return jsonResponse({ error: "Missing 'artifactType' field." }, 400);
  }

  const supportedTypes = Object.keys(E2B_PREVIEW_TEMPLATES);
  if (!supportedTypes.includes(artifactType)) {
    return jsonResponse(
      {
        error: `Unsupported artifactType '${artifactType}'. Supported: ${supportedTypes.join(", ")}`,
      },
      400,
    );
  }

  if (!files || Object.keys(files).length === 0) {
    return jsonResponse({ error: "Missing or empty 'files' field." }, 400);
  }

  // Validate file count and content types to prevent abuse
  if (Object.keys(files).length > 200) {
    return jsonResponse({ error: "Too many files (max 200)." }, 400);
  }

  const invalidFile = Object.entries(files).find(
    ([, v]) => typeof v !== "string",
  );
  if (invalidFile) {
    return jsonResponse(
      { error: `File value for '${invalidFile[0]}' must be a string.` },
      400,
    );
  }

  const template = E2B_PREVIEW_TEMPLATES[artifactType as keyof typeof E2B_PREVIEW_TEMPLATES];

  const result = await createPreviewSandbox({ template, files, startCommand, port });

  console.info("[sandbox/preview]", {
    userId,
    artifactType,
    template,
    ok: result.ok,
    sbxId: result.sbxId ?? null,
    error: result.error ?? null,
  });

  if (!result.ok) {
    return jsonResponse({ error: result.error ?? "Preview sandbox failed." }, 502);
  }

  return jsonResponse({ sbxId: result.sbxId, previewUrl: result.previewUrl }, 200);
}
