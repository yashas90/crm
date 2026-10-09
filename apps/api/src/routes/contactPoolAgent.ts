import { getIstDayBounds } from "@propninja/types/ist";
import { Hono } from "hono";
import { z } from "zod";
import { CALL_OUTCOMES, PIPELINE_STAGES } from "../lib/contactPool/outcomeRules.js";
import { getDb } from "../lib/db.js";
import { incrementRateLimit } from "../lib/rateLimitStore.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import type { AuthUser } from "../middleware/auth.js";
import {
  addLeadActivity,
  agentLeadStats,
  callingStats,
  getAgentLead,
  listAgentLeads,
  listCallbacks,
  listCallingData,
  logOutcome,
  updateLeadStage,
} from "../services/callingDataService.js";
import { agentRangeReport } from "../services/contactPoolReports.js";
import { getDailyStatus, requestCallingData } from "../services/contactPoolService.js";
import { NOTIFICATION_TYPES, createNotificationService } from "../services/notificationService.js";

export const contactPoolAgentRoutes = new Hono();

function requireAgent(authUser: AuthUser | undefined) {
  if (!authUser) return jsonErrorShape("UNAUTHORIZED", "Missing or invalid token", 401);
  if (authUser.role !== "agent") return jsonErrorShape("FORBIDDEN", "Agent access required", 403);
  return null;
}

function jsonErrorShape(code: string, message: string, status: 401 | 403) {
  return { code, message, status };
}

contactPoolAgentRoutes.use("*", async (c, next) => {
  const authUser = c.get("authUser") as AuthUser | undefined;
  const denied = requireAgent(authUser);
  if (denied) return jsonError(c, denied.code, denied.message, denied.status);
  await next();
});

const filtersSchema = z.object({
  city: z.string().max(80).optional().nullable(),
  minBudget: z.number().nonnegative().optional().nullable(),
  maxBudget: z.number().nonnegative().optional().nullable(),
  propertyType: z.enum(["apartment", "villa", "plot"]).optional().nullable(),
  bedrooms: z.string().max(10).optional().nullable(),
});

contactPoolAgentRoutes.post("/request-data", validate("json", filtersSchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const hits = await incrementRateLimit(`agent-request-data:${authUser.id}`, 60_000);
  if (hits > 5) {
    return jsonError(c, "RATE_LIMITED", "Max 5 data requests per minute", 429);
  }
  const result = await requestCallingData({ agentId: authUser.id, filters: c.req.valid("json") });
  if (result.contactsAssigned > 0) {
    const notifications = createNotificationService(getDb());
    await notifications.createNotification(authUser.id, NOTIFICATION_TYPES.CONTACTS_ASSIGNED, {
      title: "Contacts assigned",
      message: `${result.contactsAssigned} contacts assigned to you. Start calling!`,
      count: result.contactsAssigned,
    });
  }
  return jsonOk(c, result);
});

contactPoolAgentRoutes.get("/daily-status", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  return jsonOk(c, await getDailyStatus(authUser.id));
});

contactPoolAgentRoutes.get("/my-contacts", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  return jsonOk(c, await listCallingData({ agentId: authUser.id, search: c.req.query("search") }));
});

contactPoolAgentRoutes.get("/calling-data/stats", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  return jsonOk(c, await callingStats(authUser.id));
});

contactPoolAgentRoutes.get("/calling-data", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  return jsonOk(c, await listCallingData({ agentId: authUser.id, search: c.req.query("search") }));
});

const outcomeSchema = z.object({
  recordId: z.string().uuid().optional(),
  record_id: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  outcome: z.enum(CALL_OUTCOMES),
  notes: z.string().max(2000).optional().nullable(),
  callbackTime: z.string().optional().nullable(),
  callback_time: z.string().optional().nullable(),
  durationSeconds: z
    .number()
    .int()
    .nonnegative()
    .max(8 * 60 * 60)
    .optional(),
});

contactPoolAgentRoutes.post("/log-outcome", validate("json", outcomeSchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const body = c.req.valid("json");
  const recordId = body.recordId ?? body.record_id;
  if (!recordId) return jsonError(c, "BAD_REQUEST", "record_id is required", 400);
  const result = await logOutcome({
    agentId: authUser.id,
    recordId,
    outcome: body.outcome,
    notes: body.notes,
    callbackTime: body.callbackTime ?? body.callback_time,
    durationSeconds: body.durationSeconds,
  });
  return jsonOk(c, result);
});

contactPoolAgentRoutes.post("/log-call", validate("json", outcomeSchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const body = c.req.valid("json");
  const recordId = body.recordId ?? body.record_id;
  if (!recordId) return jsonError(c, "BAD_REQUEST", "record_id is required", 400);
  return jsonOk(
    c,
    await logOutcome({
      agentId: authUser.id,
      recordId,
      outcome: body.outcome,
      notes: body.notes,
      callbackTime: body.callbackTime ?? body.callback_time,
      durationSeconds: body.durationSeconds,
    }),
  );
});

contactPoolAgentRoutes.post(
  "/create-lead",
  validate("json", z.object({ recordId: z.string().uuid() })),
  async (c) => {
    const authUser = c.get("authUser") as AuthUser;
    const body = c.req.valid("json");
    return jsonOk(
      c,
      await logOutcome({
        agentId: authUser.id,
        recordId: body.recordId,
        outcome: "interested",
      }),
    );
  },
);

contactPoolAgentRoutes.get("/callbacks", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const { end } = getIstDayBounds(0);
  const items = await listCallbacks(authUser.id);
  return jsonOk(c, {
    items,
    due: items.filter(
      (item) => item.callbackScheduledAt && new Date(item.callbackScheduledAt) <= end,
    ),
  });
});

contactPoolAgentRoutes.get("/leads/stats", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  return jsonOk(c, await agentLeadStats(authUser.id));
});

contactPoolAgentRoutes.get("/leads", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  return jsonOk(
    c,
    await listAgentLeads({
      agentId: authUser.id,
      stage: c.req.query("stage"),
      priority: c.req.query("priority"),
      search: c.req.query("search"),
    }),
  );
});

contactPoolAgentRoutes.get("/leads/:leadId", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  return jsonOk(c, await getAgentLead(authUser.id, c.req.param("leadId")));
});

contactPoolAgentRoutes.put(
  "/leads/:leadId/stage",
  validate(
    "json",
    z.object({
      stage: z.enum(PIPELINE_STAGES),
      priority: z.enum(["hot", "warm", "cold"]).optional(),
    }),
  ),
  async (c) => {
    const authUser = c.get("authUser") as AuthUser;
    const body = c.req.valid("json");
    return jsonOk(
      c,
      await updateLeadStage({
        agentId: authUser.id,
        leadId: c.req.param("leadId"),
        stage: body.stage,
        priority: body.priority,
      }),
    );
  },
);

contactPoolAgentRoutes.post(
  "/leads/:leadId/activity",
  validate(
    "json",
    z.object({
      type: z.enum(["call", "note", "meeting", "site_visit", "follow_up"]),
      notes: z.string().max(2000).optional(),
    }),
  ),
  async (c) => {
    const authUser = c.get("authUser") as AuthUser;
    const body = c.req.valid("json");
    return jsonOk(
      c,
      await addLeadActivity({
        agentId: authUser.id,
        leadId: c.req.param("leadId"),
        type: body.type,
        notes: body.notes,
      }),
    );
  },
);

contactPoolAgentRoutes.get("/report", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const range = c.req.query("range");
  const preset = range === "week" || range === "month" ? range : "day";
  return jsonOk(c, await agentRangeReport(authUser.id, preset));
});
