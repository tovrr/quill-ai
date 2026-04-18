const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function check(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
  } catch (error) {
    console.error(`[FAIL] ${name}:`, error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function extractAssistantTextFromStream(rawStream) {
  const chunks = [];
  const lines = rawStream.split(/\r?\n/);

  for (const line of lines) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;

    let parsed = null;
    try {
      parsed = JSON.parse(payload);
    } catch {
      continue;
    }

    if (parsed && typeof parsed === "object" && parsed.type === "text-delta" && typeof parsed.delta === "string") {
      chunks.push(parsed.delta);
    }
  }

  if (chunks.length > 0) {
    return chunks.join("");
  }

  return rawStream;
}

function extractArtifactEnvelope(responseText) {
  const artifactMatch = responseText.match(/<quill-artifact>\s*([\s\S]*?)\s*<\/quill-artifact>/i);
  assert(artifactMatch?.[1], "Response did not include a <quill-artifact> envelope.");
  return artifactMatch[1].trim();
}

function validateArtifactShape(envelopeJson, expectedType) {
  let parsed = null;
  try {
    parsed = JSON.parse(envelopeJson);
  } catch {
    throw new Error("Artifact envelope is not valid JSON.");
  }

  assert(typeof parsed === "object" && parsed !== null, "Artifact envelope must be an object.");
  assert(parsed.artifactVersion === 1, "artifactVersion must equal 1.");
  assert(typeof parsed.artifact === "object" && parsed.artifact !== null, "artifact object is required.");

  const artifact = parsed.artifact;
  const allowedTypes = new Set(["page", "document", "react-app", "nextjs-bundle"]);
  assert(typeof artifact.type === "string" && allowedTypes.has(artifact.type), "artifact.type is invalid.");
  assert(artifact.type === expectedType, `Expected artifact.type=${expectedType}, got ${String(artifact.type)}.`);
  assert(typeof artifact.payload === "object" && artifact.payload !== null, "artifact.payload is required.");

  if (artifact.type === "page") {
    assert(typeof artifact.payload.html === "string" && artifact.payload.html.trim().length > 0, "page payload.html is required.");
    assert(/<html[\s\S]*<\/html>/i.test(artifact.payload.html), "page payload.html must contain a full html document.");
  }

  if (artifact.type === "document") {
    assert(
      typeof artifact.payload.markdown === "string" && artifact.payload.markdown.trim().length > 0,
      "document payload.markdown is required.",
    );
    assert(!/[A-Za-z][A-Za-z0-9\s]{1,40}:\*(?!\*)/.test(artifact.payload.markdown), "markdown contains malformed emphasis tokens.");
  }

  if (artifact.type === "react-app" || artifact.type === "nextjs-bundle") {
    assert(typeof artifact.payload.files === "object" && artifact.payload.files !== null, "bundle payload.files is required.");
    const entries = Object.entries(artifact.payload.files);
    assert(entries.length > 0, "bundle payload.files cannot be empty.");
    for (const [path, content] of entries) {
      assert(typeof path === "string" && path.length > 0, "bundle file path must be a non-empty string.");
      assert(typeof content === "string", `bundle file content for ${path} must be a string.`);
    }
  }
}

async function requestBuilderArtifact({ name, builderTarget, userPrompt, expectedType }) {
  const maxAttempts = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "fast",
          builderTarget,
          messages: [{ role: "user", content: userPrompt }],
        }),
        signal: AbortSignal.timeout(180_000),
      });

      assert(res.status === 200, `${name}: expected 200, got ${res.status}.`);

      const contentType = res.headers.get("content-type") ?? "";
      assert(contentType.includes("text/event-stream"), `${name}: expected text/event-stream, got ${contentType}.`);

      const rawStream = await res.text();
      assert(rawStream.trim().length > 0, `${name}: stream body was empty.`);

      const assistantText = extractAssistantTextFromStream(rawStream);
      const envelopeJson = extractArtifactEnvelope(assistantText);
      validateArtifactShape(envelopeJson, expectedType);
      return;
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      const retriable = /terminated|fetch failed|ECONNRESET|ETIMEDOUT|UND_ERR/i.test(msg);
      if (!retriable || attempt === maxAttempts) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${name}: request failed`);
}

await check("contract: page artifact envelope is valid", async () => {
  await requestBuilderArtifact({
    name: "page artifact",
    builderTarget: "page",
    userPrompt: "Build a SaaS landing page for a note-taking app with hero, features, pricing, and CTA.",
    expectedType: "page",
  });
});

await check("contract: document artifact envelope is valid", async () => {
  await requestBuilderArtifact({
    name: "document artifact",
    builderTarget: "auto",
    userPrompt:
      "Create a project kickoff document with milestones, risks, and timeline as a detailed report. Return artifact.type=document.",
    expectedType: "document",
  });
});

console.log("Response contract tests passed.");
