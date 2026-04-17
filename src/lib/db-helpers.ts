import { db } from "@/db";
import {
  artifactVersions,
  autopilotRuns,
  autopilotWorkflows,
  chats,
  googleConnections,
  googleWorkspaceSnapshots,
  mcpServerTools,
  mcpServers,
  messageFiles,
  messages,
  modelUsageEvents,
  userEntitlements,
  userSkills,
} from "@/db/schema";
import { sanitizeStoredMessage } from "@/lib/assistant-message-utils";
import { eq, desc, and, gte, count, sql } from "drizzle-orm";

const MAX_DB_FILE_BYTES = Number(process.env.MAX_DB_FILE_BYTES ?? "5242880");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseDataUrl(url: string): { mediaType: string; base64: string } | null {
  const match = url.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  return {
    mediaType: match[1] || "application/octet-stream",
    base64: match[2].replace(/\s+/g, ""),
  };
}

function extractTextFromParts(parts: unknown[]): string {
  return parts
    .map((part) => {
      if (!isRecord(part) || part.type !== "text") return "";
      return typeof part.text === "string" ? part.text : "";
    })
    .join("\n")
    .trim();
}

async function persistDurableFileParts(chatId: string, rawParts: unknown[] | undefined): Promise<unknown[] | null> {
  if (!Array.isArray(rawParts) || rawParts.length === 0) return null;

  const nextParts: unknown[] = [];

  for (const rawPart of rawParts) {
    if (!isRecord(rawPart) || (rawPart.type !== "file" && rawPart.type !== "image")) {
      nextParts.push(rawPart);
      continue;
    }

    const url = typeof rawPart.url === "string" ? rawPart.url : 
                typeof rawPart.image === "string" ? rawPart.image : "";
    if (!url || url.startsWith("/api/files/")) {
      nextParts.push(rawPart);
      continue;
    }

    const parsed = parseDataUrl(url);
    if (!parsed) {
      // Keep non-data URLs as-is (remote/provider-hosted URLs).
      nextParts.push(rawPart);
      continue;
    }

    const byteSize = Buffer.from(parsed.base64, "base64").length;
    if (byteSize > MAX_DB_FILE_BYTES) {
      // Too large for DB-backed storage; keep original URL to avoid dropping content.
      nextParts.push(rawPart);
      continue;
    }

    const [stored] = await db
      .insert(messageFiles)
      .values({
        chatId,
        mediaType: typeof rawPart.mediaType === "string" ? rawPart.mediaType : parsed.mediaType,
        filename: typeof rawPart.filename === "string" ? rawPart.filename : null,
        byteSize,
        dataBase64: parsed.base64,
      })
      .returning({ id: messageFiles.id });

    const replacementUrl = `/api/files/${stored.id}`;
    if (rawPart.type === "image") {
      nextParts.push({ ...rawPart, image: replacementUrl });
    } else {
      nextParts.push({ ...rawPart, url: replacementUrl });
    }
  }

  return nextParts;
}

export async function getChatsByUserId(userId: string) {
  return db.query.chats.findMany({
    where: eq(chats.userId, userId),
    orderBy: [desc(chats.updatedAt)],
  });
}

export async function getChatById(chatId: string) {
  return db.query.chats.findFirst({
    where: eq(chats.id, chatId),
  });
}

export async function createChat(userId: string, title: string, id?: string) {
  const [chat] = await db
    .insert(chats)
    .values({ userId, title, ...(id ? { id } : {}) })
    .returning();
  return chat;
}

export async function updateChatTitle(chatId: string, title: string) {
  await db.update(chats).set({ title, updatedAt: new Date() }).where(eq(chats.id, chatId));
}

export async function getMessagesByChatId(chatId: string) {
  const rows = await db.query.messages.findMany({
    where: eq(messages.chatId, chatId),
    orderBy: [messages.createdAt],
  });

  return rows.map((row) => ({
    ...row,
    partsJson: row.partsJson && typeof row.partsJson === "string" ? JSON.parse(row.partsJson) : row.partsJson
  }));
}

