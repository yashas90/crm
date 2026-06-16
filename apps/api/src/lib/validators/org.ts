import { z } from "zod";

const optionalSettingText = z.string().trim().max(500).optional().nullable();

export const editableOrgSettingsSchema = z
  .object({
    website: optionalSettingText,
    timezone: z.string().trim().min(1).max(64).optional().nullable(),
    locale: z.string().trim().min(2).max(16).optional().nullable(),
    dateFormat: z.string().trim().min(2).max(32).optional().nullable(),
    currency: z.string().trim().min(3).max(3).optional().nullable(),
  })
  .partial();

export const updateOrgBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    website: optionalSettingText,
    timezone: z.string().trim().min(1).max(64).optional().nullable(),
    settings: editableOrgSettingsSchema.optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.website !== undefined ||
      value.timezone !== undefined ||
      (value.settings !== undefined && Object.keys(value.settings).length > 0),
    { message: "At least one field is required" },
  );

export type UpdateOrgBody = z.infer<typeof updateOrgBodySchema>;
