import { z } from "zod";

const looseRecordSchema = z.object({}).catchall(z.unknown());

export const chatRequestPartSchema = looseRecordSchema.extend({
  type: z.string().optional(),
});

export const chatRequestContentBlockSchema = looseRecordSchema.extend({
  type: z.string().optional(),
  text: z.string().optional(),
});

export const chatRequestMessageSchema = looseRecordSchema.extend({
  id: z.string().optional(),
  role: z.string().optional(),
  parts: z.array(chatRequestPartSchema).optional(),
  content: z.union([z.string(), z.array(chatRequestContentBlockSchema)]).optional(),
});

export const chatRequestSchema = z.object({
  messages: z.array(chatRequestMessageSchema).optional(),
  text: z.string().optional(),
  message: looseRecordSchema.extend({
    role: z.string().optional(),
    content: z.string().optional(),
  }).optional(),
  chatId: z.string().optional(),
  id: z.string().optional(),
  mode: z.enum(["fast", "thinking", "advanced"]).optional(),
  builderTarget: z.enum(["auto", "page", "react-app", "nextjs-bundle"]).optional(),
  builderLocks: looseRecordSchema.extend({
    layout: z.boolean().optional(),
    colors: z.boolean().optional(),
    sectionOrder: z.boolean().optional(),
    copy: z.boolean().optional(),
  }).optional(),
  builderSession: looseRecordSchema.extend({
    lastArtifactType: z.enum(["page", "document", "react-app", "nextjs-bundle"]).optional(),
    lastArtifactTitle: z.string().optional(),
    recentRefinements: z.array(z.string()).max(5).optional(),
  }).optional(),
  userCustomization: z.unknown().optional(),
  webSearch: z.boolean().optional(),
  killerId: z.string().optional(),
}).catchall(z.unknown());

export type ChatRequestBody = z.infer<typeof chatRequestSchema>;
export type ChatRequestMessage = z.infer<typeof chatRequestMessageSchema>;
export type ChatRequestPart = z.infer<typeof chatRequestPartSchema>;
export type ChatRequestContentBlock = z.infer<typeof chatRequestContentBlockSchema>;