export async function saveMessage({
  chatId,
  role,
  content,
  parts,
}: {
  chatId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  parts?: unknown[];
}) {
  const durableParts = await persistDurableFileParts(chatId, parts);
  const normalized = sanitizeStoredMessage({
    role,
    content,
    parts: durableParts,
  });

  if (normalized.usedFallback) {
    console.warn("[db-helpers] normalized non-renderable assistant message before persistence", {
      chatId,
      originalPartTypes: normalized.originalPartTypes,
    });
  }

  const partsJsonString = normalized.parts ? JSON.stringify(normalized.parts) : null;

  const [msg] = await db
    .insert(messages)
    .values({ chatId, role, content: normalized.content, partsJson: partsJsonString })
    .returning();

  return {
    ...msg,
    partsJson: msg.partsJson && typeof msg.partsJson === "string" 
      ? JSON.parse(msg.partsJson) 
      : msg.partsJson
  };
}

export async function deleteChat(chatId: string) {
  await db.delete(chats).where(eq(chats.id, chatId));
}

export async function deleteChatByUserId(chatId: string, userId: string) {
  const deleted = await db
    .delete(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .returning({ id: chats.id });

  return deleted.length > 0;
}

export async function countUserMessagesToday(userId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const result = await db
    .select({ value: count() })
    .from(messages)
    .innerJoin(chats, eq(messages.chatId, chats.id))
    .where(
      and(
        eq(chats.userId, userId),
        eq(messages.role, "user"),
        gte(messages.createdAt, startOfDay)
      )
    );

  return result[0]?.value ?? 0;
}

export async function getRecentModelUsage(limit = 200) {
  return db.query.modelUsageEvents.findMany({
    orderBy: [desc(modelUsageEvents.createdAt)],
    limit,
  });
}

export async function getUserEntitlementByUserId(userId: string) {
  return db.query.userEntitlements.findFirst({
    where: eq(userEntitlements.userId, userId),
  });
}

export async function createUserEntitlement(input: {
  userId: string;
  plan: "free" | "trial" | "paid";
  status?: "active" | "expired" | "canceled";
  trialStartedAt?: Date;
  trialEndsAt?: Date;
  paidStartsAt?: Date;
  paidEndsAt?: Date;
}) {
  const [row] = await db
    .insert(userEntitlements)
    .values({
      userId: input.userId,
      plan: input.plan,
      status: input.status ?? "active",
      trialStartedAt: input.trialStartedAt,
      trialEndsAt: input.trialEndsAt,
      paidStartsAt: input.paidStartsAt,
      paidEndsAt: input.paidEndsAt,
    })
    .returning();

  return row;
}

export async function updateUserEntitlement(
  userId: string,
  updates: Partial<{
    plan: "free" | "trial" | "paid";
    status: "active" | "expired" | "canceled";
    trialStartedAt: Date | null;
    trialEndsAt: Date | null;
    paidStartsAt: Date | null;
    paidEndsAt: Date | null;
  }>
) {
  const [row] = await db
    .update(userEntitlements)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(userEntitlements.userId, userId))
    .returning();

  return row;
}

export async function getAutopilotWorkflowsByUserId(userId: string) {
  return db.query.autopilotWorkflows.findMany({
    where: eq(autopilotWorkflows.userId, userId),
    orderBy: [desc(autopilotWorkflows.updatedAt)],
  });
}

export async function getAutopilotWorkflowById(workflowId: string) {
  return db.query.autopilotWorkflows.findFirst({
    where: eq(autopilotWorkflows.id, workflowId),
  });
}

export async function createAutopilotWorkflow(input: {
  userId: string;
  name: string;
  prompt: string;
  cronExpression: string;
  timezone: string;
}) {
  const [row] = await db
    .insert(autopilotWorkflows)
    .values({
      userId: input.userId,
      name: input.name,
      prompt: input.prompt,
      cronExpression: input.cronExpression,
      timezone: input.timezone,
    })
    .returning();

  return row;
}

export async function updateAutopilotWorkflowByUserId(
  workflowId: string,
  userId: string,
  updates: Partial<{
    name: string;
    prompt: string;
    cronExpression: string;
    timezone: string;
    status: "active" | "paused";
    lastRunAt: Date | null;
    nextRunAt: Date | null;
    lastRunStatus: "success" | "failed" | null;
  }>
) {
  const [row] = await db
    .update(autopilotWorkflows)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(autopilotWorkflows.id, workflowId), eq(autopilotWorkflows.userId, userId)))
    .returning();

  return row ?? null;
}

