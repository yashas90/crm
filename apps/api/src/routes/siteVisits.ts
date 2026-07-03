import { getIstDateKey } from "@propninja/types/ist";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import { AUDIT_ACTIONS } from "../lib/auditActions.js";
import { listPaginationSchema } from "../lib/pagination.js";
import { canEditLead } from "../lib/permissions.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { SiteVisitOverlapError, SiteVisitProjectRequiredError } from "../lib/siteVisitTime.js";
import { validate } from "../lib/validate.js";
import type { AuthUser } from "../middleware/auth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";
import { auditFromContext } from "../services/auditService.js";
import { recalculateLeadScore } from "../services/leadScoringService.js";
import { leadService } from "../services/leadService.js";
import { NOTIFICATION_TYPES, createNotificationService } from "../services/notificationService.js";
import {
  getSiteVisitWhatsAppLinks,
  runSiteVisitAutomation,
} from "../services/siteVisitAutomationService.js";
import { siteVisitService } from "../services/siteVisitService.js";

export const siteVisitsRoutes = new Hono();

const visitTimeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Time must be HH:MM or HH:MM:SS");

const createSiteVisitSchema = z.object({
  leadId: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
  unitId: z.string().uuid().nullable().optional(),
  tower: z.string().max(100).nullable().optional(),
  agentId: z.string().uuid().optional(),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  visitTime: visitTimeSchema,
  duration: z.number().int().min(15).max(480).optional(),
  notes: z.string().max(2000).nullable().optional(),
  propertyAddress: z.string().max(500).nullable().optional(),
  meetingLocation: z.string().max(500).nullable().optional(),
  mapsLink: z.string().url().max(2000).nullable().optional().or(z.literal("")),
  customerEmail: z.string().email().max(320).nullable().optional().or(z.literal("")),
});

const updateSiteVisitSchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  unitId: z.string().uuid().nullable().optional(),
  tower: z.string().max(100).nullable().optional(),
  agentId: z.string().uuid().optional(),
  visitDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  visitTime: visitTimeSchema.optional(),
  duration: z.number().int().min(15).max(480).optional(),
  status: z.enum(["scheduled", "completed", "cancelled", "no_show"]).optional(),
  outcome: z
    .enum(["very_interested", "needs_time", "not_interested", "revisit_required"])
    .nullable()
    .optional(),
  outcomeNote: z.string().max(1000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  propertyAddress: z.string().max(500).nullable().optional(),
  meetingLocation: z.string().max(500).nullable().optional(),
  mapsLink: z.string().url().max(2000).nullable().optional().or(z.literal("")),
  customerEmail: z.string().email().max(320).nullable().optional().or(z.literal("")),
});

const listSiteVisitsSchema = listPaginationSchema.extend({
  agentId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  status: z.enum(["scheduled", "completed", "cancelled", "no_show"]).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const calendarSchema = z.object({
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  agentId: z.string().uuid().optional(),
});

function defaultCalendarMonthRange(now = new Date()) {
  const dateFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const dateTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    dateFrom: dateFrom.toISOString().slice(0, 10),
    dateTo: dateTo.toISOString().slice(0, 10),
  };
}

function resolveAgentFilter(authUser: AuthUser, agentId?: string) {
  if (authUser.role === "agent") return authUser.id;
  return agentId;
}

async function notifyVisitScheduled(
  c: Context,
  visit: NonNullable<Awaited<ReturnType<typeof siteVisitService.getById>>>,
  scheduledBy: AuthUser,
) {
  if (visit.agentId === scheduledBy.id) return;

  const notifications = createNotificationService(c.get("db"));
  const leadName = visit.lead ? `${visit.lead.firstName} ${visit.lead.lastName}`.trim() : "Lead";

  await notifications.createNotification(visit.agentId, NOTIFICATION_TYPES.SITE_VISIT_SCHEDULED, {
    siteVisitId: visit.id,
    leadId: visit.leadId,
    leadName,
    visitDate: visit.visitDate,
    visitTime: visit.visitTime,
    property: visit.propertyLabel ?? visit.propertyAddress ?? "Property",
    scheduledBy: scheduledBy.name,
  });
}

function normalizeOptionalUrl(value: string | null | undefined) {
  if (value === "" || value === undefined) return null;
  return value;
}

function normalizeOptionalEmail(value: string | null | undefined) {
  if (value === "" || value === undefined) return null;
  return value;
}

function resolveAutomationEvent(
  existing: NonNullable<Awaited<ReturnType<typeof siteVisitService.getById>>>,
  body: z.infer<typeof updateSiteVisitSchema>,
  visit: NonNullable<Awaited<ReturnType<typeof siteVisitService.getById>>>,
): "updated" | "rescheduled" | "cancelled" | "completed" | null {
  if (body.status === "cancelled" && existing.status !== "cancelled") return "cancelled";
  if (body.status === "completed" && existing.status !== "completed") return "completed";
  const rescheduled =
    (body.visitDate !== undefined && body.visitDate !== existing.visitDate) ||
    (body.visitTime !== undefined && body.visitTime !== existing.visitTime);
  if (rescheduled) return "rescheduled";
  if (
    body.agentId !== undefined ||
    body.duration !== undefined ||
    body.projectId !== undefined ||
    body.unitId !== undefined ||
    body.tower !== undefined ||
    body.notes !== undefined ||
    body.meetingLocation !== undefined ||
    body.mapsLink !== undefined
  ) {
    if (visit.status === "scheduled") return "updated";
  }
  return null;
}

siteVisitsRoutes.get("/summary", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const agentId = resolveAgentFilter(authUser, c.req.query("agentId"));
  const data = await siteVisitService.dashboardSummary(agentId);
  return jsonOk(c, data);
});

