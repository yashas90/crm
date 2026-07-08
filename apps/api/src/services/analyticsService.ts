import {
  bookingDocuments,
  callRecords,
  leadActivities,
  leads,
  projectUnits,
  projects,
  siteVisits,
  users,
  whatsappMessages,
} from "@propninja/db";
import { LEAD_STATUSES } from "@propninja/types/enums";
import { and, asc, desc, eq, gte, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { buildAnalyticsSourceCounts } from "../lib/analyticsSourceGroups.js";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { coldCutoffDate } from "../lib/followUp.js";
import { priorPeriod } from "../lib/reportScope.js";
import type { AnalyticsOverviewQuery } from "../lib/validators/analytics.js";
import { leadService } from "./leadService.js";

type DateRange = { dateFrom: Date; dateTo: Date };

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Cast a JS Date to a bound timestamptz so postgres.js can serialize it in raw SQL. */
function tstz(date: Date) {
  return sql`${date.toISOString()}::timestamptz`;
}

type KpiValue = {
  value: number;
  previousValue: number;
  changePercent: number | null;
};

type LeadPreview = {
  id: string;
  name: string;
  phone: string | null;
  agentName: string | null;
  leadStatus: string;
  daysSinceContact?: number;
  daysOverdue?: number;
  daysInStage?: number;
};

const CALL_OUTCOMES = ["answered", "no_answer", "busy", "left_voicemail"] as const;

const OUTCOME_LABELS: Record<(typeof CALL_OUTCOMES)[number], string> = {
  answered: "Answered",
  no_answer: "No Answer",
  busy: "Busy",
  left_voicemail: "Voicemail",
};

function leadBaseFilter() {
  return and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), isNull(leads.deletedAt));
}

function activeLeadFilter() {
  return and(leadBaseFilter(), sql`${leads.leadStatus} not in ('won', 'lost')`);
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function kpi(current: number, previous: number): KpiValue {
  return {
    value: current,
    previousValue: previous,
    changePercent: pctChange(current, previous),
  };
}

function leadNameExpr() {
  return sql<string>`trim(coalesce(${leads.firstName}, '') || ' ' || coalesce(${leads.lastName}, ''))`;
}

function daysSince(from: Date | null, now = new Date()) {
  if (!from) return 0;
  return Math.floor((now.getTime() - from.getTime()) / 86_400_000);
}

async function countTotalLeads(range: DateRange) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(
      and(
        leadBaseFilter(),
        gte(leads.createdAt, range.dateFrom),
        lte(leads.createdAt, range.dateTo),
      ),
    );
  return row?.count ?? 0;
}

async function countLeadsContacted(range: DateRange) {
  const [row] = await db
    .select({ count: sql<number>`count(distinct ${leads.id})::int` })
    .from(leads)
    .where(
      and(
        leadBaseFilter(),
        or(
          sql`exists (
            select 1 from ${callRecords} cr
            where cr.lead_id = ${leads.id}
              and cr.org_id = ${SINGLE_TENANT_ORG_ID}
              and cr.started_at >= ${tstz(range.dateFrom)}
              and cr.started_at <= ${tstz(range.dateTo)}
          )`,
          sql`exists (
            select 1 from ${whatsappMessages} wm
            where wm.lead_id = ${leads.id}
              and wm.org_id = ${SINGLE_TENANT_ORG_ID}
              and wm.sent_at >= ${tstz(range.dateFrom)}
              and wm.sent_at <= ${tstz(range.dateTo)}
          )`,
        ),
      ),
    );
  return row?.count ?? 0;
}

async function countSiteVisits(status: "scheduled" | "completed", range: DateRange) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(siteVisits)
    .where(
      and(
        eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID),
        eq(siteVisits.status, status),
        gte(siteVisits.visitDate, sql`${toDateKey(range.dateFrom)}::date`),
        lte(siteVisits.visitDate, sql`${toDateKey(range.dateTo)}::date`),
      ),
    );
  return row?.count ?? 0;
}

async function countLeadsWon(range: DateRange) {
  const [row] = await db
    .select({ count: sql<number>`count(distinct ${leadActivities.leadId})::int` })
    .from(leadActivities)
    .where(
      and(
        eq(leadActivities.orgId, SINGLE_TENANT_ORG_ID),
        eq(leadActivities.type, "status_change"),
        sql`${leadActivities.metadata}->>'to' = 'won'`,
        gte(leadActivities.createdAt, range.dateFrom),
        lte(leadActivities.createdAt, range.dateTo),
      ),
    );
  return row?.count ?? 0;
}

