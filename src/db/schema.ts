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
  (table) => [index("session_user_id_idx").on(table.userId)]
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
  (table) => [index("account_user_id_idx").on(table.userId)]
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
  (table) => [index("chat_user_id_idx").on(table.userId)]
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
    createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("message_chat_id_idx").on(table.chatId)]
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
    plan: varchar("plan", { enum: ["free", "trial", "paid"] }).notNull().default("free"),
    status: varchar("status", { enum: ["active", "expired", "canceled"] }).notNull().default("active"),
    trialStartedAt: timestamp("trialStartedAt", { mode: "date" }),
    trialEndsAt: timestamp("trialEndsAt", { mode: "date" }),
    paidStartsAt: timestamp("paidStartsAt", { mode: "date" }),
    paidEndsAt: timestamp("paidEndsAt", { mode: "date" }),
    createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updatedAt").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("user_entitlement_user_id_idx").on(table.userId), index("user_entitlement_plan_idx").on(table.plan)]
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
  ]
);