siteVisitsRoutes.get("/calendar", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const parsed = calendarSchema.safeParse(c.req.query());
  if (!parsed.success) {
    return jsonError(c, "VALIDATION_ERROR", "Invalid query", 400, parsed.error.flatten());
  }

  const agentId = resolveAgentFilter(authUser, parsed.data.agentId);
  const defaults = defaultCalendarMonthRange();
  const data = await siteVisitService.calendar({
    dateFrom: parsed.data.dateFrom ?? defaults.dateFrom,
    dateTo: parsed.data.dateTo ?? defaults.dateTo,
    agentId,
  });

  return jsonOk(c, data);
});

siteVisitsRoutes.get("/today", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const queryAgentId = c.req.query("agentId");
  const today = getIstDateKey();

  if (authUser.role === "agent") {
    const data = await siteVisitService.listToday(authUser.id);
    return jsonOk(c, data);
  }

  const agentId = queryAgentId;
  const data = await siteVisitService.list({
    agentId,
    date: today,
    pageSize: 500,
  });
  return jsonOk(c, data);
});

siteVisitsRoutes.get("/", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const parsed = listSiteVisitsSchema.safeParse(c.req.query());
  if (!parsed.success) {
    return jsonError(c, "VALIDATION_ERROR", "Invalid query", 400, parsed.error.flatten());
  }

  const params = { ...parsed.data };
  params.agentId = resolveAgentFilter(authUser, params.agentId);

  const data = await siteVisitService.list(params);
  return jsonOk(c, data);
});

siteVisitsRoutes.get("/:id/whatsapp-links", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const visit = await siteVisitService.getById(c.req.param("id"));
  if (!visit) return jsonError(c, "NOT_FOUND", "Site visit not found", 404);
  if (authUser.role === "agent" && visit.agentId !== authUser.id) {
    return jsonError(c, "FORBIDDEN", "Not allowed to view this visit", 403);
  }

  const eventRaw = c.req.query("event") ?? "scheduled";
  const eventSchema = z.enum([
    "scheduled",
    "updated",
    "rescheduled",
    "cancelled",
    "completed",
    "reminder",
  ]);
  const parsedEvent = eventSchema.safeParse(eventRaw);
  if (!parsedEvent.success) {
    return jsonError(c, "VALIDATION_ERROR", "Invalid event", 400);
  }

  const links = await getSiteVisitWhatsAppLinks(visit.id, parsedEvent.data);
  if (!links) return jsonError(c, "NOT_FOUND", "Site visit not found", 404);
  return jsonOk(c, links);
});

siteVisitsRoutes.get("/:id", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const visit = await siteVisitService.getById(c.req.param("id"));
  if (!visit) return jsonError(c, "NOT_FOUND", "Site visit not found", 404);

  if (authUser.role === "agent" && visit.agentId !== authUser.id) {
    return jsonError(c, "FORBIDDEN", "Not allowed to view this visit", 403);
  }

  return jsonOk(c, visit);
});