async function countTotalCalls(range: DateRange) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(callRecords)
    .where(
      and(
        eq(callRecords.orgId, SINGLE_TENANT_ORG_ID),
        gte(callRecords.startedAt, range.dateFrom),
        lte(callRecords.startedAt, range.dateTo),
      ),
    );
  return row?.count ?? 0;
}

async function avgResponseTimeHours(range: DateRange) {
  const firstCalls = db
    .select({
      leadId: callRecords.leadId,
      firstCallAt: sql<Date>`min(${callRecords.startedAt})`.as("first_call_at"),
    })
    .from(callRecords)
    .where(and(eq(callRecords.orgId, SINGLE_TENANT_ORG_ID), isNotNull(callRecords.leadId)))
    .groupBy(callRecords.leadId)
    .as("first_calls");

  const [row] = await db
    .select({
      avgHours: sql<number>`coalesce(avg(extract(epoch from (${firstCalls.firstCallAt} - ${leads.createdAt})) / 3600.0), 0)`,
    })
    .from(leads)
    .innerJoin(firstCalls, eq(firstCalls.leadId, leads.id))
    .where(
      and(
        leadBaseFilter(),
        gte(leads.createdAt, range.dateFrom),
        lte(leads.createdAt, range.dateTo),
      ),
    );

  return Math.round(Number(row?.avgHours ?? 0) * 10) / 10;
}

async function getLeadKpis(range: DateRange, prior: DateRange) {
  const [totalLeads, prevTotalLeads, leadsContacted, prevLeadsContacted, leadsWon, prevLeadsWon] =
    await Promise.all([
      countTotalLeads(range),
      countTotalLeads(prior),
      countLeadsContacted(range),
      countLeadsContacted(prior),
      countLeadsWon(range),
      countLeadsWon(prior),
    ]);

  const conversionRate = totalLeads > 0 ? Math.round((leadsWon / totalLeads) * 1000) / 10 : 0;
  const prevConversionRate =
    prevTotalLeads > 0 ? Math.round((prevLeadsWon / prevTotalLeads) * 1000) / 10 : 0;

  return {
    totalLeads: kpi(totalLeads, prevTotalLeads),
    leadsContacted: kpi(leadsContacted, prevLeadsContacted),
    leadsWon: kpi(leadsWon, prevLeadsWon),
    conversionRate: kpi(conversionRate, prevConversionRate),
  };
}

async function getCallKpis(range: DateRange, prior: DateRange) {
  const [totalCalls, prevTotalCalls, avgResponseHours, prevAvgResponseHours] = await Promise.all([
    countTotalCalls(range),
    countTotalCalls(prior),
    avgResponseTimeHours(range),
    avgResponseTimeHours(prior),
  ]);

  return {
    totalCalls: kpi(totalCalls, prevTotalCalls),
    avgResponseTimeHours: kpi(avgResponseHours, prevAvgResponseHours),
  };
}

async function getVisitKpis(range: DateRange, prior: DateRange) {
  const [visitsScheduled, prevVisitsScheduled, visitsCompleted, prevVisitsCompleted] =
    await Promise.all([
      countSiteVisits("scheduled", range),
      countSiteVisits("scheduled", prior),
      countSiteVisits("completed", range),
      countSiteVisits("completed", prior),
    ]);

  return {
    siteVisitsScheduled: kpi(visitsScheduled, prevVisitsScheduled),
    siteVisitsCompleted: kpi(visitsCompleted, prevVisitsCompleted),
  };
}

async function countBookingsInRange(range: DateRange) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookingDocuments)
    .innerJoin(projectUnits, eq(bookingDocuments.unitId, projectUnits.id))
    .innerJoin(projects, eq(projectUnits.projectId, projects.id))
    .where(
      and(
        eq(projects.orgId, SINGLE_TENANT_ORG_ID),
        gte(bookingDocuments.generatedAt, range.dateFrom),
        lte(bookingDocuments.generatedAt, range.dateTo),
      ),
    );
  return row?.count ?? 0;
}

function currentCalendarMonthRange(now = new Date()): DateRange {
  const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { dateFrom, dateTo };
}

