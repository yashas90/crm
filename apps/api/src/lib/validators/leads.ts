import { LEAD_STATUSES, LEAD_TEMPERATURES } from "@propninja/types/enums";
import { z } from "zod";
import { leadAdvancedListQuerySchema } from "../leadAdvancedListQuery.js";
import { normalizeLeadStageInput, normalizeLeadStatusInput } from "../leadStage.js";

const leadStatusSchema = z.enum(LEAD_STATUSES);
const temperatureSchema = z.enum(LEAD_TEMPERATURES);

/** Matches camelCase query params used by web/mobile clients. */
export const listLeadsQuerySchema = z
  .object({
    status: leadStatusSchema.optional(),
    search: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .transform((value) => Math.min(Math.max(1, value), 200))
      .default(25),
    assignedTo: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    importBatchId: z.string().uuid().optional(),
    temperature: temperatureSchema.optional(),
    source: z.string().optional(),
    dateFrom: z.string().datetime({ offset: true }).optional(),
    dateTo: z.string().datetime({ offset: true }).optional(),
    followUpDueBefore: z.string().datetime({ offset: true }).optional(),
    followUpDueAfter: z.string().datetime({ offset: true }).optional(),
    orderByFollowUp: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
    unassigned: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
    activeOnly: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
    excludeNew: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
    deletedOnly: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
    teamLeads: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
    duplicatesOnly: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
    excludeDuplicates: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
    reEnquiredOnly: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
    adLeads: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
    naLeadsOnly: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
    tags: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((value) => {
        if (!value) return undefined;
        const parts = Array.isArray(value) ? value : [value];
        const tags = parts
          .flatMap((part) => part.split(","))
          .map((tag) => tag.trim())
          .filter(Boolean);
        return tags.length > 0 ? tags : undefined;
      }),
  })
  .merge(leadAdvancedListQuerySchema);

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
  projectId: z.string().uuid().optional().nullable(),
});

/** Create requires firstName + phone; all other fields optional. */
export const createLeadBodySchema = leadWritableFieldsSchema.extend({
  /** Admin/manager may assign on create; agents ignore this (forced to self). */
  assignedTo: z.string().uuid().optional(),
});

/** Coerce legacy mobile PATCH bodies before Zod validation. */
export function preprocessUpdateLeadBody(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const body = { ...(input as Record<string, unknown>) };

  // Mobile-only UI fields — never validated server-side.
  body.statusLabel = undefined;

  if (body.assignedTo === "" || body.assignedTo === null) {
    body.assignedTo = undefined;
  }

  if (typeof body.leadStatus === "string") {
    const normalized = normalizeLeadStatusInput(body.leadStatus);
    if (normalized) body.leadStatus = normalized;
  }

  return body;
}

const updateLeadFieldsSchema = leadWritableFieldsSchema.partial().extend({
  estimatedValue: z.coerce.number().nonnegative().optional().nullable(),
  assignedTo: z.string().uuid().nullable().optional(),
  nextFollowupAt: z.string().datetime({ offset: true }).nullable().optional(),
  /** Mobile pipeline alias for leadStatus (e.g. qualified = Site Visit). */
  stage: z.string().optional(),
  closeReason: z.string().optional(),
  closeReasonNote: z.string().max(500).optional(),
});

export const updateLeadBodySchema = z.preprocess(
  preprocessUpdateLeadBody,
  updateLeadFieldsSchema.transform((data) => {
    const { stage, leadStatus, email, ...rest } = data;
    const resolvedStatus =
      leadStatus ?? (stage ? (normalizeLeadStageInput(stage) ?? undefined) : undefined);

    return {
      ...rest,
      ...(email === "" ? {} : email !== undefined ? { email } : {}),
      ...(resolvedStatus !== undefined ? { leadStatus: resolvedStatus } : {}),
    };
  }),
);

export const assignLeadBodySchema = z.object({
  user_id: z.string().uuid(),
  /**
   * When false, skip recording assignment history (lead assignment rows +
   * assignment timeline entry). Default is true.
   */
  assignWithHistory: z.boolean().optional().default(true),
  /**
   * When true, move Pending (`contacted`), NA (`not_interested`/`dropped`), or stale New
   * leads to status "new" with a fresh 24h New window.
   */
  applyNewStatus: z.boolean().optional().default(false),
});

export const bulkAssignLeadsBodySchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(500),
  userIds: z.array(z.string().uuid()).min(1).max(50),
  /** Skip recording assignment history (lead assignment rows + assignment timeline entry). */
  assignWithHistory: z.boolean().optional().default(true),
  /**
   * When true, move Pending / NA / stale New leads to status "new" with a fresh 24h New window.
   */
  applyNewStatus: z.boolean().optional().default(false),
});

export const addNoteBodySchema = z.object({
  text: z.string().min(1),
});

export const upcomingFollowupsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(60).default(14),
});

export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;

/** Base list filters for stage count aggregation (no stage-specific fields). */
export const leadStageCountsQuerySchema = listLeadsQuerySchema.omit({
  page: true,
  pageSize: true,
  status: true,
  activeOnly: true,
  excludeNew: true,
  followUpDueBefore: true,
  followUpDueAfter: true,
  orderByFollowUp: true,
});

export type LeadStageCountsQuery = z.infer<typeof leadStageCountsQuerySchema>;

/** Same shape as stage counts — shared list filters only. */
export const leadScopeCountsQuerySchema = leadStageCountsQuerySchema;

export type LeadScopeCountsQuery = z.infer<typeof leadScopeCountsQuerySchema>;
export type UpcomingFollowupsQuery = z.infer<typeof upcomingFollowupsQuerySchema>;
/** What to do with assignee when a CSV phone matches an existing lead. */
export const bulkImportOnDuplicateSchema = z.enum(["keep_assignee", "reassign"]);
export type BulkImportOnDuplicate = z.infer<typeof bulkImportOnDuplicateSchema>;

export const bulkImportLeadsBodySchema = z.object({
  leads: z.array(z.record(z.string(), z.unknown())).min(1).max(2000),
  skipDuplicates: z.boolean().optional().default(true),
  /** keep_assignee (default): leave existing agent. reassign: move to selected agent(s). */
  onDuplicate: bulkImportOnDuplicateSchema.optional().default("keep_assignee"),
  /** When reassigning a duplicate, record assignment history (default true). */
  assignWithHistory: z.boolean().optional().default(true),
  /**
   * When merging a duplicate that is Pending / NA / stale New, set status to new (default false).
   * Mirrors bulk-assign `applyNewStatus`.
   */
  applyNewStatus: z.boolean().optional().default(false),
  assignToUserId: z.string().uuid().optional(),
  assignToUserIds: z.array(z.string().uuid()).min(1).max(50).optional(),
  fileName: z.string().max(255).optional(),
  totalCount: z.number().int().min(1).max(2000).optional(),
  invalidCount: z.number().int().min(0).max(2000).optional(),
  parseErrors: z
    .array(
      z.object({
        row: z.number().int().min(1),
        message: z.string(),
      }),
    )
    .max(2000)
    .optional(),
});

export type CreateLeadBody = z.infer<typeof createLeadBodySchema>;
export type CreateLeadInput = CreateLeadBody;
export type UpdateLeadBody = z.infer<typeof updateLeadBodySchema>;
export type BulkImportLeadsBody = z.infer<typeof bulkImportLeadsBodySchema>;