siteVisitsRoutes.post("/", writeRateLimit, validate("json", createSiteVisitSchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const body = c.req.valid("json");

  const agentId = authUser.role === "agent" ? authUser.id : (body.agentId ?? authUser.id);

  if (authUser.role === "agent" && body.agentId && body.agentId !== authUser.id) {
    return jsonError(c, "FORBIDDEN", "Agents cannot schedule visits for others", 403);
  }

  const lead = await leadService.getLeadById(body.leadId);
  if (!lead) {
    return jsonError(c, "NOT_FOUND", "Lead not found", 404);
  }
  if (!lead.phone?.trim()) {
    return jsonError(
      c,
      "VALIDATION_ERROR",
      "Lead must have a mobile number for site visit WhatsApp",
      400,
    );
  }

  try {
    const visit = await siteVisitService.create({
      leadId: body.leadId,
      projectId: body.projectId,
      unitId: body.unitId,
      tower: body.tower,
      agentId,
      visitDate: body.visitDate,
      visitTime: body.visitTime,
      duration: body.duration,
      notes: body.notes,
      propertyAddress: body.propertyAddress,
      meetingLocation: body.meetingLocation,
      mapsLink: normalizeOptionalUrl(body.mapsLink),
      customerEmail: normalizeOptionalEmail(body.customerEmail),
    });

    if (!visit) return jsonError(c, "SERVER_ERROR", "Failed to create visit", 500);

    void runSiteVisitAutomation(visit.id, "scheduled", { actorUserId: authUser.id }).catch(
      () => undefined,
    );

    await notifyVisitScheduled(c, visit, authUser);

    const leadName = visit.lead ? `${visit.lead.firstName} ${visit.lead.lastName}`.trim() : "Lead";
    await auditFromContext(c, c.get("db"), {
      userId: authUser.id,
      action: AUDIT_ACTIONS.SITE_VISIT_SCHEDULED,
      entityType: "site_visit",
      entityId: visit.id,
      entityName: leadName,
      metadata: {
        leadId: visit.leadId,
        visitDate: visit.visitDate,
        visitTime: visit.visitTime,
      },
    });

    void recalculateLeadScore(body.leadId).catch(() => undefined);

    return jsonOk(c, visit, undefined, 201);
  } catch (err) {
    if (err instanceof SiteVisitOverlapError) {
      return jsonError(c, "VISIT_OVERLAP", err.message, 409);
    }
    throw err;
  }
});

siteVisitsRoutes.patch(
  "/:id",
  writeRateLimit,
  validate("json", updateSiteVisitSchema),
  async (c) => {
    const authUser = c.get("authUser") as AuthUser;
    const body = c.req.valid("json");
    const existing = await siteVisitService.getById(c.req.param("id"));

    if (!existing) return jsonError(c, "NOT_FOUND", "Site visit not found", 404);
    if (authUser.role === "agent" && existing.agentId !== authUser.id) {
      return jsonError(c, "FORBIDDEN", "Not allowed to update this visit", 403);
    }
    if (authUser.role === "agent" && body.agentId && body.agentId !== authUser.id) {
      return jsonError(c, "FORBIDDEN", "Agents cannot reassign visits", 403);
    }

    try {
      const visit = await siteVisitService.update(c.req.param("id"), {
        ...body,
        mapsLink: body.mapsLink !== undefined ? normalizeOptionalUrl(body.mapsLink) : undefined,
        customerEmail:
          body.customerEmail !== undefined ? normalizeOptionalEmail(body.customerEmail) : undefined,
      });
      const automationEvent = visit ? resolveAutomationEvent(existing, body, visit) : null;
      if (visit && automationEvent) {
        void runSiteVisitAutomation(visit.id, automationEvent, { actorUserId: authUser.id }).catch(
          () => undefined,
        );
      }
      if (body.status === "completed" && existing.status !== "completed") {
        const leadName = visit?.lead
          ? `${visit.lead.firstName} ${visit.lead.lastName}`.trim()
          : "Lead";
        await auditFromContext(c, c.get("db"), {
          userId: authUser.id,
          action: AUDIT_ACTIONS.SITE_VISIT_COMPLETED,
          entityType: "site_visit",
          entityId: visit!.id,
          entityName: leadName,
          metadata: {
            leadId: visit!.leadId,
            projectId: visit!.projectId,
            projectName: visit!.project?.name ?? null,
          },
        });
      }
      if (visit?.leadId) {
        void recalculateLeadScore(visit.leadId).catch(() => undefined);
      }
      return jsonOk(c, visit);
    } catch (err) {
      if (err instanceof SiteVisitOverlapError) {
        return jsonError(c, "VISIT_OVERLAP", err.message, 409);
      }
      if (err instanceof SiteVisitProjectRequiredError) {
        return jsonError(c, "VALIDATION_ERROR", err.message, 400);
      }
      throw err;
    }
  },
);

siteVisitsRoutes.delete("/:id", writeRateLimit, async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const visitId = c.req.param("id");
  if (!visitId) {
    return jsonError(c, "NOT_FOUND", "Site visit not found", 404);
  }
  const existing = await siteVisitService.getById(visitId);

  if (!existing) return jsonError(c, "NOT_FOUND", "Site visit not found", 404);
  if (authUser.role === "agent" && existing.agentId !== authUser.id) {
    return jsonError(c, "FORBIDDEN", "Not allowed to cancel this visit", 403);
  }

  const visit = await siteVisitService.cancel(visitId);

  void runSiteVisitAutomation(visitId, "cancelled", { actorUserId: authUser.id }).catch(
    () => undefined,
  );

  const leadName = existing.lead
    ? `${existing.lead.firstName} ${existing.lead.lastName}`.trim()
    : "Lead";
  await auditFromContext(c, c.get("db"), {
    userId: authUser.id,
    action: AUDIT_ACTIONS.SITE_VISIT_CANCELLED,
    entityType: "site_visit",
    entityId: existing.id,
    entityName: leadName,
    metadata: { leadId: existing.leadId },
  });

  return jsonOk(c, visit);
});
