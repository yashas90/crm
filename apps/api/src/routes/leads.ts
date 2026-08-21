import { Hono } from "hono";
import { z } from "zod";
import { assertAgentAssigneeAllowed, assertAgentAssigneesAllowed } from "../lib/agentLeadAssign.js";
import { capExportRows, enforceCsvExportGate } from "../lib/csvExportGate.js";
import { notifyBulkLeadsAssigned, notifyLeadAssigned } from "../lib/leadAssignmentNotifications.js";
import { advancedListQueryToServiceParams } from "../lib/leadListQueryMap.js";
import {
  maskLeadContactFields,
  maskLeadList,
  stripMaskedContactUpdates,
} from "../lib/leadMasking.js";
import { normalizeStoredPhone } from "../lib/leadPhone.js";
import { listPaginationSchema } from "../lib/pagination.js";
import {
  canAssignLead,
  canBulkUploadLeads,
  canDeleteLead,
  canEditLead,
  canExportLeads,
  canViewLead,
  forbiddenResponse,
  isAdmin,
  leadNotFoundResponse,
} from "../lib/permissions.js";
import { validate } from "../lib/validate.js";
import {
  type ListLeadsQuery,
  addNoteBodySchema,
  assignLeadBodySchema,
  bulkAssignLeadsBodySchema,
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
import {
  getLeadScoreBreakdown,
  getScoringConfig,
  getScoringStats,
  listHotLeads,
  recalculateAllActiveLeadScores,
  recalculateLeadScore,
} from "../services/leadScoringService.js";
import { LeadDuplicatePhoneError, leadService } from "../services/leadService.js";
import { createProjectUnitService } from "../services/projectUnitService.js";
import { whatsappService } from "../services/whatsappService.js";
import { autoAssignLead } from "./assignmentRules.js";

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

/** Agents always see only leads assigned to them; ignore cross-book list flags. */
function resolveListAssignmentScope(
  authUser: AuthUser,
  query: Pick<ListLeadsQuery, "assignedTo" | "teamLeads" | "unassigned">,
) {
  if (authUser.role === "agent") {
    return {
      assignedTo: authUser.id,
      teamLeadsExcludingUser: undefined as string | undefined,
      unassigned: false as const,
    };
  }
  return {
    assignedTo: query.teamLeads ? undefined : query.assignedTo,
    teamLeadsExcludingUser: query.teamLeads ? authUser.id : undefined,
    unassigned: query.unassigned,
  };
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

async function loadLeadForView(c: JsonContext, id: string | undefined, authUser: AuthUser) {
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
  if (!lead || !canViewLead(authUser, { assignedTo: lead.assignedTo })) {
    return { lead: null, response: c.json(leadNotFoundResponse(), 404) };
  }

  return { lead, response: null };
}

async function loadLeadForEdit(c: JsonContext, id: string | undefined, authUser: AuthUser) {
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
  if (!lead || !canEditLead(authUser, { assignedTo: lead.assignedTo })) {
    return { lead: null, response: c.json(leadNotFoundResponse(), 404) };
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
  const { assignedTo, teamLeadsExcludingUser, unassigned } = resolveListAssignmentScope(
    authUser,
    query,
  );

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
    unassigned,
    deletedOnly: query.deletedOnly,
    ...leadDuplicateFilters(query),
    ...advancedListQueryToServiceParams(query),
  });

  return c.json({ ok: true, data });
});

