import { leads } from "@propninja/db";
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { validate } from "../lib/validate.js";
import type { AuthUser } from "../middleware/auth.js";

export const funnelRoutes = new Hono();

const FUNNEL_STAGES = ["new", "contacted", "qualified", "negotiation", "won"] as const;

const funnelQuerySchema = z.object({
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  assignedTo: z.string().uuid().optional(),
});

funnelRoutes.get("/", validate("query", funnelQuerySchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const db = c.get("db");
  const { dateFrom, dateTo, assignedTo } = c.req.valid("query");

  const conditions = [eq(leads.orgId, SINGLE_TENANT_ORG_ID), isNull(leads.deletedAt)];

  if (dateFrom) conditions.push(gte(leads.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(leads.createdAt, new Date(dateTo)));

  if (authUser.role === "agent") {
    conditions.push(eq(leads.assignedTo, authUser.id));
  } else if (assignedTo) {
    conditions.push(eq(leads.assignedTo, assignedTo));
  }

  // Count per status across entire dataset
  const counts = await db
    .select({
      status: leads.leadStatus,
      count: sql<number>`count(*)::int`,
    })
    .from(leads)
    .where(and(...conditions))
    .groupBy(leads.leadStatus);

  const countMap = new Map(counts.map((r) => [r.status, r.count]));
  const total = counts.reduce((s, r) => s + r.count, 0);

  const stages = FUNNEL_STAGES.map((stage, i) => {
    const count = countMap.get(stage) ?? 0;
    const prevStage = i > 0 ? FUNNEL_STAGES[i - 1] : null;
    const prevCount = prevStage ? (countMap.get(prevStage) ?? 0) : total;
    const conversionFromPrev = prevCount > 0 ? Math.round((count / prevCount) * 100) : 0;
    const conversionFromTop = total > 0 ? Math.round((count / total) * 100) : 0;
    return {
      stage,
      count,
      conversionFromPrev,
      conversionFromTop,
      dropOff: prevCount > 0 ? prevCount - count : 0,
    };
  });

  // Also include terminal statuses for full picture
  const lost = countMap.get("lost") ?? 0;
  const notInterested = countMap.get("not_interested") ?? 0;
  const dropped = countMap.get("dropped") ?? 0;

  // Top close reasons breakdown
  const closeReasons = await db
    .select({
      reason: leads.closeReason,
      count: sql<number>`count(*)::int`,
    })
    .from(leads)
    .where(
      and(
        ...conditions,
        sql`${leads.leadStatus} in ('lost', 'not_interested')`,
        sql`${leads.closeReason} is not null`,
      ),
    )
    .groupBy(leads.closeReason)
    .orderBy(sql`count(*) desc`)
    .limit(10);

  return c.json({
    ok: true,
    data: { total, stages, terminal: { lost, notInterested, dropped }, closeReasons },
  });
});
