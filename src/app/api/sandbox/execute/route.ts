import { auth } from "@/lib/auth/server";
import { headers as nextHeaders } from "next/headers";
import { executeCode, isSandboxEnabled, SUPPORTED_LANGUAGES } from "@/lib/execution/docker";

export const maxDuration = 35;

function jsonResponse(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  // Require authentication — anonymous code execution is not permitted
  let userId: string;
  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session?.user?.id) {
      return jsonResponse({ error: "Authentication required to execute code." }, 401);
    }
    userId = session.user.id;
  } catch {
    return jsonResponse({ error: "Authentication required to execute code." }, 401);
  }

  if (!isSandboxEnabled()) {
    return jsonResponse(
      { error: "Code execution sandbox is not enabled on this server." },
      503,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const code = typeof body.code === "string" ? body.code : null;
  const language = typeof body.language === "string" ? body.language.toLowerCase() : null;
  const timeoutMs =
    typeof body.timeoutMs === "number" && body.timeoutMs > 0 ? body.timeoutMs : undefined;

  if (!code || !code.trim()) {
    return jsonResponse({ error: "Missing or empty 'code' field." }, 400);
  }

  if (!language) {
    return jsonResponse({ error: "Missing 'language' field." }, 400);
  }

  if (!SUPPORTED_LANGUAGES.includes(language)) {
    return jsonResponse(
      { error: `Unsupported language '${language}'. Supported: ${SUPPORTED_LANGUAGES.join(", ")}` },
      400,
    );
  }

  const result = await executeCode({ code, language, timeoutMs });

  console.info("[sandbox/execute]", {
    userId,
    language,
    ok: result.ok,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    error: result.error ?? null,
  });

  return jsonResponse(
    {
      ok: result.ok,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      ...(result.error ? { error: result.error } : {}),
    },
    result.ok ? 200 : 422,
  );
}