leadsRoute.get("/tab-counts", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const scopeParsed = leadScopeCountsQuerySchema.safeParse(c.req.query());
  const stageParsed = leadStageCountsQuerySchema.safeParse(c.req.query());

  if (!scopeParsed.success || !stageParsed.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query",
          details: scopeParsed.error ?? stageParsed.error,
        },
      },
      400,
    );
  }

  const scopeQuery = scopeParsed.data;
  const stageQuery = stageParsed.data;
  const { assignedTo, teamLeadsExcludingUser, unassigned } = resolveListAssignmentScope(
    authUser,
    stageQuery,
  );

  const scopeFilterBase = {
    search: scopeQuery.search,
    projectId: scopeQuery.projectId,
    importBatchId: scopeQuery.importBatchId,
    temperature: scopeQuery.temperature,
    source: scopeQuery.source,
    adLeadsOnly: scopeQuery.adLeads,
    tags: scopeQuery.tags,
    dateFrom: scopeQuery.dateFrom,
    dateTo: scopeQuery.dateTo,
    ...advancedListQueryToServiceParams(scopeQuery),
  };

  const stageFilterBase = {
    search: stageQuery.search,
    assignedTo,
    teamLeadsExcludingUser,
    projectId: stageQuery.projectId,
    importBatchId: stageQuery.importBatchId,
    temperature: stageQuery.temperature,
    source: stageQuery.source,
    adLeadsOnly: stageQuery.adLeads,
    tags: stageQuery.tags,
    dateFrom: stageQuery.dateFrom,
    dateTo: stageQuery.dateTo,
    unassigned,
    deletedOnly: stageQuery.deletedOnly,
    ...leadDuplicateFilters(stageQuery),
    ...advancedListQueryToServiceParams(stageQuery),
  };

  const data = await leadService.getTabCounts(scopeFilterBase, stageFilterBase, {
    userId: authUser.id,
    isAgent: authUser.role === "agent",
    isAdmin: authUser.role === "admin",
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
  const { assignedTo, teamLeadsExcludingUser, unassigned } = resolveListAssignmentScope(
    authUser,
    query,
  );

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
    unassigned,
    activeOnly: query.activeOnly,
    excludeNew: query.excludeNew,
    deletedOnly: query.deletedOnly,
    reEnquiredOnly: query.reEnquiredOnly,
    naLeadsOnly: authUser.role === "admin" ? query.naLeadsOnly : false,
    ...leadDuplicateFilters(query),
    ...advancedListQueryToServiceParams(query),
  });

  return c.json({
    ok: true,
    data: {
      ...data,
      items: maskLeadList(authUser, data.items),
    },
  });
});

