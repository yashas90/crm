import { LEAD_STATUSES } from "@propninja/types/enums";
import { Hono } from "hono";
import { z } from "zod";
import { validate } from "../lib/validate.js";
import type { AuthUser } from "../middleware/auth.js";
import {
  SLA_DEFAULT_INACTIVE_DAYS,
  SLA_THRESHOLD_DAYS,
  slaService,
} from "../services/slaService.js";

export const slaRoutes = new Hono();

const slaQuerySchema = z.object({
  inactiveDays: z.coerce.number().int().min(1).max(365).default(SLA_DEFAULT_INACTIVE_DAYS),
  status: z.enum(LEAD_STATUSES).optional(),
  assignedTo: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

slaRoutes.get("/config", async (c) => {
  return c.json({
    ok: true,
    data: {
      defaultInactiveDays: SLA_DEFAULT_INACTIVE_DAYS,
      thresholds: [...SLA_THRESHOLD_DAYS],
      activeStatuses: ["new", "contacted", "qualified", "negotiation"],
    },
  });
});

slaRoutes.get("/summary", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const data = await slaService.getSummary(
    authUser.role === "agent" ? { agentOnlyUserId: authUser.id } : undefined,
  );
  return c.json({ ok: true, data });
});

slaRoutes.get("/breached", validate("query", slaQuerySchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const query = c.req.valid("query");

  const data = await slaService.listBreached({
    inactiveDays: query.inactiveDays,
    status: query.status,
    assignedTo: authUser.role === "agent" ? undefined : query.assignedTo,
    agentOnlyUserId: authUser.role === "agent" ? authUser.id : undefined,
    page: query.page,
    pageSize: query.pageSize,
  });

  return c.json({ ok: true, data });
});