function previousCalendarMonthRange(now = new Date()): DateRange {
  const dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const dateTo = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return { dateFrom, dateTo };
}

async function getBookingKpis() {
  const currentMonth = currentCalendarMonthRange();
  const previousMonth = previousCalendarMonthRange();
  const [current, previous] = await Promise.all([
    countBookingsInRange(currentMonth),
    countBookingsInRange(previousMonth),
  ]);
  return { bookingsThisMonth: kpi(current, previous) };
}

/** Reserved for task-domain KPI metrics; participates in parallel KPI fetch. */
async function getTaskKpis(_range: DateRange, _prior: DateRange) {
  return {};
}

async function getColdLeads() {
  const [count, items] = await Promise.all([countColdLeads(), leadService.listColdLeads()]);
  return { count, items };
}

async function fetchKpis(range: DateRange, prior: DateRange) {
  const [leadKpis, callKpis, visitKpis, bookingKpis] = await Promise.all([
    getLeadKpis(range, prior),
    getCallKpis(range, prior),
    getVisitKpis(range, prior),
    getTaskKpis(range, prior),
    getBookingKpis(),
  ]);

  return { ...leadKpis, ...callKpis, ...visitKpis, ...bookingKpis };
}

async function fetchLeadsOverTime(range: DateRange) {
  return db
    .select({
      date: sql<string>`to_char(date_trunc('day', ${leads.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(leads)
    .where(
      and(
        leadBaseFilter(),
        gte(leads.createdAt, range.dateFrom),
        lte(leads.createdAt, range.dateTo),
      ),
    )
    .groupBy(sql`date_trunc('day', ${leads.createdAt})`)
    .orderBy(sql`date_trunc('day', ${leads.createdAt})`);
}

async function fetchLeadFunnel() {
  const rows = await db
    .select({
      stage: leads.leadStatus,
      count: sql<number>`count(*)::int`,
    })
    .from(leads)
    .where(leadBaseFilter())
    .groupBy(leads.leadStatus);

  const byStage = new Map(rows.map((row) => [row.stage, row.count]));
  return LEAD_STATUSES.map((stage) => ({
    stage,
    count: byStage.get(stage) ?? 0,
  }));
}

async function fetchCallsByOutcome(range: DateRange) {
  const rows = await db
    .select({
      outcome: callRecords.outcome,
      count: sql<number>`count(*)::int`,
    })
    .from(callRecords)
    .where(
      and(
        eq(callRecords.orgId, SINGLE_TENANT_ORG_ID),
        gte(callRecords.startedAt, range.dateFrom),
        lte(callRecords.startedAt, range.dateTo),
        inArrayOutcomes(),
      ),
    )
    .groupBy(callRecords.outcome);

  const byOutcome = new Map(rows.map((row) => [row.outcome, row.count]));
  return CALL_OUTCOMES.map((outcome) => ({
    outcome: OUTCOME_LABELS[outcome],
    count: byOutcome.get(outcome) ?? 0,
  }));
}

function inArrayOutcomes() {
  return sql`${callRecords.outcome} in ('answered', 'no_answer', 'busy', 'left_voicemail')`;
}

async function fetchLeadSources(range: DateRange) {
  const rows = await db
    .select({
      source: leads.leadSource,
      count: sql<number>`count(*)::int`,
    })
    .from(leads)
    .where(
      and(
        leadBaseFilter(),
        gte(leads.createdAt, range.dateFrom),
        lte(leads.createdAt, range.dateTo),
      ),
    )
    .groupBy(leads.leadSource);

  return buildAnalyticsSourceCounts(rows);
}

async function fetchLeaderboard(range: DateRange) {
  const callWhere = and(
    eq(callRecords.orgId, SINGLE_TENANT_ORG_ID),
    gte(callRecords.startedAt, range.dateFrom),
    lte(callRecords.startedAt, range.dateTo),
  );

  const leadsAssignedWhere = and(
    leadBaseFilter(),
    isNotNull(leads.assignedTo),
    gte(leads.createdAt, range.dateFrom),
    lte(leads.createdAt, range.dateTo),
  );

  const visitsDoneWhere = and(
    eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID),
    eq(siteVisits.status, "completed"),
    gte(siteVisits.visitDate, sql`${toDateKey(range.dateFrom)}::date`),
    lte(siteVisits.visitDate, sql`${toDateKey(range.dateTo)}::date`),
    isNotNull(siteVisits.agentId),
  );

  const wonWhere = and(
    eq(leadActivities.orgId, SINGLE_TENANT_ORG_ID),
    eq(leadActivities.type, "status_change"),
    sql`${leadActivities.metadata}->>'to' = 'won'`,
    gte(leadActivities.createdAt, range.dateFrom),
    lte(leadActivities.createdAt, range.dateTo),
    isNotNull(leadActivities.userId),
  );

  const [orgUsers, callsMade, leadsAssigned, visitsDone, wonCounts] = await Promise.all([
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.orgId, SINGLE_TENANT_ORG_ID), eq(users.isActive, true)))
      .orderBy(users.name),
    db
      .select({
        userId: callRecords.userId,
        total: sql<number>`count(*)::int`,
        answered: sql<number>`count(*) filter (where ${callRecords.outcome} = 'answered')::int`,
      })
      .from(callRecords)
      .where(callWhere)
      .groupBy(callRecords.userId),
    db
      .select({
        userId: leads.assignedTo,
        count: sql<number>`count(distinct ${leads.id})::int`,
      })
      .from(leads)
      .where(leadsAssignedWhere)
      .groupBy(leads.assignedTo),
    db
      .select({
        userId: siteVisits.agentId,
        count: sql<number>`count(*)::int`,
      })
      .from(siteVisits)
      .where(visitsDoneWhere)
      .groupBy(siteVisits.agentId),
    db
      .select({
        userId: leadActivities.userId,
        count: sql<number>`count(distinct ${leadActivities.leadId})::int`,
      })
      .from(leadActivities)
      .where(wonWhere)
      .groupBy(leadActivities.userId),
  ]);

  const callsMap = new Map(callsMade.map((r) => [r.userId, r]));
  const leadsMap = new Map(leadsAssigned.map((r) => [r.userId, r.count]));
  const visitsMap = new Map(visitsDone.map((r) => [r.userId, r.count]));
  const wonMap = new Map(wonCounts.map((r) => [r.userId, r.count]));

  return orgUsers.map((user) => {
    const calls = callsMap.get(user.id);
    const leadsAssignedCount = leadsMap.get(user.id) ?? 0;
    const callsMadeCount = calls?.total ?? 0;
    const answeredCount = calls?.answered ?? 0;
    const answeredPercent =
      callsMadeCount > 0 ? Math.round((answeredCount / callsMadeCount) * 1000) / 10 : 0;
    const visitsDoneCount = visitsMap.get(user.id) ?? 0;
    const won = wonMap.get(user.id) ?? 0;
    const conversionPercent =
      leadsAssignedCount > 0 ? Math.round((won / leadsAssignedCount) * 1000) / 10 : 0;

    return {
      agentId: user.id,
      agentName: user.name,
      leadsAssigned: leadsAssignedCount,
      callsMade: callsMadeCount,
      answeredPercent,
      visitsDone: visitsDoneCount,
      won,
      conversionPercent,
    };
  });
}

async function countColdLeads() {
  const cutoff = coldCutoffDate();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(
      and(
        leadBaseFilter(),
        sql`${leads.leadStatus} not in ('won', 'lost')`,
        sql`COALESCE(${leads.lastContactedAt}, ${leads.createdAt}) <= ${tstz(cutoff)}`,
      ),
    );
  return row?.count ?? 0;
}

async function countOverdueFollowUps() {
  const now = new Date();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(
      and(
        leadBaseFilter(),
        sql`${leads.leadStatus} not in ('won', 'lost')`,
        isNotNull(leads.nextFollowupAt),
        lte(leads.nextFollowupAt, now),
      ),
    );
  return row?.count ?? 0;
}

async function fetchUnassignedLeads() {
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(leadBaseFilter(), isNull(leads.assignedTo)));

  const allIds = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(leadBaseFilter(), isNull(leads.assignedTo)))
    .orderBy(desc(leads.createdAt));

  const previewRows = await db
    .select({
      id: leads.id,
      name: leadNameExpr(),
      phone: leads.phone,
      leadStatus: leads.leadStatus,
    })
    .from(leads)
    .where(and(leadBaseFilter(), isNull(leads.assignedTo)))
    .orderBy(desc(leads.createdAt))
    .limit(10);

  return {
    count: countRow?.count ?? 0,
    leadIds: allIds.map((row) => row.id),
    preview: previewRows.map((row) => ({
      id: row.id,
      name: row.name.trim() || row.phone || "Unnamed lead",
      phone: row.phone,
      agentName: null,
      leadStatus: row.leadStatus,
    })),
  };
}

async function fetchStalePipeline() {
  const staleCutoff = new Date(Date.now() - 14 * 86_400_000);

  const stageSinceExpr = sql`coalesce(
    (select max(${leadActivities.createdAt}) from ${leadActivities}
      where ${leadActivities.leadId} = ${leads.id}
        and ${leadActivities.type} = 'status_change'),
    ${leads.createdAt}
  )`;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(activeLeadFilter(), sql`${stageSinceExpr} <= ${tstz(staleCutoff)}`));

  const previewRows = await db
    .select({
      id: leads.id,
      name: leadNameExpr(),
      phone: leads.phone,
      leadStatus: leads.leadStatus,
      agentName: users.name,
      stageSince: stageSinceExpr,
    })
    .from(leads)
    .leftJoin(users, eq(leads.assignedTo, users.id))
    .where(and(activeLeadFilter(), sql`${stageSinceExpr} <= ${tstz(staleCutoff)}`))
    .orderBy(asc(stageSinceExpr))
    .limit(10);

  const now = new Date();
  return {
    count: countRow?.count ?? 0,
    preview: previewRows.map((row) => ({
      id: row.id,
      name: row.name.trim() || row.phone || "Unnamed lead",
      phone: row.phone,
      agentName: row.agentName,
      leadStatus: row.leadStatus,
      daysInStage: daysSince(row.stageSince as Date, now),
    })),
  };
}

function mapColdPreview(
  items: Awaited<ReturnType<typeof leadService.listColdLeads>>,
): LeadPreview[] {
  return items.slice(0, 10).map((lead) => ({
    id: lead.id,
    name: [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim() || lead.phone || "Lead",
    phone: lead.phone,
    agentName: lead.assignedUser?.name ?? null,
    leadStatus: lead.leadStatus,
    daysSinceContact: lead.daysSinceContact,
  }));
}

function mapOverduePreview(
  items: Awaited<ReturnType<typeof leadService.listOverdueLeads>>,
): LeadPreview[] {
  return items.slice(0, 10).map((lead) => ({
    id: lead.id,
    name: [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim() || lead.phone || "Lead",
    phone: lead.phone,
    agentName: lead.assignedUser?.name ?? null,
    leadStatus: lead.leadStatus,
    daysOverdue: lead.daysOverdue,
    daysSinceContact: lead.daysSinceContact,
  }));
}

export const analyticsService = {
  async getOverview(query: AnalyticsOverviewQuery) {
    const range = { dateFrom: query.dateFrom, dateTo: query.dateTo };
    const { priorFrom, priorTo } = priorPeriod(range);
    const prior = { dateFrom: priorFrom, dateTo: priorTo };

    const [
      kpis,
      leadsOverTime,
      leadFunnel,
      callsByOutcome,
      leadSources,
      leaderboard,
      coldLeads,
      overdueCount,
      overdueItems,
      unassigned,
      stalePipeline,
    ] = await Promise.all([
      fetchKpis(range, prior),
      fetchLeadsOverTime(range),
      fetchLeadFunnel(),
      fetchCallsByOutcome(range),
      fetchLeadSources(range),
      fetchLeaderboard(range),
      getColdLeads(),
      countOverdueFollowUps(),
      leadService.listOverdueLeads(),
      fetchUnassignedLeads(),
      fetchStalePipeline(),
    ]);

    return {
      period: {
        dateFrom: range.dateFrom.toISOString(),
        dateTo: range.dateTo.toISOString(),
        previousFrom: priorFrom.toISOString(),
        previousTo: priorTo.toISOString(),
      },
      kpis,
      charts: {
        leadsOverTime,
        leadFunnel,
        callsByOutcome,
        leadSources,
      },
      leaderboard,
      health: {
        coldLeads: {
          count: coldLeads.count,
          preview: mapColdPreview(coldLeads.items),
        },
        overdueFollowUps: {
          count: overdueCount,
          preview: mapOverduePreview(overdueItems),
        },
        unassignedLeads: unassigned,
        stalePipeline,
      },
    };
  },
};
