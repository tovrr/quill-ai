/**
 * Client-side utility for exporting artifacts as ZIP files.
 * Handles POST to /api/export/zip and triggers browser download.
 */

interface ExportOptions {
  artifactType: "page" | "document" | "react-app" | "nextjs-bundle";
  artifactTitle: string;
  files: Record<string, string>;
  onProgress?: (status: string) => void;
  onError?: (error: string) => void;
}

export async function exportArtifactAsZip(options: ExportOptions): Promise<void> {
  const { artifactType, artifactTitle, files, onProgress, onError } = options;

  try {
    onProgress?.("Preparing files for download...");

    const response = await fetch("/api/export/zip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artifactType,
        artifactTitle,
        files,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error ?? `Export failed with status ${response.status}`);
    }

    onProgress?.("Generating ZIP archive...");

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    // Extract filename from header or generate fallback
    const contentDisposition = response.headers.get("Content-Disposition") ?? "";
    let filename = "export.zip";
    const match = contentDisposition.match(/filename="([^"]+)"/);
    if (match) {
      filename = match[1];
    }

    // Trigger download
    onProgress?.(`Downloading ${filename}...`);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onProgress?.("Download complete!");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    onError?.(errorMessage);
    throw error;
  }
}

/**
 * Helper to flatten a nested artifact structure into a file map.
 * Useful for converting complex builder payloads into simple path → content pairs.
 */
export function flattenArtifactFiles(
  payload: Record<string, any>,
  prefix = ""
): Record<string, string> {
  const files: Record<string, string> = {};

  if (payload.files && typeof payload.files === "object") {
    for (const [path, content] of Object.entries(payload.files)) {
      if (typeof content === "string") {
        files[path] = content;
      }
    }
  } else if (payload.html && typeof payload.html === "string") {
    files["index.html"] = payload.html;
  } else if (payload.markdown && typeof payload.markdown === "string") {
    files["README.md"] = payload.markdown;
  }

  return files;
}
