#!/usr/bin/env node

const [, , chatIdArg] = process.argv;
const chatId = chatIdArg || process.env.CHAT_ID;

if (!chatId) {
  console.error("Usage: node scripts/audit-chat-render.mjs <chatId>");
  process.exit(1);
}

const baseUrl = process.env.AUDIT_BASE_URL || "http://localhost:3000";
const cookie = process.env.CHAT_AUDIT_COOKIE;
const url = `${baseUrl}/api/chats/${encodeURIComponent(chatId)}/render-audit`;

const headers = {};
if (cookie) {
  headers.cookie = cookie;
}

try {
  const res = await fetch(url, { headers });
  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    console.error(`Render audit failed (${res.status}).`);
    if (payload) {
      console.error(JSON.stringify(payload, null, 2));
    }
    if (res.status === 401) {
      console.error("Tip: set CHAT_AUDIT_COOKIE from your browser session to query authenticated chats.");
    }
    process.exit(1);
  }

  console.log(`Render audit for chat ${chatId}`);
  console.log(JSON.stringify(payload.summary, null, 2));

  const flagged = payload.messages.filter(
    (row) =>
      row.role === "assistant" &&
      (row.willUseAssistantFallback || row.renderablePartCount === 0),
  );

  if (flagged.length === 0) {
    console.log("No assistant rows were flagged as non-renderable.");
    process.exit(0);
  }

  console.log("Flagged assistant rows:");
  for (const row of flagged) {
    console.log(
      JSON.stringify(
        {
          id: row.id,
          createdAt: row.createdAt,
          partTypes: row.partTypes,
          renderablePartCount: row.renderablePartCount,
          assistantRenderable: row.assistantRenderable,
          willUseAssistantFallback: row.willUseAssistantFallback,
          textPreview: row.textPreview,
        },
        null,
        2,
      ),
    );
  }
} catch (error) {
  console.error("Render audit crashed:", error instanceof Error ? error.message : error);
  process.exit(1);
}
