import { Hono } from "hono";
import { z } from "zod";
import { notifyLeadAssigned } from "../lib/leadAssignmentNotifications.js";
import { advancedListQueryToServiceParams } from "../lib/leadListQueryMap.js";
import { normalizeStoredPhone } from "../lib/leadPhone.js";
import { listPaginationSchema } from "../lib/pagination.js";
import {
  canAssignLead,
  canBulkUploadLeads,
  canDeleteLead,
  canEditLead,
  canViewLead,
  forbiddenResponse,
} from "../lib/permissions.js";
import { validate } from "../lib/validate.js";
import {
  type ListLeadsQuery,
  addNoteBodySchema,
  assignLeadBodySchema,
  bulkImportLeadsBodySchema,
  createLeadBodySchema,
  leadScopeCountsQuerySchema,
  leadStageCountsQuerySchema,
  listLeadsQuerySchema,
  upcomingFollowupsQuerySchema,
  updateLeadBodySchema,
} from "../lib/validators/leads.js";
import type { AuthUser } from "../middleware/auth.js";
import { leadsCreateRateLimit, leadsPatchRateLimit } from "../middleware/rateLimit.js";
import { logAudit } from "../services/auditService.js";
import { documentService } from "../services/documentService.js";
import { getAssignmentHistory } from "../services/leadAssignmentService.js";
import { leadImportService } from "../services/leadImportService.js";
import { listHotLeads } from "../services/leadScoringService.js";
import { LeadDuplicatePhoneError, leadService } from "../services/leadService.js";
import { createProjectUnitService } from "../services/projectUnitService.js";
import { whatsappService } from "../services/whatsappService.js";

export const leadsRoute = new Hono();

function leadDuplicateFilters(query: Pick<ListLeadsQuery, "duplicatesOnly" | "excludeDuplicates">) {
  if (query.duplicatesOnly) {
    return { duplicatesOnly: true as const };
  }
  if (query.excludeDuplicates === false) {
    return {};
  }
  return { excludeDuplicates: true as const };
}

type JsonContext = {
  json: (body: unknown, status?: number) => Response;
};

async function loadLeadOr404(c: JsonContext, id: string | undefined) {
  if (!id) {
    return {
      lead: null,
      response: c.json(
        { ok: false, error: { code: "VALIDATION_ERROR", message: "Missing lead id" } },
        400,
      ),
    };
  }

  const lead = await leadService.getLeadById(id);
  if (!lead) {
    return {
      lead: null,
      response: c.json({ ok: false, error: { code: "NOT_FOUND", message: "Lead not found" } }, 404),
    };
  }
  return { lead, response: null };
}

leadsRoute.get("/activities/recent", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const data = await leadService.getRecentActivities(10, {
    assignedTo: authUser.role === "agent" ? authUser.id : undefined,
  });
  return c.json({ ok: true, data });
});

leadsRoute.get("/followups/upcoming", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const parsed = upcomingFollowupsQuerySchema.safeParse(c.req.query());

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query",
          details: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  const assignedTo = authUser.role === "agent" ? authUser.id : undefined;
  const data = await leadService.getUpcomingFollowups(parsed.data.days, assignedTo);

  return c.json({ ok: true, data });
});

leadsRoute.get("/scope-counts", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const parsed = leadScopeCountsQuerySchema.safeParse(c.req.query());

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query",
          details: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  const query = parsed.data;

  const rawData = await leadService.getScopeCounts(
    {
      search: query.search,
      projectId: query.projectId,
      importBatchId: query.importBatchId,
      temperature: query.temperature,
      source: query.source,
      adLeadsOnly: query.adLeads,
      tags: query.tags,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      ...advancedListQueryToServiceParams(query),
    },
    {
      userId: authUser.id,
      isAgent: authUser.role === "agent",
    },
  );

  // naleads bucket is admin-only — strip it for non-admins
  const data = authUser.role === "admin" ? rawData : { ...rawData, naleads: undefined };

  return c.json({ ok: true, data });
});

leadsRoute.get("/stage-counts", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const parsed = leadStageCountsQuerySchema.safeParse(c.req.query());

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query",
          details: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  const query = parsed.data;
  const assignedTo =
    authUser.role === "agent" ? authUser.id : query.teamLeads ? undefined : query.assignedTo;
  const teamLeadsExcludingUser =
    query.teamLeads && authUser.role !== "agent" ? authUser.id : undefined;

  const data = await leadService.getStageCounts({
    search: query.search,
    assignedTo,
    teamLeadsExcludingUser,
    projectId: query.projectId,
    importBatchId: query.importBatchId,
    temperature: query.temperature,
    source: query.source,
    adLeadsOnly: query.adLeads,
    tags: query.tags,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    unassigned: query.unassigned,
    deletedOnly: query.deletedOnly,
    ...leadDuplicateFilters(query),
    ...advancedListQueryToServiceParams(query),
  });

  return c.json({ ok: true, data });
});

