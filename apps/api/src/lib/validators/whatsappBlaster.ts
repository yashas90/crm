import {
  DEFAULT_WHATSAPP_BUTTONS,
  DEFAULT_WHATSAPP_QUESTION_FLOW,
  WHATSAPP_SENDING_SPEEDS,
} from "@propninja/types/whatsapp-blaster";
import { z } from "zod";

export const parseContactsBodySchema = z.object({
  csvText: z.string().optional(),
  fileBase64: z.string().optional(),
  fileName: z.string().optional(),
  mapping: z
    .object({
      name: z.string().optional(),
      phone: z.string().optional(),
      city: z.string().optional(),
      budget: z.string().optional(),
    })
    .optional(),
});

export const saveTemplateBodySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  body: z.string().min(1).max(4096),
  mediaUrl: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  mediaType: z.enum(["image", "pdf", "video"]).nullable().optional(),
  buttons: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1).max(40),
        action: z.enum(["interested", "not_interested", "call_me_back"]),
      }),
    )
    .max(3)
    .optional()
    .default(DEFAULT_WHATSAPP_BUTTONS),
  questionFlow: z
    .object({
      startQuestionId: z.string(),
      thankYouMessage: z.string().min(1).max(1024),
      questions: z.array(
        z.object({
          id: z.string(),
          text: z.string().min(1),
          options: z.array(
            z.object({
              id: z.string(),
              label: z.string().min(1).max(24),
              nextQuestionId: z.string().nullable(),
              mapsTo: z.enum(["budget", "location", "timeline"]).optional(),
            }),
          ),
        }),
      ),
    })
    .optional()
    .default(DEFAULT_WHATSAPP_QUESTION_FLOW),
  thankYouMessage: z.string().max(1024).nullable().optional(),
});

export const createCampaignBodySchema = z.object({
  name: z.string().min(1).max(160),
  propertyId: z.string().uuid().nullable().optional(),
  templateId: z.string().uuid().nullable().optional(),
  assignedAgentId: z.string().uuid().nullable().optional(),
  sendingSpeed: z.enum(WHATSAPP_SENDING_SPEEDS).optional(),
  dailyLimit: z.number().int().min(1).max(5000).optional(),
  scheduledAt: z.string().min(1).nullable().optional(),
});

export const updateCampaignBodySchema = createCampaignBodySchema.partial();

export const replaceContactsBodySchema = z.object({
  csvText: z.string().optional(),
  fileBase64: z.string().optional(),
  fileName: z.string().optional(),
  mapping: parseContactsBodySchema.shape.mapping,
  contacts: z
    .array(
      z.object({
        row: z.number(),
        name: z.string(),
        phone: z.string(),
        formattedPhone: z.string().nullable(),
        city: z.string(),
        budget: z.string(),
        valid: z.boolean(),
        duplicate: z.boolean(),
        invalidReason: z.string().nullable(),
      }),
    )
    .optional(),
});

export const replyBodySchema = z.object({
  text: z.string().min(1).max(4096),
});

export const assignBodySchema = z.object({
  agentId: z.string().uuid(),
});
