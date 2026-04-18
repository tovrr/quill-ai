// Lightweight prompt sanitizer to reduce prompt-injection and jailbreak patterns
// Not a replacement for robust input validation — a pragmatic first layer.

export function sanitizeForPrompt(input: string): string {
  if (!input) return input;

  let s = input;

  // Remove common role tokens and Anthropic/OpenAI style markers
  s = s.replace(/<\|im_start\|>|<\|im_end\|>|\[system\]|\[user\]|\[assistant\]/gi, "");

  // Remove explicit role prefixes like "System:" "User:" at line starts
  s = s.replace(/^\s*(system|user|assistant)\s*:\s*/gim, "");

  // Strip HTML tags
  s = s.replace(/<[^>]+>/g, "");

  // Remove control characters
  s = s.replace(/[\x00-\x1F\x7F]+/g, " ");

  // Remove suspicious jailbreak punctuation sequences
  s = s.replace(/--+|__+|\*\*+/g, " ");

  // Collapse whitespace and trim
  s = s.replace(/\s+/g, " ").trim();

  // Limit length to avoid blowing prompt budgets (keep start and end)
  const MAX = 3000; // characters
  if (s.length > MAX) {
    const head = s.slice(0, 1500);
    const tail = s.slice(-1400);
    s = head + "\n...[truncated]...\n" + tail;
  }

  return s;
}

export function sanitizeSnippet(snippet: string): string {
  // For web search snippets we also remove URLs and excessive punctuation
  if (!snippet) return snippet;
  let s = sanitizeForPrompt(snippet);
  s = s.replace(/https?:\/\/\S+/gi, "");
  s = s.replace(/www\.[^\s]+/gi, "");
  return s;
}

export default { sanitizeForPrompt, sanitizeSnippet };