// List leads: agents always scoped to own assignments (assignedTo query ignored);
// managers/admins may filter by assignedTo.
leadsRoute.get("/", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const parsed = listLeadsQuerySchema.safeParse(c.req.query());

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query",
          details: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  const query = parsed.data;
  const assignedTo =
    authUser.role === "agent" ? authUser.id : query.teamLeads ? undefined : query.assignedTo;
  const teamLeadsExcludingUser =
    query.teamLeads && authUser.role !== "agent" ? authUser.id : undefined;

  const data = await leadService.listLeads({
    status: query.status,
    search: query.search,
    page: query.page,
    pageSize: query.pageSize,
    assignedTo,
    teamLeadsExcludingUser,
    projectId: query.projectId,
    importBatchId: query.importBatchId,
    temperature: query.temperature,
    source: query.source,
    adLeadsOnly: query.adLeads,
    tags: query.tags,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    followUpDueBefore: query.followUpDueBefore,
    followUpDueAfter: query.followUpDueAfter,
    orderByFollowUp: query.orderByFollowUp,
    unassigned: query.unassigned,
    activeOnly: query.activeOnly,
    deletedOnly: query.deletedOnly,
    reEnquiredOnly: query.reEnquiredOnly,
    naLeadsOnly: authUser.role === "admin" ? query.naLeadsOnly : false,
    ...leadDuplicateFilters(query),
    ...advancedListQueryToServiceParams(query),
  });

  return c.json({ ok: true, data });
});

const followUpPatchSchema = z
  .object({
    nextFollowupAt: z.string().datetime({ offset: true }),
    markComplete: z.boolean().optional(),
  })
  .strict();

function scopedAgentId(authUser: AuthUser) {
  return authUser.role === "agent" ? authUser.id : undefined;
}

leadsRoute.get("/overdue", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const items = await leadService.listOverdueLeads(scopedAgentId(authUser));
  return c.json({ ok: true, data: { items, total: items.length } });
});

leadsRoute.get("/cold", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const items = await leadService.listColdLeads(scopedAgentId(authUser));
  return c.json({ ok: true, data: { items, total: items.length } });
});

leadsRoute.get("/hot", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const items = await listHotLeads(scopedAgentId(authUser));
  return c.json({ ok: true, data: { items, total: items.length } });
});

leadsRoute.get("/import-batches", validate("query", listPaginationSchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  if (!canBulkUploadLeads(authUser)) {
    return c.json(forbiddenResponse(), 403);
  }

  const query = c.req.valid("query");
  const result = await leadImportService.listBatches({
    page: query.page,
    pageSize: query.pageSize,
  });
  return c.json({ ok: true, data: result });
});

leadsRoute.get("/import-batches/:id/report", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  if (!canBulkUploadLeads(authUser)) {
    return c.json(forbiddenResponse(), 403);
  }

  const batchId = c.req.param("id");
  const report = await leadImportService.getBatchReportCsv(batchId);
  if (!report) {
    return c.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Import batch not found" } },
      404,
    );
  }

  return c.body(report.content, 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${report.fileName}"`,
  });
});

