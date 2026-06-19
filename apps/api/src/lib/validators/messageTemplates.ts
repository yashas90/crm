import { MESSAGE_TEMPLATE_CATEGORIES } from "@propninja/types/message-templates";
import { z } from "zod";

const categorySchema = z.enum(MESSAGE_TEMPLATE_CATEGORIES);

export const createMessageTemplateBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(4000),
  category: categorySchema,
});

export const updateMessageTemplateBodySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  content: z.string().trim().min(1).max(4000).optional(),
  category: categorySchema.optional(),
  isActive: z.boolean().optional(),
});

export const listMessageTemplatesQuerySchema = z.object({
  all: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});