export async function deleteAutopilotWorkflowByUserId(workflowId: string, userId: string) {
  const rows = await db
    .delete(autopilotWorkflows)
    .where(and(eq(autopilotWorkflows.id, workflowId), eq(autopilotWorkflows.userId, userId)))
    .returning({ id: autopilotWorkflows.id });

  return rows.length > 0;
}

export async function getRecentAutopilotRunsByUserId(userId: string, limit = 20) {
  return db.query.autopilotRuns.findMany({
    where: eq(autopilotRuns.userId, userId),
    orderBy: [desc(autopilotRuns.startedAt)],
    limit,
  });
}

export async function createAutopilotRun(input: {
  workflowId: string;
  userId: string;
  status: "success" | "failed";
  summary?: string;
  errorMessage?: string;
}) {
  const [row] = await db
    .insert(autopilotRuns)
    .values({
      workflowId: input.workflowId,
      userId: input.userId,
      status: input.status,
      summary: input.summary,
      errorMessage: input.errorMessage,
      completedAt: new Date(),
    })
    .returning();

  return row;
}

// ─── Artifact version history ────────────────────────────────────────────────

export async function getArtifactVersionsByUserId(userId: string, limit = 50) {
  return db.query.artifactVersions.findMany({
    where: eq(artifactVersions.userId, userId),
    orderBy: [desc(artifactVersions.createdAt)],
    limit,
  });
}

export async function getArtifactVersionById(versionId: string) {
  return db.query.artifactVersions.findFirst({
    where: eq(artifactVersions.id, versionId),
  });
}

export async function createArtifactVersion(input: {
  userId: string;
  chatId?: string;
  title: string;
  artifactType: "page" | "react-app" | "nextjs-bundle" | "document";
  payload: unknown;
}) {
  const [row] = await db
    .insert(artifactVersions)
    .values({
      userId: input.userId,
      chatId: input.chatId ?? null,
      title: input.title,
      artifactType: input.artifactType,
      payload: input.payload as Record<string, unknown>,
    })
    .returning();

  return row;
}

export async function deleteArtifactVersionByUserId(versionId: string, userId: string) {
  const rows = await db
    .delete(artifactVersions)
    .where(and(eq(artifactVersions.id, versionId), eq(artifactVersions.userId, userId)))
    .returning({ id: artifactVersions.id });

  return rows.length > 0;
}

// ─── MCP server catalog ──────────────────────────────────────────────────────

export async function getMcpServersByUserId(userId: string) {
  return db.query.mcpServers.findMany({
    where: eq(mcpServers.userId, userId),
    orderBy: [desc(mcpServers.updatedAt)],
  });
}

export async function getMcpServerById(serverId: string) {
  return db.query.mcpServers.findFirst({
    where: eq(mcpServers.id, serverId),
  });
}

export async function createMcpServer(input: {
  userId: string;
  name: string;
  url: string;
  description?: string;
  authType: "none" | "bearer" | "basic";
  authToken?: string;
}) {
  const [row] = await db
    .insert(mcpServers)
    .values({
      userId: input.userId,
      name: input.name,
      url: input.url,
      description: input.description,
      authType: input.authType,
      authToken: input.authToken,
    })
    .returning();

  return row;
}

export async function updateMcpServerByUserId(
  serverId: string,
  userId: string,
  updates: Partial<{
    name: string;
    url: string;
    description: string;
    authType: "none" | "bearer" | "basic";
    authToken: string | null;
    status: "connected" | "error" | "disconnected";
    toolCount: number;
    lastConnectedAt: Date | null;
  }>
) {
  const [row] = await db
    .update(mcpServers)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(mcpServers.id, serverId), eq(mcpServers.userId, userId)))
    .returning();

  return row ?? null;
}

export async function deleteMcpServerByUserId(serverId: string, userId: string) {
  const rows = await db
    .delete(mcpServers)
    .where(and(eq(mcpServers.id, serverId), eq(mcpServers.userId, userId)))
    .returning({ id: mcpServers.id });

  return rows.length > 0;
}

export async function getMcpToolsByServerId(serverId: string) {
  return db.query.mcpServerTools.findMany({
    where: eq(mcpServerTools.serverId, serverId),
    orderBy: [mcpServerTools.toolName],
  });
}