leadsRoute.post(
  "/bulk-import",
  leadsCreateRateLimit,
  validate("json", bulkImportLeadsBodySchema),
  async (c) => {
    const authUser = c.get("authUser") as AuthUser;

    if (!canBulkUploadLeads(authUser)) {
      return c.json(forbiddenResponse(), 403);
    }

    const body = c.req.valid("json");
    const requestedAssignees: string[] =
      (body.assignToUserIds?.length ?? 0) > 0
        ? body.assignToUserIds!
        : body.assignToUserId
          ? [body.assignToUserId]
          : [authUser.id];

    const assignsToOthers = requestedAssignees.some((id) => id !== authUser.id);
    if (assignsToOthers && !canAssignLead(authUser)) {
      return c.json(forbiddenResponse(), 403);
    }

    const parseErrors = body.parseErrors ?? [];
    const totalCount = body.totalCount ?? body.leads.length + parseErrors.length;
    const invalidFromClient = body.invalidCount ?? parseErrors.length;

    const uniquePhones = new Set<string>();
    for (const row of body.leads) {
      if (typeof row.phone === "string" && row.phone.trim()) {
        try {
          uniquePhones.add(normalizeStoredPhone(row.phone));
        } catch {
          // ignore invalid phones for unique count
        }
      }
    }

    const batch = await leadImportService.createBatch({
      uploadedBy: authUser.id,
      fileName: body.fileName,
      totalCount,
      uniqueCount: uniquePhones.size,
      invalidCount: invalidFromClient,
    });

    try {
      const result = await leadService.bulkCreateLeads({
        rows: body.leads,
        skipDuplicates: body.skipDuplicates,
        assignedToAgents: requestedAssignees,
        actingUserId: authUser.id,
        batchId: batch.id,
      });

      await leadImportService.completeBatch(batch.id, {
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        skippedCount: result.skippedCount,
        failedCount: result.failedCount,
        invalidCount: invalidFromClient,
        report: {
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
          failed: result.failed,
          parseErrors,
        },
      });

      return c.json({ ok: true, data: { ...result, batchId: batch.id } }, 201);
    } catch (err) {
      await leadImportService.failBatch(batch.id, {
        created: [],
        updated: [],
        skipped: [],
        failed: [{ row: 0, message: err instanceof Error ? err.message : "Import failed" }],
        parseErrors,
      });
      throw err;
    }
  },
);

leadsRoute.post("/", leadsCreateRateLimit, validate("json", createLeadBodySchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  try {
    const body = c.req.valid("json");
    const lead = await leadService.createLead(body, {
      assignedTo: authUser.role === "agent" ? authUser.id : undefined,
    });
    return c.json({ ok: true, data: lead }, 201);
  } catch (err) {
    if (err instanceof LeadDuplicatePhoneError) {
      return c.json({ ok: false, error: { code: err.code, message: err.message } }, 409);
    }

    throw err;
  }
});

// canViewLead: admin/manager — any lead; agent — own assigned leads only.
leadsRoute.get("/:id", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id");
  if (!id) {
    return c.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Missing lead id" } },
      400,
    );
  }
  const lead = await leadService.getLeadById(id);

  if (!lead) {
    return c.json({ ok: false, error: { code: "NOT_FOUND", message: "Lead not found" } }, 404);
  }

  if (!canViewLead(authUser, { assignedTo: lead.assignedTo })) {
    return c.json(forbiddenResponse(), 403);
  }

  return c.json({ ok: true, data: lead });
});

leadsRoute.get("/:id/assignments", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id");
  const { lead, response } = await loadLeadOr404(c, id);
  if (response) return response;

  if (!canViewLead(authUser, { assignedTo: lead!.assignedTo })) {
    return c.json(forbiddenResponse(), 403);
  }

  const items = await getAssignmentHistory(id);
  return c.json({ ok: true, data: { items } });
});

leadsRoute.get("/:id/documents", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id");
  const { lead, response } = await loadLeadOr404(c, id);
  if (response) return response;

  if (!canViewLead(authUser, { assignedTo: lead!.assignedTo })) {
    return c.json(forbiddenResponse(), 403);
  }

  const items = await documentService.listLeadDocuments(id);
  return c.json({ ok: true, data: { items } });
});

leadsRoute.get("/:id/linked-unit", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id");
  const { lead, response } = await loadLeadOr404(c, id);
  if (response) return response;

  if (!canViewLead(authUser, { assignedTo: lead!.assignedTo })) {
    return c.json(forbiddenResponse(), 403);
  }

  const unitService = createProjectUnitService(c.get("db"));
  const linked = await unitService.getInterestedUnitForLead(id);
  return c.json({ ok: true, data: linked });
});

leadsRoute.get("/:id/whatsapp-messages", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id");
  const { lead, response } = await loadLeadOr404(c, id);
  if (response) return response;

  if (!canViewLead(authUser, { assignedTo: lead!.assignedTo })) {
    return c.json(forbiddenResponse(), 403);
  }

  const items = await whatsappService.listLeadMessages(id);
  return c.json({ ok: true, data: { items } });
});

