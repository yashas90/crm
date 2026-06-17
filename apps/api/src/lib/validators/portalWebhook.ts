import { z } from "zod";
import { isValidIndianMobile } from "../indianPhone.js";
import { PORTAL_NAMES } from "../portalWebhookDefaults.js";

export const portalNameSchema = z.enum(PORTAL_NAMES);

export const portalFieldMappingSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().min(1).optional(),
  message: z.string().min(1).optional(),
  projectInterest: z.string().min(1).optional(),
});

export const createPortalWebhookBodySchema = z.object({
  portalName: portalNameSchema,
  fieldMapping: portalFieldMappingSchema.optional(),
});

export const updatePortalWebhookBodySchema = z
  .object({
    fieldMapping: portalFieldMappingSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => value.fieldMapping !== undefined || value.isActive !== undefined, {
    message: "Provide fieldMapping and/or isActive",
  });

export const portalWebhookTestBodySchema = z.object({
  portalName: portalNameSchema,
  fieldMapping: portalFieldMappingSchema.optional(),
  payload: z.record(z.unknown()),
});

export const portalMappedLeadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z
    .string()
    .min(1, "Phone is required")
    .refine(isValidIndianMobile, "Invalid Indian mobile number"),
  email: z.string().email().optional(),
  message: z.string().optional(),
  projectInterest: z.string().optional(),
});

export type CreatePortalWebhookBody = z.infer<typeof createPortalWebhookBodySchema>;
export type UpdatePortalWebhookBody = z.infer<typeof updatePortalWebhookBodySchema>;
export type PortalWebhookTestBody = z.infer<typeof portalWebhookTestBodySchema>;
