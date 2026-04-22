import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  index,
  integer,
  doublePrecision,
  jsonb,
  unique,
  customType,
} from "drizzle-orm/pg-core";

// ─── Better Auth tables ──────────────────────────────────────────────────────

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: varchar("email").notNull().unique(),
  emailVerified: boolean("emailVerified").default(false),
  image: text("image"),
  createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updatedAt").default(sql`CURRENT_TIMESTAMP`),
});

export const sessions = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: varchar("token").notNull().unique(),
    expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updatedAt").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const accounts = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: varchar("accountId").notNull(),
    providerId: varchar("providerId").notNull(),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { mode: "date" }),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { mode: "date" }),
    scope: text("scope"),
    idToken: text("idToken"),
    password: text("password"),
    createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updatedAt").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: varchar("identifier").notNull(),
  value: varchar("value").notNull(),
  expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
  createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updatedAt").default(sql`CURRENT_TIMESTAMP`),
});

// ─── Quill AI app tables ─────────────────────────────────────────────────────

export const chats = pgTable(
  "chat",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title").notNull().default("New chat"),
    createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updatedAt").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("chat_user_id_idx").on(table.userId)],
);

export const messages = pgTable(
  "message",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    chatId: text("chatId")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    role: varchar("role", { enum: ["user", "assistant", "system", "tool"] }).notNull(),
    content: text("content").notNull(),
    partsJson: jsonb("partsJson"),
    createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("message_chat_id_idx").on(table.chatId),
    index("message_role_created_chat_idx").on(table.role, table.createdAt, table.chatId),
  ],
);

export const messageFiles = pgTable(
  "message_file",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    chatId: text("chatId")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    mediaType: text("mediaType").notNull(),
    filename: text("filename"),
    byteSize: integer("byteSize").notNull(),
    dataBase64: text("dataBase64").notNull(),
    createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("message_file_chat_id_idx").on(table.chatId)],
);

export const userEntitlements = pgTable(
  "user_entitlement",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    plan: varchar("plan", { enum: ["free", "trial", "pro", "team"] })
      .notNull()
      .default("free"),
    status: varchar("status", { enum: ["active", "expired", "canceled", "past_due"] })
      .notNull()
      .default("active"),
    trialStartedAt: timestamp("trialStartedAt", { mode: "date" }),
    trialEndsAt: timestamp("trialEndsAt", { mode: "date" }),
    paidStartsAt: timestamp("paidStartsAt", { mode: "date" }),
    paidEndsAt: timestamp("paidEndsAt", { mode: "date" }),
    stripeCustomerId: text("stripeCustomerId"),
    stripeSubscriptionId: text("stripeSubscriptionId"),
    stripePriceId: text("stripePriceId"),
    stripeInvoiceId: text("stripeInvoiceId"),
    webhookProcessedAt: timestamp("webhookProcessedAt", { mode: "date" }),
    createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updatedAt").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("user_entitlement_user_id_idx").on(table.userId),
    index("user_entitlement_plan_idx").on(table.plan),
    index("user_entitlement_stripe_customer_id_idx").on(table.stripeCustomerId),
    index("user_entitlement_stripe_subscription_id_idx").on(table.stripeSubscriptionId),
  ],
);

export const modelUsageEvents = pgTable(
  "model_usage_event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").references(() => users.id, { onDelete: "set null" }),
    chatId: text("chatId").references(() => chats.id, { onDelete: "set null" }),
    route: varchar("route").notNull(),
    feature: varchar("feature", { enum: ["chat", "image"] }).notNull(),
    mode: varchar("mode", { enum: ["fast", "thinking", "advanced"] }),
    provider: varchar("provider").notNull(),
    model: varchar("model").notNull(),
    inputTokens: integer("inputTokens"),
    outputTokens: integer("outputTokens"),
    totalTokens: integer("totalTokens"),
    reasoningTokens: integer("reasoningTokens"),
    cachedInputTokens: integer("cachedInputTokens"),
    imageCount: integer("imageCount").notNull().default(0),
    estimatedCostUsd: doublePrecision("estimatedCostUsd"),
    rawUsage: jsonb("rawUsage"),
    providerMetadata: jsonb("providerMetadata"),
    createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("model_usage_event_user_id_idx").on(table.userId),
    index("model_usage_event_chat_id_idx").on(table.chatId),
    index("model_usage_event_model_idx").on(table.model),
    index("model_usage_event_created_at_idx").on(table.createdAt),
  ],
);

