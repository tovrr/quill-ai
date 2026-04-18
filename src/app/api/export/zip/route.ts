import { NextRequest, NextResponse } from "next/server";
import { createApiRequestContext, logApiCompletion, logApiStart } from "@/lib/observability/logging";

export const runtime = "nodejs";
export const maxDuration = 30;

interface ExportRequest {
  artifactType: "page" | "document" | "react-app" | "nextjs-bundle";
  artifactTitle: string;
  files: Record<string, string>;
}

/**
 * POST /api/export/zip
 *
 * Exports generated artifact files as a downloadable ZIP archive.
 * Accepts an object with artifactType, title, and file map.
 * Returns a binary ZIP stream with correct headers.
 */
export async function POST(req: NextRequest) {
  const requestContext = createApiRequestContext(req, "/api/export/zip");
  logApiStart(requestContext);

  try {
    const body: ExportRequest = await req.json();

    if (!body.artifactType || !body.files || Object.keys(body.files).length === 0) {
      logApiCompletion(requestContext, {
        status: 400,
        error: "invalid_request_body",
      });
      return NextResponse.json(
        { error: "artifactType, artifactTitle, and files are required" },
        { status: 400 }
      );
    }

    // Dynamically import JSZip (ESM-only package)
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    // Add files to ZIP
    for (const [path, content] of Object.entries(body.files)) {
      if (typeof content === "string") {
        zip.file(path, content);
      }
    }

    // Generate ZIP buffer
    const buffer = await zip.generateAsync({ type: "arraybuffer" });

    // Sanitize filename for header
    const sanitizedTitle = (body.artifactTitle || "export")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 50);

    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `${sanitizedTitle}-${timestamp}.zip`;

    logApiCompletion(requestContext, { status: 200 });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "x-request-id": requestContext.requestId,
      },
    });
  } catch (error) {
    console.error("[export/zip] Error:", error);
    logApiCompletion(requestContext, {
      status: 500,
      error: "export_failed",
    });
    return NextResponse.json(
      { error: "Failed to generate ZIP archive" },
      { status: 500 }
    );
  }
}
