import { agentTargets, callRecords, leads, siteVisits } from "@propninja/db";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { validate } from "../lib/validate.js";
import type { AuthUser } from "../middleware/auth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";

export const agentTargetsRoutes = new Hono();

const upsertTargetSchema = z.object({
  userId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be YYYY-MM"),
  targetCalls: z.number().int().min(0).optional().default(0),
  targetSiteVisits: z.number().int().min(0).optional().default(0),
  targetBookings: z.number().int().min(0).optional().default(0),
  targetRevenue: z.number().min(0).optional().default(0),
});

const monthQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
});

agentTargetsRoutes.get("/", validate("query", monthQuerySchema), async (c) => {
  const db = c.get("db");
  const { month } = c.req.valid("query");
  const targetMonth = month ?? new Date().toISOString().slice(0, 7);

  const targets = await db
    .select()
    .from(agentTargets)
    .where(and(eq(agentTargets.orgId, SINGLE_TENANT_ORG_ID), eq(agentTargets.month, targetMonth)));

  const [y, m] = targetMonth.split("-").map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 1);

  const callCounts = await db
    .select({ userId: callRecords.userId, count: sql<number>`count(*)::int` })
    .from(callRecords)
    .where(
      and(
        eq(callRecords.orgId, SINGLE_TENANT_ORG_ID),
        gte(callRecords.startedAt, monthStart),
        lte(callRecords.startedAt, monthEnd),
      ),
    )
    .groupBy(callRecords.userId);

  const visitCounts = await db
    .select({ agentId: siteVisits.agentId, count: sql<number>`count(*)::int` })
    .from(siteVisits)
    .where(
      and(
        eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID),
        gte(siteVisits.visitDate, monthStart.toISOString().slice(0, 10)),
        lte(siteVisits.visitDate, monthEnd.toISOString().slice(0, 10)),
        eq(siteVisits.status, "completed"),
      ),
    )
    .groupBy(siteVisits.agentId);

  const bookingCounts = await db
    .select({ assignedTo: leads.assignedTo, count: sql<number>`count(*)::int` })
    .from(leads)
    .where(
      and(
        eq(leads.orgId, SINGLE_TENANT_ORG_ID),
        eq(leads.leadStatus, "won"),
        gte(leads.updatedAt, monthStart),
        lte(leads.updatedAt, monthEnd),
      ),
    )
    .groupBy(leads.assignedTo);

  const callMap = new Map(callCounts.map((r) => [r.userId, r.count]));
  const visitMap = new Map(visitCounts.map((r) => [r.agentId, r.count]));
  const bookingMap = new Map(bookingCounts.map((r) => [r.assignedTo, r.count]));

  const data = targets.map((t) => ({
    ...t,
    actuals: {
      calls: callMap.get(t.userId) ?? 0,
      siteVisits: visitMap.get(t.userId) ?? 0,
      bookings: bookingMap.get(t.userId) ?? 0,
    },
  }));

  return c.json({ ok: true, data });
});

agentTargetsRoutes.put("/", writeRateLimit, validate("json", upsertTargetSchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  if (authUser.role === "agent") {
    return c.json(
      {
        ok: false,
        error: { code: "FORBIDDEN", message: "Only admins and managers can set targets" },
      },
      403,
    );
  }
  const db = c.get("db");
  const body = c.req.valid("json");

  const [row] = await db
    .insert(agentTargets)
    .values({
      orgId: SINGLE_TENANT_ORG_ID,
      userId: body.userId,
      month: body.month,
      targetCalls: body.targetCalls,
      targetSiteVisits: body.targetSiteVisits,
      targetBookings: body.targetBookings,
      targetRevenue: String(body.targetRevenue),
    })
    .onConflictDoUpdate({
      target: [agentTargets.orgId, agentTargets.userId, agentTargets.month],
      set: {
        targetCalls: body.targetCalls,
        targetSiteVisits: body.targetSiteVisits,
        targetBookings: body.targetBookings,
        targetRevenue: String(body.targetRevenue),
        updatedAt: new Date(),
      },
    })
    .returning();

  return c.json({ ok: true, data: row });
});