export const autopilotWorkflows = pgTable(
  "autopilot_workflow",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name").notNull(),
    prompt: text("prompt").notNull(),
    cronExpression: varchar("cronExpression").notNull(),
    timezone: varchar("timezone").notNull().default("UTC"),
    status: varchar("status", { enum: ["active", "paused"] })
      .notNull()
      .default("active"),
    lastRunAt: timestamp("lastRunAt", { mode: "date" }),
    nextRunAt: timestamp("nextRunAt", { mode: "date" }),
    lastRunStatus: varchar("lastRunStatus", { enum: ["success", "failed"] }),
    createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updatedAt").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("autopilot_workflow_user_id_idx").on(table.userId),
    index("autopilot_workflow_status_idx").on(table.status),
    index("autopilot_workflow_next_run_idx").on(table.nextRunAt),
  ],
);

export const autopilotRuns = pgTable(
  "autopilot_run",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workflowId: text("workflowId")
      .notNull()
      .references(() => autopilotWorkflows.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { enum: ["success", "failed"] }).notNull(),
    summary: text("summary"),
    errorMessage: text("errorMessage"),
    startedAt: timestamp("startedAt").default(sql`CURRENT_TIMESTAMP`),
    completedAt: timestamp("completedAt"),
  },
  (table) => [
    index("autopilot_run_workflow_id_idx").on(table.workflowId),
    index("autopilot_run_user_id_idx").on(table.userId),
    index("autopilot_run_started_at_idx").on(table.startedAt),
  ],
);

// ─── Artifact version history ────────────────────────────────────────────────

export const artifactVersions = pgTable(
  "artifact_version",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chatId: text("chatId").references(() => chats.id, { onDelete: "set null" }),
    title: varchar("title").notNull(),
    artifactType: varchar("artifactType", {
      enum: ["page", "react-app", "nextjs-bundle", "document"],
    }).notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("artifact_version_user_id_idx").on(table.userId),
    index("artifact_version_chat_id_idx").on(table.chatId),
    index("artifact_version_created_at_idx").on(table.createdAt),
  ],
);

// ─── MCP server catalog ──────────────────────────────────────────────────────

export const mcpServers = pgTable(
  "mcp_server",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name").notNull(),
    url: varchar("url").notNull(),
    description: text("description"),
    authType: varchar("authType", { enum: ["none", "bearer", "basic"] })
      .notNull()
      .default("none"),
    authToken: text("authToken"),
    oauthProvider: varchar("oauthProvider"),
    oauthAuthorizeUrl: text("oauthAuthorizeUrl"),
    oauthTokenUrl: text("oauthTokenUrl"),
    oauthClientId: text("oauthClientId"),
    oauthClientSecretEnc: text("oauthClientSecretEnc"),
    oauthScopes: text("oauthScopes"),
    oauthRedirectUri: text("oauthRedirectUri"),
    oauthAccessTokenEnc: text("oauthAccessTokenEnc"),
    oauthRefreshTokenEnc: text("oauthRefreshTokenEnc"),
    oauthAccessTokenExpiresAt: timestamp("oauthAccessTokenExpiresAt", { mode: "date" }),
    oauthState: text("oauthState"),
    oauthConnectedAt: timestamp("oauthConnectedAt", { mode: "date" }),
    status: varchar("status", { enum: ["connected", "error", "disconnected"] })
      .notNull()
      .default("disconnected"),
    toolCount: integer("toolCount").notNull().default(0),
    lastConnectedAt: timestamp("lastConnectedAt"),
    createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updatedAt").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("mcp_server_user_id_idx").on(table.userId)],
);

export const mcpServerTools = pgTable(
  "mcp_server_tool",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    serverId: text("serverId")
      .notNull()
      .references(() => mcpServers.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toolName: varchar("toolName").notNull(),
    toolDescription: text("toolDescription"),
    inputSchema: jsonb("inputSchema"),
    createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("mcp_server_tool_server_id_idx").on(table.serverId),
    index("mcp_server_tool_user_id_idx").on(table.userId),
  ],
);

// ─── Google Workspace connection ─────────────────────────────────────────────

export const googleConnections = pgTable(
  "google_connection",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("accessToken").notNull(),
    refreshToken: text("refreshToken"),
    expiresAt: timestamp("expiresAt", { mode: "date" }),
    email: varchar("email"),
    displayName: text("displayName"),
    scopes: text("scopes"),
    createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updatedAt").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("google_connection_user_id_idx").on(table.userId)],
);

export const googleWorkspaceSnapshots = pgTable(
  "google_workspace_snapshot",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    resourceType: varchar("resourceType", { enum: ["drive-file", "google-doc"] }).notNull(),
    operation: varchar("operation", { enum: ["create", "update", "rename", "move", "delete"] }).notNull(),
    resourceId: text("resourceId"),
    beforePayload: jsonb("beforePayload"),
    afterPayload: jsonb("afterPayload"),
    createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("google_workspace_snapshot_user_id_idx").on(table.userId),
    index("google_workspace_snapshot_resource_id_idx").on(table.resourceId),
    index("google_workspace_snapshot_created_at_idx").on(table.createdAt),
  ],
);

