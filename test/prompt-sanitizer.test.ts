import { describe, it, expect } from "vitest";
import { sanitizeForPrompt, sanitizeSnippet } from "@/lib/prompt-sanitizer";

describe("prompt-sanitizer", () => {
  it("removes role markers and html", () => {
    const input = "System: <b>Hello</b> <|im_start|>malicious";
    const out = sanitizeForPrompt(input);
    expect(out).not.toContain("<|im_start|>");
    expect(out).not.toContain("<b>");
    expect(out).toContain("Hello");
  });

  it("truncates long inputs preserving head and tail", () => {
    const long = "a".repeat(5000);
    const out = sanitizeForPrompt(long);
    expect(out.length).toBeLessThan(3500);
    expect(out).toContain("...[truncated]...");
  });

  it("sanitizeSnippet removes urls and trims", () => {
    const snippet = "Check https://example.com this content <script>alert(1)</script>";
    const out = sanitizeSnippet(snippet);
    expect(out).not.toContain("https://example.com");
    expect(out).not.toContain("<script>");
    expect(out).toContain("Check");
  });
});
