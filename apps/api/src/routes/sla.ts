import { leads, users } from "@propninja/db";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { validate } from "../lib/validate.js";
import type { AuthUser } from "../middleware/auth.js";

export const slaRoutes = new Hono();

const slaQuerySchema = z.object({
  inactiveDays: z.coerce.number().int().min(1).max(365).default(3),
  status: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

slaRoutes.get("/breached", validate("query", slaQuerySchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const db = c.get("db");
  const { inactiveDays, status, assignedTo, page, pageSize } = c.req.valid("query");

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - inactiveDays);

  const activeStatuses = ["new", "contacted", "qualified", "negotiation"];

  const conditions = [
    eq(leads.orgId, SINGLE_TENANT_ORG_ID),
    isNull(leads.deletedAt),
    // Only flag active (non-terminal) leads
    sql`${leads.leadStatus} = any(${activeStatuses})`,
    // No activity since cutoff — use lastActivityAt if set, else createdAt
    sql`coalesce(${leads.lastActivityAt}, ${leads.createdAt}) < ${cutoff}`,
  ];

  if (status) conditions.push(eq(leads.leadStatus, status));

  if (authUser.role === "agent") {
    conditions.push(eq(leads.assignedTo, authUser.id));
  } else if (assignedTo) {
    conditions.push(eq(leads.assignedTo, assignedTo));
  }

  const offset = (page - 1) * pageSize;

  const rows = await db
    .select({
      id: leads.id,
      firstName: leads.firstName,
      lastName: leads.lastName,
      phone: leads.phone,
      leadStatus: leads.leadStatus,
      assignedTo: leads.assignedTo,
      lastActivityAt: leads.lastActivityAt,
      createdAt: leads.createdAt,
      inactiveSince: sql<string>`coalesce(${leads.lastActivityAt}, ${leads.createdAt})`,
      daysSinceActivity: sql<number>`
        extract(day from now() - coalesce(${leads.lastActivityAt}, ${leads.createdAt}))::int
      `,
    })
    .from(leads)
    .where(and(...conditions))
    .orderBy(sql`coalesce(${leads.lastActivityAt}, ${leads.createdAt}) asc`)
    .limit(pageSize)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(...conditions));

  return c.json({ ok: true, data: { items: rows, total, page, pageSize, inactiveDays } });
});

slaRoutes.get("/summary", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const db = c.get("db");

  const activeStatuses = ["new", "contacted", "qualified", "negotiation"];
  const baseConditions = [
    eq(leads.orgId, SINGLE_TENANT_ORG_ID),
    isNull(leads.deletedAt),
    sql`${leads.leadStatus} = any(${activeStatuses})`,
  ];
  if (authUser.role === "agent") {
    baseConditions.push(eq(leads.assignedTo, authUser.id));
  }

  const thresholds = [1, 3, 7, 14];
  const result: Record<string, number> = {};

  for (const days of thresholds) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(
        and(
          ...baseConditions,
          sql`coalesce(${leads.lastActivityAt}, ${leads.createdAt}) < ${cutoff}`,
        ),
      );
    result[`inactive_${days}d`] = count;
  }

  return c.json({ ok: true, data: result });
});
