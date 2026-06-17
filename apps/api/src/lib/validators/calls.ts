import { z } from "zod";
import { CALLS_LIST_MAX, LIST_PAGE_SIZE_DEFAULT } from "../pagination.js";

const callOutcomeSchema = z.enum(["answered", "no_answer", "busy", "left_voicemail"]);

export const logCallBodySchema = z
  .object({
    lead_id: z.string().uuid().optional(),
    leadId: z.string().uuid().optional(),
    phone_number: z.string().min(5).max(32).optional(),
    phoneNumber: z.string().min(5).max(32).optional(),
    direction: z.enum(["incoming", "outgoing"]).optional(),
    status: z.enum(["completed", "missed", "rejected", "failed"]).optional(),
    started_at: z.string().datetime().optional(),
    ended_at: z.string().datetime().optional(),
    duration_seconds: z.number().int().nonnegative().optional(),
    /** Duration in whole minutes (web-friendly). */
    duration: z.number().positive().optional(),
    outcome: callOutcomeSchema,
    disposition: z.string().min(1).max(500).optional(),
    notes: z.string().max(5000).optional(),
    source: z.enum(["mobile-manual", "mobile-auto", "web-manual"]).optional(),
  })
  .strip()
  .superRefine((value, ctx) => {
    const leadId = value.lead_id ?? value.leadId;
    const phone = value.phone_number ?? value.phoneNumber;
    const hasDuration = value.duration_seconds !== undefined || value.duration !== undefined;

    if (!leadId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "lead_id is required",
        path: ["lead_id"],
      });
    }
    if (!phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "phone_number is required",
        path: ["phone_number"],
      });
    }
    if (!hasDuration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "duration_seconds or duration is required",
        path: ["duration_seconds"],
      });
    }
  });

export type LogCallBody = z.infer<typeof logCallBodySchema>;

export const listCallsQuerySchema = z
  .object({
    agentId: z.string().min(1).optional(),
    user_id: z.string().uuid().optional(),
    lead_id: z.string().uuid().optional(),
    leadId: z.string().uuid().optional(),
    direction: z.enum(["incoming", "outgoing"]).optional(),
    status: z.enum(["completed", "missed", "rejected", "failed"]).optional(),
    outcome: callOutcomeSchema.optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(CALLS_LIST_MAX).optional(),
    pageSize: z.coerce.number().int().min(1).max(CALLS_LIST_MAX).optional(),
  })
  .transform((value) => ({
    agentId: value.agentId,
    userId: value.user_id,
    leadId: value.lead_id ?? value.leadId,
    direction: value.direction,
    status: value.status,
    outcome: value.outcome,
    dateFrom: value.dateFrom ?? value.date_from,
    dateTo: value.dateTo ?? value.date_to,
    page: value.page,
    pageSize: Math.min(value.limit ?? value.pageSize ?? LIST_PAGE_SIZE_DEFAULT, CALLS_LIST_MAX),
  }));

export type ListCallsQuery = z.infer<typeof listCallsQuerySchema>;

export const summaryQuerySchema = z
  .object({
    agentId: z.string().min(1).optional(),
    user_id: z.string().uuid().optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
  })
  .transform((value) => ({
    agentId: value.agentId,
    userId: value.user_id,
    dateFrom: value.dateFrom ?? value.date_from,
    dateTo: value.dateTo ?? value.date_to,
  }));
