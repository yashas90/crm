import { leadActivities, leads, projectUnits, projects } from "@propninja/db";
import { and, eq, gte, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import type { RevenuePipelineQuery } from "../lib/validators/reports.js";
import { asyncLinesToCsvStream } from "../utils/csvExport.js";
import { FUNNEL_STAGES, buildRevenuePipelineFromRows } from "./revenuePipelineCalculations.js";
import type { RevenuePipelineResult } from "./revenuePipelineCalculations.js";

export type { RevenuePipelineResult };

function projectScopeFilter(projectId?: string) {
  return projectId ? eq(projects.id, projectId) : sql`true`;
}

function unitProjectFilter(projectId?: string) {
  return projectId ? eq(projectUnits.projectId, projectId) : sql`true`;
}

function activeLeadFilter() {
  return and(
    eq(leads.orgId, SINGLE_TENANT_ORG_ID),
    isNull(leads.deletedAt),
    sql`${leads.leadStatus} <> 'lost'`,
  );
}

function leadProjectInterest(projectId: string) {
  return or(
    eq(leads.projectId, projectId),
    sql`exists (
      select 1 from ${projectUnits} pu
      where pu.assigned_lead_id = ${leads.id}
        and pu.project_id = ${projectId}
    )`,
  );
}

function leadHasProjectInterest() {
  return sql`(
    ${leads.projectId} is not null
    or exists (
      select 1 from ${projectUnits} pu
      where pu.assigned_lead_id = ${leads.id}
    )
  )`;
}

export const revenuePipelineService = {
  async getRevenuePipeline(query: RevenuePipelineQuery): Promise<RevenuePipelineResult> {
    const { dateFrom, dateTo, projectId } = query;

    const orgProjects = and(
      eq(projects.orgId, SINGLE_TENANT_ORG_ID),
      isNull(projects.deletedAt),
      projectScopeFilter(projectId),
    );

    const unitScope = unitProjectFilter(projectId);

    const [
      [pipelineRow],
      [confirmedRow],
      [projectedRow],
      unitAggRows,
      leadByProjectRows,
      unitLeadRows,
      stageRows,
      [wonRow],
      [lostRow],
      [avgPriceRow],
    ] = await Promise.all([
      db
        .select({
          total: sql<number>`coalesce(sum(${projectUnits.priceListedRs}), 0)::bigint`,
        })
        .from(projectUnits)
        .innerJoin(leads, eq(projectUnits.assignedLeadId, leads.id))
        .innerJoin(projects, eq(projectUnits.projectId, projects.id))
        .where(and(orgProjects, unitScope, activeLeadFilter())),

      db
        .select({
          total: sql<number>`coalesce(sum(coalesce(${projectUnits.priceFinalRs}, 0)), 0)::bigint`,
        })
        .from(projectUnits)
        .innerJoin(projects, eq(projectUnits.projectId, projects.id))
        .where(and(orgProjects, unitScope, eq(projectUnits.status, "booked"))),

      db
        .select({
          total: sql<number>`coalesce(sum(${projectUnits.priceListedRs}), 0)::bigint`,
        })
        .from(projectUnits)
        .innerJoin(projects, eq(projectUnits.projectId, projects.id))
        .where(and(orgProjects, unitScope, eq(projectUnits.status, "reserved"))),

      db
        .select({
          projectId: projects.id,
          projectName: projects.name,
          availableUnits: sql<number>`count(${projectUnits.id}) filter (where ${projectUnits.status} = 'available')::int`,
          reservedUnits: sql<number>`count(${projectUnits.id}) filter (where ${projectUnits.status} = 'reserved')::int`,
          bookedUnits: sql<number>`count(${projectUnits.id}) filter (where ${projectUnits.status} = 'booked')::int`,
          soldUnits: sql<number>`count(${projectUnits.id}) filter (where ${projectUnits.status} = 'sold')::int`,
          totalListedValue: sql<number>`coalesce(sum(${projectUnits.priceListedRs}), 0)::bigint`,
          totalBookedValue: sql<number>`coalesce(sum(case when ${projectUnits.status} = 'booked' then coalesce(${projectUnits.priceFinalRs}, ${projectUnits.priceListedRs}) else 0 end), 0)::bigint`,
        })
        .from(projects)
        .leftJoin(projectUnits, eq(projectUnits.projectId, projects.id))
        .where(orgProjects)
        .groupBy(projects.id, projects.name)
        .orderBy(projects.name),

      db
        .select({
          projectId: leads.projectId,
          leadId: leads.id,
        })
        .from(leads)
        .where(
          and(
            activeLeadFilter(),
            isNotNull(leads.projectId),
            projectId ? eq(leads.projectId, projectId) : sql`true`,
          ),
        ),

      db
        .select({
          projectId: projectUnits.projectId,
          leadId: projectUnits.assignedLeadId,
        })
        .from(projectUnits)
        .innerJoin(projects, eq(projectUnits.projectId, projects.id))
        .innerJoin(leads, eq(projectUnits.assignedLeadId, leads.id))
        .where(and(orgProjects, unitScope, activeLeadFilter())),

      db
        .select({
          stage: leads.leadStatus,
          leadCount: sql<number>`count(distinct ${leads.id})::int`,
        })
        .from(leads)
        .where(
          and(
            activeLeadFilter(),
            sql`${leads.leadStatus} <> 'won'`,
            projectId ? leadProjectInterest(projectId) : leadHasProjectInterest(),
          ),
        )
        .groupBy(leads.leadStatus),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leadActivities)
        .innerJoin(leads, eq(leadActivities.leadId, leads.id))
        .where(
          and(
            eq(leadActivities.orgId, SINGLE_TENANT_ORG_ID),
            eq(leadActivities.type, "status_change"),
            sql`${leadActivities.metadata}->>'to' = 'won'`,
            gte(leadActivities.createdAt, dateFrom),
            lte(leadActivities.createdAt, dateTo),
            projectId ? leadProjectInterest(projectId) : sql`true`,
          ),
        ),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leadActivities)
        .innerJoin(leads, eq(leadActivities.leadId, leads.id))
        .where(
          and(
            eq(leadActivities.orgId, SINGLE_TENANT_ORG_ID),
            eq(leadActivities.type, "status_change"),
            sql`${leadActivities.metadata}->>'to' = 'lost'`,
            gte(leadActivities.createdAt, dateFrom),
            lte(leadActivities.createdAt, dateTo),
            projectId ? leadProjectInterest(projectId) : sql`true`,
          ),
        ),

      db
        .select({
          avg: sql<string | null>`avg(${projectUnits.priceListedRs})`,
        })
        .from(projectUnits)
        .innerJoin(projects, eq(projectUnits.projectId, projects.id))
        .where(and(orgProjects, unitScope)),
    ]);

    const leadsMap = new Map<string, Set<string>>();
    for (const row of leadByProjectRows) {
      if (!row.projectId) continue;
      const set = leadsMap.get(row.projectId) ?? new Set<string>();
      set.add(row.leadId);
      leadsMap.set(row.projectId, set);
    }
    for (const row of unitLeadRows) {
      if (!row.projectId || !row.leadId) continue;
      const set = leadsMap.get(row.projectId) ?? new Set<string>();
      set.add(row.leadId);
      leadsMap.set(row.projectId, set);
    }

    const stageMap = new Map(stageRows.map((row) => [row.stage, row.leadCount ?? 0]));
    const avgUnitPrice = Number(avgPriceRow?.avg ?? 0);

    const stageCounts = Object.fromEntries(
      FUNNEL_STAGES.map((stage) => [stage, stageMap.get(stage) ?? 0]),
    ) as Partial<Record<string, number>>;

    return buildRevenuePipelineFromRows({
      pipelineTotal: Number(pipelineRow?.total ?? 0),
      confirmedTotal: Number(confirmedRow?.total ?? 0),
      projectedTotal: Number(projectedRow?.total ?? 0),
      avgUnitPrice,
      wonCount: wonRow?.count ?? 0,
      lostCount: lostRow?.count ?? 0,
      projects: unitAggRows.map((row) => ({
        projectId: row.projectId,
        projectName: row.projectName,
        availableUnits: Number(row.availableUnits ?? 0),
        reservedUnits: Number(row.reservedUnits ?? 0),
        bookedUnits: Number(row.bookedUnits ?? 0),
        soldUnits: Number(row.soldUnits ?? 0),
        totalListedValue: Number(row.totalListedValue ?? 0),
        totalBookedValue: Number(row.totalBookedValue ?? 0),
        leadIds: [...(leadsMap.get(row.projectId) ?? [])],
      })),
      stageCounts,
    });
  },

  async exportCsv(query: RevenuePipelineQuery) {
    const data = await this.getRevenuePipeline(query);

    async function* rows() {
      yield "project_id,project_name,available,reserved,booked,sold,listed_value,booked_value,active_leads";
      for (const row of data.byProject) {
        yield [
          row.projectId,
          `"${row.projectName.replace(/"/g, '""')}"`,
          row.availableUnits,
          row.reservedUnits,
          row.bookedUnits,
          row.soldUnits,
          row.totalListedValue,
          row.totalBookedValue,
          row.leads,
        ].join(",");
      }
    }

    return asyncLinesToCsvStream(rows());
  },
};
