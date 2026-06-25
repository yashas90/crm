import { leads, projectUnits, projects, siteVisits } from "@propninja/db";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { validate } from "../lib/validate.js";

export const projectComparisonRoutes = new Hono();

const querySchema = z.object({
  ids: z.string().min(1),
});

/**
 * GET /api/projects/compare?ids=uuid1,uuid2,uuid3
 * Returns side-by-side stats for up to 5 projects.
 */
projectComparisonRoutes.get("/", validate("query", querySchema), async (c) => {
  const db = c.get("db");
  const { ids } = c.req.valid("query");
  const projectIds = ids
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);

  if (!projectIds.length) {
    return c.json(
      {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "At least one project id required" },
      },
      400,
    );
  }

  const projectRows = await db
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      projectType: projects.projectType,
      builderName: projects.builderName,
      minPrice: projects.minPrice,
      maxPrice: projects.maxPrice,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(and(eq(projects.orgId, SINGLE_TENANT_ORG_ID), inArray(projects.id, projectIds)));

  // Lead counts per project
  const leadCounts = await db
    .select({ projectId: leads.projectId, count: count() })
    .from(leads)
    .where(and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), inArray(leads.projectId, projectIds)))
    .groupBy(leads.projectId);

  // Won (booked) counts
  const wonCounts = await db
    .select({ projectId: leads.projectId, count: count() })
    .from(leads)
    .where(
      and(
        eq(leads.orgId, SINGLE_TENANT_ORG_ID),
        inArray(leads.projectId, projectIds),
        eq(leads.leadStatus, "won"),
      ),
    )
    .groupBy(leads.projectId);

  // Site visit counts
  const visitCounts = await db
    .select({ projectId: siteVisits.projectId, count: count() })
    .from(siteVisits)
    .where(
      and(eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID), inArray(siteVisits.projectId, projectIds)),
    )
    .groupBy(siteVisits.projectId);

  // Completed visit counts
  const completedVisitCounts = await db
    .select({ projectId: siteVisits.projectId, count: count() })
    .from(siteVisits)
    .where(
      and(
        eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID),
        inArray(siteVisits.projectId, projectIds),
        eq(siteVisits.status, "completed"),
      ),
    )
    .groupBy(siteVisits.projectId);

  // Unit inventory breakdown
  const unitBreakdown = await db
    .select({
      projectId: projectUnits.projectId,
      status: projectUnits.status,
      count: count(),
    })
    .from(projectUnits)
    .where(inArray(projectUnits.projectId, projectIds))
    .groupBy(projectUnits.projectId, projectUnits.status);

  // Revenue estimate (sum of estimated_value for won leads)
  const revenueRows = await db
    .select({
      projectId: leads.projectId,
      total: sql<number>`coalesce(sum(${leads.estimatedValue}::numeric), 0)::numeric`,
    })
    .from(leads)
    .where(
      and(
        eq(leads.orgId, SINGLE_TENANT_ORG_ID),
        inArray(leads.projectId, projectIds),
        eq(leads.leadStatus, "won"),
      ),
    )
    .groupBy(leads.projectId);

  // Build maps
  const leadMap = new Map(leadCounts.map((r) => [r.projectId, r.count]));
  const wonMap = new Map(wonCounts.map((r) => [r.projectId, r.count]));
  const visitMap = new Map(visitCounts.map((r) => [r.projectId, r.count]));
  const completedVisitMap = new Map(completedVisitCounts.map((r) => [r.projectId, r.count]));
  const revenueMap = new Map(revenueRows.map((r) => [r.projectId, Number(r.total)]));

  const unitMap = new Map<string, Record<string, number>>();
  for (const row of unitBreakdown) {
    if (!row.projectId) continue;
    const existing = unitMap.get(row.projectId) ?? {};
    existing[row.status] = row.count;
    unitMap.set(row.projectId, existing);
  }

  const data = projectRows.map((p) => {
    const totalLeads = leadMap.get(p.id) ?? 0;
    const wonLeads = wonMap.get(p.id) ?? 0;
    const totalVisits = visitMap.get(p.id) ?? 0;
    const completedVisits = completedVisitMap.get(p.id) ?? 0;
    const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
    const visitToBookingRate =
      completedVisits > 0 ? Math.round((wonLeads / completedVisits) * 100) : 0;

    return {
      ...p,
      stats: {
        totalLeads,
        wonLeads,
        conversionRate,
        totalVisits,
        completedVisits,
        visitToBookingRate,
        estimatedRevenue: revenueMap.get(p.id) ?? 0,
        units: unitMap.get(p.id) ?? {},
      },
    };
  });

  return c.json({ ok: true, data });
});