// ─── Skills marketplace ───────────────────────────────────────────────────────

export const userSkills = pgTable(
  "user_skill",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    skillId: varchar("skillId").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    config: jsonb("config"),
    installedAt: timestamp("installedAt").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updatedAt").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("user_skill_user_id_idx").on(table.userId),
    index("user_skill_skill_id_idx").on(table.skillId),
    unique("user_skill_user_skill_uniq").on(table.userId, table.skillId),
  ],
);

// ─── Analytics Events ────────────────────────────────────────────────────────

export const analyticsEvents = pgTable(
  "analytics_event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: varchar("sessionId").notNull(),
    chatId: text("chatId").references(() => chats.id, { onDelete: "set null" }),
    eventType: varchar("eventType").notNull(),
    properties: jsonb("properties"),
    mode: varchar("mode"),
    provider: varchar("provider"),
    model: varchar("model"),
    artifactType: varchar("artifactType"),
    duration: integer("duration"),
    error: text("error"),
    createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("analytics_event_user_id_idx").on(table.userId),
    index("analytics_event_session_id_idx").on(table.sessionId),
    index("analytics_event_chat_id_idx").on(table.chatId),
    index("analytics_event_type_idx").on(table.eventType),
    index("analytics_event_created_at_idx").on(table.createdAt),
  ],
);

// ─── RAG (Retrieval-Augmented Generation) ────────────────────────────────────

// pgvector type for Drizzle ORM
const vector = customType<{ data: number[]; driverData: string; config: { dimensions: number } }>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`;
  },
  fromDriver(value: string) {
    // pgvector returns values like "[0.1,0.2,...]"
    return JSON.parse(value) as number[];
  },
  toDriver(value: number[]) {
    return JSON.stringify(value);
  },
});

export const ragDocuments = pgTable(
  "rag_document",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title").notNull(),
    source: varchar("source").notNull().default("upload"),
    mimeType: varchar("mimeType").notNull().default("text/plain"),
    byteSize: integer("byteSize").notNull().default(0),
    chunkCount: integer("chunkCount").notNull().default(0),
    createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updatedAt").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("rag_document_user_id_idx").on(table.userId),
    index("rag_document_created_at_idx").on(table.createdAt),
  ],
);

export const ragChunks = pgTable(
  "rag_chunk",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    documentId: text("documentId")
      .notNull()
      .references(() => ragDocuments.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunkIndex").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("rag_chunk_document_id_idx").on(table.documentId), index("rag_chunk_user_id_idx").on(table.userId)],
);

// ─── Universal Mission Inbox ─────────────────────────────────────────────────

export const SESSION_SOURCES = [
  "quill",
  "telegram",
  "gmail",
  "notion",
  "slack",
  "hermes",
  "openclaw",
  "agent",
  "custom",
] as const;
export type SessionSource = (typeof SESSION_SOURCES)[number];

export const externalSessions = pgTable(
  "external_session",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    source: varchar("source", { enum: SESSION_SOURCES }).notNull().default("custom"),
    sourceId: text("sourceId"),
    title: varchar("title").notNull(),
    summary: text("summary"),
    externalUrl: text("externalUrl"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updatedAt").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("external_session_user_id_idx").on(table.userId),
    index("external_session_source_idx").on(table.source),
    index("external_session_updated_at_idx").on(table.updatedAt),
  ],
);

export const userApiKeys = pgTable(
  "user_api_key",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: varchar("label").notNull().default("default"),
    keyHash: text("keyHash").notNull().unique(),
    createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
    lastUsedAt: timestamp("lastUsedAt"),
  },
  (table) => [
    index("user_api_key_user_id_idx").on(table.userId),
    index("user_api_key_hash_idx").on(table.keyHash),
  ],
);

// ─── Metrics ──────────────────────────────────────────────────────────────────

export const metrics = pgTable(
  "metric",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    metricType: varchar("metric_type", { length: 50 }).notNull(),
    userId: text("userId").references(() => users.id, { onDelete: "set null" }),
    route: varchar("route", { length: 255 }),
    feature: varchar("feature", { length: 100 }),
    value: doublePrecision("value").notNull(),
    metadata: jsonb("metadata"),
    timestamp: timestamp("timestamp", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("metric_user_id_idx").on(table.userId),
    index("metric_type_idx").on(table.metricType),
    index("metric_timestamp_idx").on(table.timestamp),
    index("metric_route_idx").on(table.route),
    index("metric_feature_idx").on(table.feature),
  ],
);