leadsRoute.get("/export", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  if (!canExportLeads(authUser)) {
    return c.json(forbiddenResponse(), 403);
  }

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
  const { assignedTo, teamLeadsExcludingUser, unassigned } = resolveListAssignmentScope(
    authUser,
    query,
  );

  const maxRows = capExportRows(authUser.role);
  const { csv, rowCount } = await leadService.exportCsv({
    status: query.status,
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
    followUpDueBefore: query.followUpDueBefore,
    followUpDueAfter: query.followUpDueAfter,
    unassigned,
    activeOnly: query.activeOnly,
    excludeNew: query.excludeNew,
    deletedOnly: query.deletedOnly,
    reEnquiredOnly: query.reEnquiredOnly,
    naLeadsOnly: authUser.role === "admin" ? query.naLeadsOnly : false,
    maxRows,
    ...leadDuplicateFilters(query),
    ...advancedListQueryToServiceParams(query),
  });

  const gateResponse = await enforceCsvExportGate(c, authUser, {
    exportKind: "leads",
    filters: query,
    rowCount,
  });
  if (gateResponse) return gateResponse;

  const date = new Date().toISOString().slice(0, 10);
  return c.body(csv, 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="leads-${date}.csv"`,
  });
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
  return c.json({
    ok: true,
    data: { items: maskLeadList(authUser, items), total: items.length },
  });
});

leadsRoute.get("/cold", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const items = await leadService.listColdLeads(scopedAgentId(authUser));
  return c.json({
    ok: true,
    data: { items: maskLeadList(authUser, items), total: items.length },
  });
});

leadsRoute.get("/hot", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 100);
  const items = await listHotLeads(scopedAgentId(authUser), limit);
  return c.json({
    ok: true,
    data: { items: maskLeadList(authUser, items), total: items.length },
  });
});

leadsRoute.get("/scoring/config", async (c) => {
  const data = await getScoringConfig();
  return c.json({ ok: true, data });
});

leadsRoute.get("/scoring/stats", async (c) => {
  const data = await getScoringStats();
  return c.json({ ok: true, data });
});

leadsRoute.post("/scoring/recalculate", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  if (authUser.role === "agent") {
    return c.json(forbiddenResponse(), 403);
  }
  const result = await recalculateAllActiveLeadScores();
  return c.json({ ok: true, data: result });
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
  const report = await leadImportService.getBatchReportCsv(batchId, {
    maskPhones: !isAdmin(authUser),
  });
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
        onDuplicate: body.onDuplicate,
        assignWithHistory: body.assignWithHistory,
        applyNewStatus: body.applyNewStatus,
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

      await notifyBulkLeadsAssigned(c.get("db"), {
        assignments: result.assignmentCounts,
        actingUserId: authUser.id,
        assignedByName: authUser.name,
        source: "bulk_import",
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

    // Auto-assign via rules when admin/manager creates a lead without explicit assignee
    let assignedTo = authUser.role === "agent" ? authUser.id : undefined;
    if (!assignedTo && authUser.role !== "agent") {
      const autoAssignee = await autoAssignLead(c.get("db"), {
        leadSource: body.leadSource,
        city: body.city,
      });
      if (autoAssignee) assignedTo = autoAssignee;
    }

    const lead = await leadService.createLead(body, { assignedTo });
    void recalculateLeadScore(lead.id).catch(() => undefined);
    return c.json({ ok: true, data: maskLeadContactFields(authUser, lead) }, 201);
  } catch (err) {
    if (err instanceof LeadDuplicatePhoneError) {
      return c.json({ ok: false, error: { code: err.code, message: err.message } }, 409);
    }

    throw err;
  }
});

// canViewLead: admin/manager — any lead; agent — own assigned leads only.
leadsRoute.get("/:id/score", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id");
  const { lead, response } = await loadLeadForView(c, id, authUser);
  if (response) return response;

  const breakdown = await getLeadScoreBreakdown(id);
  if (!breakdown) {
    return c.json({
      ok: true,
      data: {
        enabled: false,
        score: lead?.score ?? 0,
        factors: [] as { label: string; points: number }[],
      },
    });
  }

  return c.json({
    ok: true,
    data: {
      enabled: true,
      score: breakdown.score,
      factors: breakdown.factors,
    },
  });
});

leadsRoute.get("/:id", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id");
  const { lead, response } = await loadLeadForView(c, id, authUser);
  if (response) return response;
  return c.json({ ok: true, data: maskLeadContactFields(authUser, lead!) });
});

/**
 * Reveal full phone for dialing / WhatsApp only. List & detail stay masked for non-admins.
 * Requires canViewLead (assigned agent, manager, or admin).
 */
leadsRoute.get("/:id/dial-phone", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id");
  const which = c.req.query("which") === "secondary" ? "secondary" : "primary";
  const { lead, response } = await loadLeadForView(c, id, authUser);
  if (response) return response;

  const phone = which === "secondary" ? (lead!.secondaryPhone ?? null) : (lead!.phone ?? null);
  if (!phone) {
    return c.json(
      { ok: false, error: { code: "NOT_FOUND", message: "No phone number on this lead" } },
      404,
    );
  }

  return c.json({
    ok: true,
    data: {
      leadId: lead!.id,
      which,
      phone,
    },
  });
});

leadsRoute.get("/:id/assignments", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id");
  const { response } = await loadLeadForView(c, id, authUser);
  if (response) return response;

  const items = await getAssignmentHistory(id!);
  return c.json({ ok: true, data: { items } });
});

leadsRoute.get("/:id/documents", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id");
  const { response } = await loadLeadForView(c, id, authUser);
  if (response) return response;

  const items = await documentService.listLeadDocuments(id!);
  return c.json({ ok: true, data: { items } });
});

leadsRoute.get("/:id/linked-unit", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id");
  const { response } = await loadLeadForView(c, id, authUser);
  if (response) return response;

  const unitService = createProjectUnitService(c.get("db"));
  const linked = await unitService.getInterestedUnitForLead(id!);
  if (!linked) {
    return c.json({ ok: true, data: null });
  }

  let bookingDocument = null;
  if (linked.status === "booked" || linked.status === "sold") {
    const { createBookingDocumentService } = await import("../services/bookingDocumentService.js");
    const doc = await createBookingDocumentService(c.get("db")).getLatestForUnit(linked.id);
    if (doc) {
      bookingDocument = {
        id: doc.id,
        bookingRef: doc.bookingRef,
        fileKey: doc.fileKey,
        fileUrl: doc.fileUrl,
        generatedAt: doc.generatedAt.toISOString(),
      };
    }
  }

  return c.json({ ok: true, data: { ...linked, bookingDocument } });
});

leadsRoute.get("/:id/whatsapp-messages", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id");
  const { response } = await loadLeadForView(c, id, authUser);
  if (response) return response;

  const items = await whatsappService.listLeadMessages(id!);
  return c.json({ ok: true, data: { items } });
});

leadsRoute.patch("/:id/follow-up", leadsPatchRateLimit, async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id");
  const { lead, response } = await loadLeadForEdit(c, id, authUser);
  if (response) return response;

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
  const { lead, response } = await loadLeadForEdit(c, id, authUser);
  if (response) return response;
  if (!id) {
    return c.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Missing lead id" } },
      400,
    );
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

  if (parsed.data.assignedTo !== undefined && parsed.data.assignedTo !== lead!.assignedTo) {
    if (!canAssignLead(authUser)) {
      return c.json(forbiddenResponse(), 403);
    }
    const assigneeGate = await assertAgentAssigneeAllowed(authUser, parsed.data.assignedTo);
    if (!assigneeGate.ok) {
      return c.json(
        { ok: false, error: { code: "FORBIDDEN", message: assigneeGate.message } },
        403,
      );
    }
  }

  const safePayload = stripMaskedContactUpdates(parsed.data);

  const terminalStatuses = ["lost", "not_interested"] as const;
  const updatePayload =
    safePayload.leadStatus &&
    (terminalStatuses as readonly string[]).includes(safePayload.leadStatus) &&
    !safePayload.closeReason
      ? { ...safePayload, closeReason: "other" }
      : safePayload;

  try {
    const updated = await leadService.updateLead({
      leadId: id,
      actingUserId: authUser.id,
      payload: updatePayload,
    });

    if (
      updated &&
      safePayload.assignedTo !== undefined &&
      safePayload.assignedTo !== lead!.assignedTo &&
      safePayload.assignedTo
    ) {
      await notifyLeadAssigned(c.get("db"), {
        assigneeId: safePayload.assignedTo,
        actingUserId: authUser.id,
        assignedByName: authUser.name,
        leadId: id,
        leadName: `${updated.firstName} ${updated.lastName ?? ""}`.trim(),
      });
    }

    return c.json({ ok: true, data: maskLeadContactFields(authUser, updated!) });
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
leadsRoute.post("/bulk-assign", validate("json", bulkAssignLeadsBodySchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;

  if (!canAssignLead(authUser)) {
    return c.json(forbiddenResponse(), 403);
  }

  const body = c.req.valid("json");
  const assigneeGate = await assertAgentAssigneesAllowed(authUser, body.userIds);
  if (!assigneeGate.ok) {
    return c.json({ ok: false, error: { code: "FORBIDDEN", message: assigneeGate.message } }, 403);
  }

  const permittedLeadIds: string[] = [];
  const permissionFailed: { id: string; message: string }[] = [];

  for (const leadId of body.leadIds) {
    const lead = await leadService.getLeadById(leadId);
    if (!lead || !canEditLead(authUser, { assignedTo: lead.assignedTo })) {
      permissionFailed.push({ id: leadId, message: "Lead not found" });
      continue;
    }
    permittedLeadIds.push(leadId);
  }

  const result = await leadService.bulkAssignLeads({
    leadIds: permittedLeadIds,
    userIds: body.userIds,
    actingUserId: authUser.id,
    assignWithHistory: body.assignWithHistory,
    applyNewStatus: body.applyNewStatus,
  });

  await notifyBulkLeadsAssigned(c.get("db"), {
    assignments: result.assignmentCounts,
    actingUserId: authUser.id,
    assignedByName: authUser.name,
    source: "bulk_assign",
  });

  return c.json({
    ok: true,
    data: {
      succeeded: result.succeeded,
      failed: [...permissionFailed, ...result.failed],
    },
  });
});

// canAssignLead: admin, manager, and agent (with edit access to the lead).
leadsRoute.post("/:id/assign", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id");
  const { response } = await loadLeadForEdit(c, id, authUser);
  if (response) return response;

  if (!canAssignLead(authUser)) {
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
  const assignWithHistory = parsed.data.assignWithHistory;
  const applyNewStatus = parsed.data.applyNewStatus;
  const assigneeGate = await assertAgentAssigneeAllowed(authUser, assigneeId);
  if (!assigneeGate.ok) {
    return c.json({ ok: false, error: { code: "FORBIDDEN", message: assigneeGate.message } }, 403);
  }

  const updated = await leadService.assignLead({
    leadId: id,
    userId: assigneeId,
    actingUserId: authUser.id,
    assignWithHistory,
    applyNewStatus,
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
  const { response } = await loadLeadForEdit(c, id, authUser);
  if (response) return response;

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