leadsRoute.patch("/:id/follow-up", leadsPatchRateLimit, async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id");
  const { lead, response } = await loadLeadOr404(c, id);
  if (response) return response;

  if (!canEditLead(authUser, { assignedTo: lead!.assignedTo })) {
    return c.json(forbiddenResponse(), 403);
  }

  const body = await c.req.json();
  const parsed = followUpPatchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid body",
          details: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  const updated = await leadService.updateFollowUp({
    leadId: lead!.id,
    actingUserId: authUser.id,
    nextFollowupAt: parsed.data.nextFollowupAt,
    markComplete: parsed.data.markComplete,
  });

  if (!updated) {
    return c.json({ ok: false, error: { code: "NOT_FOUND", message: "Lead not found" } }, 404);
  }

  return c.json({ ok: true, data: updated });
});

// canEditLead: admin/manager — any lead; agent — own assigned leads only.
leadsRoute.patch("/:id", leadsPatchRateLimit, async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id");
  const { lead, response } = await loadLeadOr404(c, id);
  if (response) return response;
  if (!id) {
    return c.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Missing lead id" } },
      400,
    );
  }

  if (!canEditLead(authUser, { assignedTo: lead!.assignedTo })) {
    return c.json(forbiddenResponse(), 403);
  }

  const body = await c.req.json();
  const parsed = updateLeadBodySchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid body",
          details: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  try {
    const updated = await leadService.updateLead({
      leadId: id,
      actingUserId: authUser.id,
      payload: parsed.data,
    });

    if (
      updated &&
      parsed.data.assignedTo !== undefined &&
      parsed.data.assignedTo !== lead!.assignedTo &&
      parsed.data.assignedTo
    ) {
      await notifyLeadAssigned(c.get("db"), {
        assigneeId: parsed.data.assignedTo,
        actingUserId: authUser.id,
        assignedByName: authUser.name,
        leadId: id,
        leadName: `${updated.firstName} ${updated.lastName ?? ""}`.trim(),
      });
    }

    return c.json({ ok: true, data: updated });
  } catch (err) {
    if (err instanceof LeadDuplicatePhoneError) {
      return c.json({ ok: false, error: { code: err.code, message: err.message } }, 409);
    }

    throw err;
  }
});

// canDeleteLead: admin only; agents cannot delete leads.
leadsRoute.delete("/:id", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id");
  const { response } = await loadLeadOr404(c, id);
  if (response) return response;

  if (!canDeleteLead(authUser)) {
    return c.json(forbiddenResponse(), 403);
  }

  const deleted = await leadService.softDeleteLead(id);
  if (!deleted) {
    return c.json({ ok: false, error: { code: "NOT_FOUND", message: "Lead not found" } }, 404);
  }

  await logAudit(c.get("db"), {
    userId: authUser.id,
    action: "LEAD_DELETED",
    entityType: "lead",
    entityId: id,
    metadata: {
      name: `${deleted.firstName} ${deleted.lastName}`.trim(),
      phone: deleted.phone,
    },
  });

  return c.json({ ok: true, data: deleted });
});

// canAssignLead: admin, manager, and agent (with edit access to the lead).
leadsRoute.post("/:id/assign", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id");
  const { lead, response } = await loadLeadOr404(c, id);
  if (response) return response;

  if (!canAssignLead(authUser)) {
    return c.json(forbiddenResponse(), 403);
  }

  if (!canEditLead(authUser, { assignedTo: lead!.assignedTo })) {
    return c.json(forbiddenResponse(), 403);
  }

  const body = await c.req.json();
  const parsed = assignLeadBodySchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid body",
          details: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  const assigneeId = parsed.data.user_id;
  const updated = await leadService.assignLead({
    leadId: id,
    userId: assigneeId,
    actingUserId: authUser.id,
  });

  if (!updated) {
    return c.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Lead or assignee not found" } },
      404,
    );
  }

  if (assigneeId !== authUser.id) {
    await notifyLeadAssigned(c.get("db"), {
      assigneeId,
      actingUserId: authUser.id,
      assignedByName: authUser.name,
      leadId: id,
      leadName: `${updated.firstName} ${updated.lastName ?? ""}`.trim(),
    });
  }

  return c.json({ ok: true, data: updated });
});

// canEditLead: admin/manager — any lead; agent — own assigned leads only.
leadsRoute.post("/:id/notes", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id");
  const { lead, response } = await loadLeadOr404(c, id);
  if (response) return response;

  if (!canEditLead(authUser, { assignedTo: lead!.assignedTo })) {
    return c.json(forbiddenResponse(), 403);
  }

  const body = await c.req.json();
  const parsed = addNoteBodySchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid body",
          details: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  const activity = await leadService.addNote({
    leadId: id,
    userId: authUser.id,
    text: parsed.data.text,
  });

  return c.json({ ok: true, data: activity }, 201);
});