export async function replaceMcpToolsForServer(
  serverId: string,
  userId: string,
  tools: { toolName: string; toolDescription?: string; inputSchema?: unknown }[]
) {
  await db.delete(mcpServerTools).where(eq(mcpServerTools.serverId, serverId));
  if (tools.length === 0) return [];
  const rows = await db
    .insert(mcpServerTools)
    .values(
      tools.map((t) => ({
        serverId,
        userId,
        toolName: t.toolName,
        toolDescription: t.toolDescription,
        inputSchema: t.inputSchema as Record<string, unknown> | null,
      }))
    )
    .returning();
  return rows;
}

// ─── Google Workspace connection ─────────────────────────────────────────────

export async function getGoogleConnectionByUserId(userId: string) {
  return db.query.googleConnections.findFirst({
    where: eq(googleConnections.userId, userId),
  });
}

export async function upsertGoogleConnection(input: {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  email?: string;
  displayName?: string;
  scopes?: string;
}) {
  const existing = await getGoogleConnectionByUserId(input.userId);
  if (existing) {
    const [row] = await db
      .update(googleConnections)
      .set({
        accessToken: input.accessToken,
        refreshToken: input.refreshToken ?? existing.refreshToken,
        expiresAt: input.expiresAt ?? existing.expiresAt,
        email: input.email ?? existing.email,
        displayName: input.displayName ?? existing.displayName,
        scopes: input.scopes ?? existing.scopes,
        updatedAt: new Date(),
      })
      .where(eq(googleConnections.userId, input.userId))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(googleConnections)
    .values({
      userId: input.userId,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      expiresAt: input.expiresAt,
      email: input.email,
      displayName: input.displayName,
      scopes: input.scopes,
    })
    .returning();
  return row;
}

export async function deleteGoogleConnectionByUserId(userId: string) {
  await db.delete(googleConnections).where(eq(googleConnections.userId, userId));
}

export async function createGoogleWorkspaceSnapshot(input: {
  userId: string;
  resourceType: "drive-file" | "google-doc";
  operation: "create" | "update" | "rename" | "move" | "delete";
  resourceId?: string;
  beforePayload?: unknown;
  afterPayload?: unknown;
}) {
  const [row] = await db
    .insert(googleWorkspaceSnapshots)
    .values({
      userId: input.userId,
      resourceType: input.resourceType,
      operation: input.operation,
      resourceId: input.resourceId,
      beforePayload: input.beforePayload as Record<string, unknown> | null,
      afterPayload: input.afterPayload as Record<string, unknown> | null,
    })
    .returning();

  return row;
}

export async function getGoogleWorkspaceSnapshotById(snapshotId: string) {
  return db.query.googleWorkspaceSnapshots.findFirst({
    where: eq(googleWorkspaceSnapshots.id, snapshotId),
  });
}

export async function getGoogleWorkspaceSnapshotsByUserId(userId: string, limit = 30) {
  return db.query.googleWorkspaceSnapshots.findMany({
    where: eq(googleWorkspaceSnapshots.userId, userId),
    orderBy: [desc(googleWorkspaceSnapshots.createdAt)],
    limit,
  });
}

// ─── Skills helpers ───────────────────────────────────────────────────────────

export async function getUserSkills(userId: string) {
  return db.query.userSkills.findMany({
    where: eq(userSkills.userId, userId),
    orderBy: [desc(userSkills.installedAt)],
  });
}

export async function getUserSkillById(userId: string, skillId: string) {
  return db.query.userSkills.findFirst({
    where: and(eq(userSkills.userId, userId), eq(userSkills.skillId, skillId)),
  });
}

export async function installUserSkill(userId: string, skillId: string, config?: unknown) {
  const [row] = await db
    .insert(userSkills)
    .values({
      userId,
      skillId,
      enabled: true,
      config: (config ?? null) as Record<string, unknown> | null,
    })
    .onConflictDoUpdate({
      target: [userSkills.userId, userSkills.skillId],
      set: { enabled: true, config: (config ?? null) as Record<string, unknown> | null, updatedAt: sql`CURRENT_TIMESTAMP` },
    })
    .returning();
  return row;
}

export async function uninstallUserSkill(userId: string, skillId: string) {
  await db
    .delete(userSkills)
    .where(and(eq(userSkills.userId, userId), eq(userSkills.skillId, skillId)));
}

export async function updateUserSkillConfig(userId: string, skillId: string, config: unknown) {
  const [row] = await db
    .update(userSkills)
    .set({ config: config as Record<string, unknown>, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(and(eq(userSkills.userId, userId), eq(userSkills.skillId, skillId)))
    .returning();
  return row;
}
