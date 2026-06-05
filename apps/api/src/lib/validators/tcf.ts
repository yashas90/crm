import { CONSENT_TYPES } from "@propninja/types/enums";
import { z } from "zod";

export const createTcfConsentBodySchema = z.object({
  leadId: z.string().uuid(),
  consentType: z.enum(CONSENT_TYPES),
  consented: z.boolean(),
  consentedAt: z.string().datetime({ offset: true }),
  source: z.string().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
});

export const revokeTcfConsentBodySchema = z
  .object({
    revokedAt: z.string().datetime({ offset: true }).optional(),
  })
  .default({});

export type CreateTcfConsentBody = z.infer<typeof createTcfConsentBodySchema>;
export type RevokeTcfConsentBody = z.infer<typeof revokeTcfConsentBodySchema>;

export const upsertTcfConsentBodySchema = z.object({
  lead_id: z.string().uuid(),
  consent_type: z.enum(CONSENT_TYPES),
  consented: z.boolean(),
  source: z.string().optional(),
  ip_address: z.string().optional(),
});

export const leadIdSnakeParamSchema = z.object({
  lead_id: z.string().uuid(),
});

export type UpsertTcfConsentBody = z.infer<typeof upsertTcfConsentBodySchema>;
