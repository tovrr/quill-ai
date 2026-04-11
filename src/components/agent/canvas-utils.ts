import { parseBuilderArtifact } from "@/lib/builder-artifacts";

function extractHTML(content: string): string {
  const trimmed = content.trim();

  const fullFenceMatch = trimmed.match(/^```(?:html)?\n([\s\S]*?)```\s*$/i);
  if (fullFenceMatch) return fullFenceMatch[1].trim();

  const htmlFenceMatch = trimmed.match(/```html\n([\s\S]*?)```/i);
  if (htmlFenceMatch) return htmlFenceMatch[1].trim();

  const htmlDocumentMatch = trimmed.match(/<!doctype html[\s\S]*?<\/html>/i);
  if (htmlDocumentMatch) return htmlDocumentMatch[0].trim();

  const htmlBlockMatch = trimmed.match(/<html[\s\S]*?<\/html>/i);
  if (htmlBlockMatch) return htmlBlockMatch[0].trim();

  return trimmed;
}

export function isHTMLContent(content: string): boolean {
  const src = extractHTML(content).toLowerCase();
  return (
    src.startsWith("<!doctype html") ||
    src.startsWith("<html") ||
    (src.includes("<html") && src.includes("</html>"))
  );
}

export function isCanvasRenderableContent(content: string): boolean {
  if (!content.trim()) return false;
  const artifact = parseBuilderArtifact(content);
  if (artifact) return true;
  return isHTMLContent(content);
}
