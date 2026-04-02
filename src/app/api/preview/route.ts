import { NextRequest } from "next/server";
import { generatePreviewHtml } from "@/lib/react-preview-html";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_FILES = 50;
const MAX_FILE_BYTES = 200_000; // 200 KB per file
const MAX_TOTAL_BYTES = 2_000_000; // 2 MB total

export async function POST(req: NextRequest) {
  const sessionData = await auth.api.getSession({ headers: await nextHeaders() }).catch(() => null);
  if (!sessionData?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perMinute = Number(process.env.API_PREVIEW_REQUESTS_PER_MINUTE ?? "20");
  const rateLimit = checkRateLimit({
    key: `preview:user:${sessionData.user.id}`,
    max: perMinute,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Too many preview requests. Please retry shortly." },
      {
        status: 429,
        headers: {
          "x-ratelimit-limit": String(rateLimit.limit),
          "x-ratelimit-remaining": String(rateLimit.remaining),
          "retry-after": String(rateLimit.retryAfterSeconds),
        },
      }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { files, entry } = body as Record<string, unknown>;

  if (!files || typeof files !== "object" || Array.isArray(files)) {
    return Response.json({ error: "files must be an object" }, { status: 400 });
  }

  const rawFiles = files as Record<string, unknown>;
  const fileKeys = Object.keys(rawFiles);

  if (fileKeys.length > MAX_FILES) {
    return Response.json({ error: "Too many files (max 50)" }, { status: 400 });
  }

  let totalBytes = 0;
  const validatedFiles: Record<string, string> = {};

  for (const key of fileKeys) {
    const value = rawFiles[key];
    if (typeof key !== "string" || typeof value !== "string") {
      return Response.json({ error: "File keys and values must be strings" }, { status: 400 });
    }
    if (value.length > MAX_FILE_BYTES) {
      return Response.json({ error: `File "${key}" exceeds the 200 KB limit` }, { status: 400 });
    }
    totalBytes += value.length;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return Response.json({ error: "Total artifact size exceeds the 2 MB limit" }, { status: 400 });
    }
    validatedFiles[key] = value;
  }

  const html = generatePreviewHtml(
    validatedFiles,
    typeof entry === "string" ? entry : undefined,
  );

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
