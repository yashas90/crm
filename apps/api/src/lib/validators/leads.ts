import { LEAD_STATUSES, LEAD_TEMPERATURES } from "@propninja/types/enums";
import { z } from "zod";

const leadStatusSchema = z.enum(LEAD_STATUSES);
const temperatureSchema = z.enum(LEAD_TEMPERATURES);

/** Matches camelCase query params used by web/mobile clients. */
export const listLeadsQuerySchema = z.object({
  status: leadStatusSchema.optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  assignedTo: z.string().uuid().optional(),
  temperature: temperatureSchema.optional(),
  source: z.string().optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  followUpDueBefore: z.string().datetime({ offset: true }).optional(),
  orderByFollowUp: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

const leadWritableFieldsSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().min(5),
  secondaryPhone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  leadSource: z.string().optional(),
  leadStatus: leadStatusSchema.optional(),
  temperature: temperatureSchema.optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  nextFollowupAt: z.string().datetime().optional(),
  estimatedValue: z.coerce.number().nonnegative().optional(),
  projectName: z.string().optional(),
});

/** Create requires firstName + phone; all other fields optional. */
export const createLeadBodySchema = leadWritableFieldsSchema;

export const updateLeadBodySchema = leadWritableFieldsSchema
  .partial()
  .extend({
    estimatedValue: z.coerce.number().nonnegative().optional().nullable(),
  });

export const assignLeadBodySchema = z.object({
  user_id: z.string().uuid(),
});

export const addNoteBodySchema = z.object({
  text: z.string().min(1),
});

export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;
export type CreateLeadBody = z.infer<typeof createLeadBodySchema>;
export type UpdateLeadBody = z.infer<typeof updateLeadBodySchema>;
