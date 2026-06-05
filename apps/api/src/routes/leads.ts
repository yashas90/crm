import { Hono } from "hono";
import {
  canAssignLead,
  canEditLead,
  canManageUsers,
  canViewLead,
  forbiddenResponse,
} from "../lib/permissions.js";
import { validate } from "../lib/validate.js";
import {
  addNoteBodySchema,
  assignLeadBodySchema,
  createLeadBodySchema,
  listLeadsQuerySchema,
  updateLeadBodySchema,
} from "../lib/validators/leads.js";
import type { AuthUser } from "../middleware/auth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";
import { LeadDuplicatePhoneError, leadService } from "../services/leadService.js";

export const leadsRoute = new Hono();

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
  const data = await leadService.getRecentActivities(10);
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
  const assignedTo = authUser.role === "agent" ? authUser.id : query.assignedTo;

  const data = await leadService.listLeads({
    status: query.status,
    search: query.search,
    page: query.page,
    pageSize: query.pageSize,
    assignedTo,
    temperature: query.temperature,
    source: query.source,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    followUpDueBefore: query.followUpDueBefore,
    orderByFollowUp: query.orderByFollowUp,
  });

  return c.json({ ok: true, data });
});

leadsRoute.post("/", writeRateLimit, validate("json", createLeadBodySchema), async (c) => {
  try {
    const lead = await leadService.createLead(c.req.valid("json"));
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

// canEditLead: admin/manager — any lead; agent — own assigned leads only.
leadsRoute.patch("/:id", writeRateLimit, async (c) => {
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

    return c.json({ ok: true, data: updated });
  } catch (err) {
    if (err instanceof LeadDuplicatePhoneError) {
      return c.json({ ok: false, error: { code: err.code, message: err.message } }, 409);
    }

    throw err;
  }
});

// canManageUsers (admin only): soft-delete lead.
leadsRoute.delete("/:id", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id");
  const { response } = await loadLeadOr404(c, id);
  if (response) return response;

  if (!canManageUsers(authUser)) {
    return c.json(forbiddenResponse(), 403);
  }

  const deleted = await leadService.softDeleteLead(id);
  return c.json({ ok: true, data: deleted });
});

// canAssignLead: admin/manager only; agents cannot reassign leads.
leadsRoute.post("/:id/assign", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id");
  const { response } = await loadLeadOr404(c, id);
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

  const updated = await leadService.assignLead({
    leadId: id,
    userId: parsed.data.user_id,
    actingUserId: authUser.id,
  });

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
