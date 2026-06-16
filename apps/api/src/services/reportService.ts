import { callRecords, leadActivities, leads, projects, users } from "@propninja/db";
import { and, eq, gte, ilike, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { expandLeadSourceFilter } from "../lib/leadSourceAliases.js";
import { buildLeadsOverTimeReport, buildSourceGroupReport } from "../lib/leadSourceGroups.js";
import {
  type ReportScope,
  priorPeriod,
  scopedLeadBook,
  scopedLeadCreated,
  trendWindow,
} from "../lib/reportScope.js";
import type {
  CallsReportQuery,
  DashboardReportQuery,
  LeadsReportQuery,
  OverviewReportQuery,
  SourcesReportQuery,
} from "../lib/validators/reports.js";

type DateRange = { dateFrom: Date; dateTo: Date };

const PIPELINE_STAGES = ["new", "contacted", "negotiation", "won"] as const;

const LEAD_STATUS_ORDER = ["new", "contacted", "qualified", "negotiation", "won", "lost"] as const;

function calendarDayRange(offsetDays = 0) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offsetDays);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function calendarMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function buildStatusBreakdown(rows: { status: string; count: number }[], overdueCount: number) {
  const byStatus = new Map(rows.map((row) => [row.status, row.count]));
  const breakdown = LEAD_STATUS_ORDER.map((status) => ({
    status,
    count: byStatus.get(status) ?? 0,
  }));

  return [...breakdown, { status: "overdue", count: overdueCount }];
}

function leadBaseFilter() {
  return and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), isNull(leads.deletedAt));
}

async function pipelineStageStats(stageStatus: string, scope: ReportScope) {
  const { recentFrom, recentTo, priorFrom, priorTo } = trendWindow(scope);
  const stageFilter = and(scopedLeadBook(scope), eq(leads.leadStatus, stageStatus));

  const [[current], [recent], [prior]] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)::int`,
        totalValue: sql<string>`coalesce(sum(${leads.estimatedValue}::numeric), 0)`,
      })
      .from(leads)
      .where(stageFilter),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(stageFilter, gte(leads.updatedAt, recentFrom), lte(leads.updatedAt, recentTo))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(stageFilter, gte(leads.updatedAt, priorFrom), lte(leads.updatedAt, priorTo))),
  ]);

  const recentCount = recent?.count ?? 0;
  const priorCount = prior?.count ?? 0;
  const trendPercent =
    priorCount > 0
      ? Math.round(((recentCount - priorCount) / priorCount) * 100)
      : recentCount > 0
        ? 100
        : 0;

  return {
    status: stageStatus,
    count: current?.count ?? 0,
    total_value: Number(current?.totalValue ?? 0),
    trend_percent: trendPercent,
  };
}

function leadCreatedFilter(query: LeadsReportQuery) {
  const filters = [scopedLeadCreated(leadScopeFromQuery(query))];

  if (!query.adLeadsOnly && query.source) {
    const sourceVariants = expandLeadSourceFilter(query.source);
    filters.push(
      sourceVariants.length === 1
        ? eq(leads.leadSource, sourceVariants[0]!)
        : inArray(leads.leadSource, sourceVariants),
    );
  }

  return and(...filters);
}

async function queryLeadsBySource(scope: ReportScope) {
  const rows = await db
    .select({
      source: leads.leadSource,
      count: sql<number>`count(*)::int`,
    })
    .from(leads)
    .where(scopedLeadBook(scope))
    .groupBy(leads.leadSource);

  return buildSourceGroupReport(rows.map((row) => ({ source: row.source, count: row.count })));
}

function leadScopeFromQuery(query: {
  dateFrom: Date;
  dateTo: Date;
  userId?: string;
  status?: string;
  adLeadsOnly?: boolean;
}): ReportScope {
  return {
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    userId: query.userId,
    status: query.status,
    adLeadsOnly: query.adLeadsOnly,
  };
}

type CallsUserScope = Pick<CallsReportQuery, "userId" | "userIds">;

function callScopeFilter(scope: ReportScope, userScope?: CallsUserScope) {
  const userIds = userScope?.userIds;
  const userId = userIds?.length ? undefined : (userScope?.userId ?? scope.userId);
  const base = callStartedFilter(scope, userId, userIds);
  if (!scope.status) return base;

  return and(
    base,
    sql`exists (
      select 1 from ${leads}
      where ${leads.id} = ${callRecords.leadId}
      and ${scopedLeadBook(scope)}
    )`,
  );
}

function activityScopeFilter(scope: ReportScope, userScope?: CallsUserScope) {
  const userIds = userScope?.userIds;
  const userId = userIds?.length ? undefined : (userScope?.userId ?? scope.userId);
  const base = leadActivityFilter(scope, userId, userIds);
  if (!scope.status) return base;

  return and(
    base,
    sql`exists (
      select 1 from ${leads}
      where ${leads.id} = ${leadActivities.leadId}
      and ${scopedLeadBook(scope)}
    )`,
  );
}

function callStartedFilter(range: DateRange, userId?: string, userIds?: string[]) {
  const filters = [
    eq(callRecords.orgId, SINGLE_TENANT_ORG_ID),
    gte(callRecords.startedAt, range.dateFrom),
    lte(callRecords.startedAt, range.dateTo),
  ];

  if (userIds?.length) {
    filters.push(inArray(callRecords.userId, userIds));
  } else if (userId) {
    filters.push(eq(callRecords.userId, userId));
  }

  return and(...filters);
}

function callReportLeadExistsFilter(query: CallsReportQuery) {
  const hasLeadFilter = Boolean(
    query.source ||
      query.subSource ||
      query.projectName ||
      query.campaignName ||
      query.projectStatus,
  );

  if (!hasLeadFilter) return undefined;

  const leadFilters = [eq(leads.orgId, SINGLE_TENANT_ORG_ID), isNull(leads.deletedAt)];

  if (query.source) {
    const sourceVariants = expandLeadSourceFilter(query.source);
    leadFilters.push(
      sourceVariants.length === 1
        ? eq(leads.leadSource, sourceVariants[0]!)
        : inArray(leads.leadSource, sourceVariants),
    );
  }
  if (query.projectName) {
    leadFilters.push(eq(leads.projectName, query.projectName));
  }
  if (query.subSource) {
    leadFilters.push(ilike(sql`${leads.customFields}->>'sub_source'`, `%${query.subSource}%`));
  }
  if (query.campaignName) {
    const pattern = `%${query.campaignName}%`;
    leadFilters.push(
      or(
        ilike(sql`${leads.customFields}->>'campaignName'`, pattern),
        ilike(sql`${leads.customFields}->>'campaign'`, pattern),
        ilike(sql`${leads.customFields}->'adLead'->>'campaignName'`, pattern),
        ilike(sql`${leads.customFields}->'lastAdLead'->>'campaignName'`, pattern),
      )!,
    );
  }
  if (query.projectStatus === "active") {
    leadFilters.push(eq(projects.availability, true));
  } else if (query.projectStatus === "inactive") {
    leadFilters.push(eq(projects.availability, false));
  }

  const leadMatch = and(...leadFilters);

  return sql`exists (
    select 1 from ${leads}
    left join ${projects} on ${projects.id} = ${leads.projectId}
    where ${leads.id} = ${callRecords.leadId}
    and ${leadMatch}
  )`;
}

function callPerUserScopeFilter(query: CallsReportQuery) {
  const scope = leadScopeFromQuery(query);
  const filters = [
    callStartedFilter(scope, query.userIds?.length ? undefined : scope.userId, query.userIds),
    callReportLeadExistsFilter(query),
  ].filter(Boolean);

  return and(...filters);
}

function leadActivityFilter(range: DateRange, userId?: string, userIds?: string[]) {
  const filters = [
    eq(leadActivities.orgId, SINGLE_TENANT_ORG_ID),
    gte(leadActivities.createdAt, range.dateFrom),
    lte(leadActivities.createdAt, range.dateTo),
  ];

  if (userIds?.length) {
    filters.push(inArray(leadActivities.userId, userIds));
  } else if (userId) {
    filters.push(eq(leadActivities.userId, userId));
  }

  return and(...filters);
}

/** Expand selected manager(s) to include users who report to them (direct reports only). */
async function expandCallsReportUserScope(query: CallsReportQuery): Promise<CallsReportQuery> {
  if (!query.withTeam) return query;

  const managerIds = query.userIds?.length ? query.userIds : query.userId ? [query.userId] : [];

  if (managerIds.length === 0) return query;

  const directReports = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.orgId, SINGLE_TENANT_ORG_ID), inArray(users.reportingToId, managerIds)));

  const userIds = [...new Set([...managerIds, ...directReports.map((row) => row.id)])];

  return {
    ...query,
    userId: undefined,
    userIds,
  };
}

async function resolveCallsReportQuery(query: CallsReportQuery) {
  return expandCallsReportUserScope(query);
}

function buildActivityOnLeadsOverTime(
  callsRows: { date: string; count: number }[],
  meetingRows: { date: string; count: number }[],
  noteRows: { date: string; count: number }[],
) {
  const map = new Map<string, { date: string; calls: number; meetings: number; notes: number }>();

  const ensure = (date: string) => {
    const existing = map.get(date);
    if (existing) return existing;
    const row = { date, calls: 0, meetings: 0, notes: 0 };
    map.set(date, row);
    return row;
  };

  for (const row of callsRows) {
    ensure(row.date).calls += row.count;
  }
  for (const row of meetingRows) {
    ensure(row.date).meetings += row.count;
  }
  for (const row of noteRows) {
    ensure(row.date).notes += row.count;
  }

  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

type CallsPerUserMetricsRow = {
  userId: string;
  userName: string;
  incomingAnswered: number;
  incomingMissed: number;
  incomingTotal: number;
  outgoingAnswered: number;
  outgoingNotConnected: number;
  outgoingTotal: number;
  totalTalkTimeSeconds: number;
  avgTalkTimeSeconds: number;
  minTalkTimeSeconds: number;
  maxTalkTimeSeconds: number;
  totalCalls: number;
};

type CallsPerUserTotalsRow = Omit<CallsPerUserMetricsRow, "userId" | "userName">;

const callsPerUserMetricsSelect = {
  userId: callRecords.userId,
  userName: users.name,
  incomingAnswered: sql<number>`count(*) filter (where ${callRecords.direction} = 'incoming' and ${callRecords.status} = 'completed')::int`,
  incomingMissed: sql<number>`count(*) filter (where ${callRecords.direction} = 'incoming' and ${callRecords.status} = 'missed')::int`,
  incomingTotal: sql<number>`count(*) filter (where ${callRecords.direction} = 'incoming')::int`,
  outgoingAnswered: sql<number>`count(*) filter (where ${callRecords.direction} = 'outgoing' and ${callRecords.status} = 'completed')::int`,
  outgoingNotConnected: sql<number>`count(*) filter (where ${callRecords.direction} = 'outgoing' and ${callRecords.status} != 'completed')::int`,
  outgoingTotal: sql<number>`count(*) filter (where ${callRecords.direction} = 'outgoing')::int`,
  totalTalkTimeSeconds: sql<number>`coalesce(sum(${callRecords.durationSeconds}) filter (where ${callRecords.status} = 'completed'), 0)::int`,
  avgTalkTimeSeconds: sql<number>`coalesce(round(avg(${callRecords.durationSeconds}) filter (where ${callRecords.status} = 'completed' and ${callRecords.durationSeconds} > 0)), 0)::int`,
  minTalkTimeSeconds: sql<number>`coalesce(min(${callRecords.durationSeconds}) filter (where ${callRecords.status} = 'completed' and ${callRecords.durationSeconds} > 0), 0)::int`,
  maxTalkTimeSeconds: sql<number>`coalesce(max(${callRecords.durationSeconds}) filter (where ${callRecords.status} = 'completed'), 0)::int`,
  totalCalls: sql<number>`count(*)::int`,
};

function buildCallsPerUserWhere(query: CallsReportQuery) {
  // Per-user report inner-joins users; filter by users.is_active when user_status is set.
  const userStatusFilters = [];
  if (query.userStatus === "active") {
    userStatusFilters.push(eq(users.isActive, true));
  } else if (query.userStatus === "inactive") {
    userStatusFilters.push(eq(users.isActive, false));
  }
  if (query.userName) {
    userStatusFilters.push(ilike(users.name, `%${query.userName}%`));
  }
  return and(callPerUserScopeFilter(query), ...userStatusFilters);
}

function mapCallsPerUserMetricsRow(row: CallsPerUserMetricsRow) {
  return {
    userId: row.userId,
    userName: row.userName,
    incomingAnswered: row.incomingAnswered,
    incomingMissed: row.incomingMissed,
    incomingTotal: row.incomingTotal,
    outgoingAnswered: row.outgoingAnswered,
    outgoingNotConnected: row.outgoingNotConnected,
    outgoingTotal: row.outgoingTotal,
    totalTalkTimeSeconds: row.totalTalkTimeSeconds,
    avgTalkTimeSeconds: row.avgTalkTimeSeconds,
    minTalkTimeSeconds: row.minTalkTimeSeconds,
    maxTalkTimeSeconds: row.maxTalkTimeSeconds,
    totalCalls: row.totalCalls,
  };
}

function mapCallsPerUserTotalsRow(row: CallsPerUserTotalsRow) {
  return {
    incomingAnswered: row.incomingAnswered,
    incomingMissed: row.incomingMissed,
    incomingTotal: row.incomingTotal,
    outgoingAnswered: row.outgoingAnswered,
    outgoingNotConnected: row.outgoingNotConnected,
    outgoingTotal: row.outgoingTotal,
    totalTalkTimeSeconds: row.totalTalkTimeSeconds,
    avgTalkTimeSeconds: row.avgTalkTimeSeconds,
    minTalkTimeSeconds: row.minTalkTimeSeconds,
    maxTalkTimeSeconds: row.maxTalkTimeSeconds,
    totalCalls: row.totalCalls,
  };
}

function formatTalkTimeCsv(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return [hours, minutes, secs].map((part) => String(part).padStart(2, "0")).join(":");
}

function escapeCsvCell(value: string | number) {
  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCallsUserReportCsv(items: CallsPerUserMetricsRow[], totals: CallsPerUserTotalsRow) {
  const headers = [
    "User Name",
    "Incoming Answered",
    "Incoming Missed",
    "Incoming Total",
    "Outgoing Answered",
    "Outgoing Not Connected",
    "Outgoing Total",
    "Total TalkTime",
    "Avg TalkTime",
    "Min TalkTime",
    "Max TalkTime",
    "Total Calls",
  ];

  const lines = [headers.join(",")];

  for (const row of items) {
    lines.push(
      [
        escapeCsvCell(row.userName),
        row.incomingAnswered,
        row.incomingMissed,
        row.incomingTotal,
        row.outgoingAnswered,
        row.outgoingNotConnected,
        row.outgoingTotal,
        formatTalkTimeCsv(row.totalTalkTimeSeconds),
        formatTalkTimeCsv(row.avgTalkTimeSeconds),
        formatTalkTimeCsv(row.minTalkTimeSeconds),
        formatTalkTimeCsv(row.maxTalkTimeSeconds),
        row.totalCalls,
      ].join(","),
    );
  }

  lines.push(
    [
      "Total",
      totals.incomingAnswered,
      totals.incomingMissed,
      totals.incomingTotal,
      totals.outgoingAnswered,
      totals.outgoingNotConnected,
      totals.outgoingTotal,
      formatTalkTimeCsv(totals.totalTalkTimeSeconds),
      formatTalkTimeCsv(totals.avgTalkTimeSeconds),
      formatTalkTimeCsv(totals.minTalkTimeSeconds),
      formatTalkTimeCsv(totals.maxTalkTimeSeconds),
      totals.totalCalls,
    ].join(","),
  );

  return `${lines.join("\n")}\n`;
}

async function fetchCallsPerUserRows(
  query: CallsReportQuery,
  pagination?: { limit: number; offset: number },
) {
  const callWhere = buildCallsPerUserWhere(query);
  const baseQuery = db
    .select(callsPerUserMetricsSelect)
    .from(callRecords)
    .innerJoin(users, eq(callRecords.userId, users.id))
    .where(callWhere)
    .groupBy(callRecords.userId, users.name)
    .orderBy(users.name);

  const rows = pagination
    ? await baseQuery.limit(pagination.limit).offset(pagination.offset)
    : await baseQuery;

  return rows.map(mapCallsPerUserMetricsRow);
}

async function countCallsPerUserGroups(query: CallsReportQuery) {
  const callWhere = buildCallsPerUserWhere(query);
  const groupedUsers = db
    .select({ userId: callRecords.userId })
    .from(callRecords)
    .innerJoin(users, eq(callRecords.userId, users.id))
    .where(callWhere)
    .groupBy(callRecords.userId, users.name)
    .as("grouped_users");

  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(groupedUsers);
  return row?.count ?? 0;
}

async function fetchCallsPerUserGrandTotals(query: CallsReportQuery) {
  const callWhere = buildCallsPerUserWhere(query);
  const [row] = await db
    .select({
      incomingAnswered: callsPerUserMetricsSelect.incomingAnswered,
      incomingMissed: callsPerUserMetricsSelect.incomingMissed,
      incomingTotal: callsPerUserMetricsSelect.incomingTotal,
      outgoingAnswered: callsPerUserMetricsSelect.outgoingAnswered,
      outgoingNotConnected: callsPerUserMetricsSelect.outgoingNotConnected,
      outgoingTotal: callsPerUserMetricsSelect.outgoingTotal,
      totalTalkTimeSeconds: callsPerUserMetricsSelect.totalTalkTimeSeconds,
      avgTalkTimeSeconds: callsPerUserMetricsSelect.avgTalkTimeSeconds,
      minTalkTimeSeconds: callsPerUserMetricsSelect.minTalkTimeSeconds,
      maxTalkTimeSeconds: callsPerUserMetricsSelect.maxTalkTimeSeconds,
      totalCalls: callsPerUserMetricsSelect.totalCalls,
    })
    .from(callRecords)
    .innerJoin(users, eq(callRecords.userId, users.id))
    .where(callWhere);

  return mapCallsPerUserTotalsRow(
    row ?? {
      incomingAnswered: 0,
      incomingMissed: 0,
      incomingTotal: 0,
      outgoingAnswered: 0,
      outgoingNotConnected: 0,
      outgoingTotal: 0,
      totalTalkTimeSeconds: 0,
      avgTalkTimeSeconds: 0,
      minTalkTimeSeconds: 0,
      maxTalkTimeSeconds: 0,
      totalCalls: 0,
    },
  );
}

async function fetchCallsReportPerUserPaginated(query: CallsReportQuery) {
  const scopedQuery = await resolveCallsReportQuery(query);
  const page = scopedQuery.page ?? 1;
  const pageSize = scopedQuery.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const [total, items, totals] = await Promise.all([
    countCallsPerUserGroups(scopedQuery),
    fetchCallsPerUserRows(scopedQuery, { limit: pageSize, offset }),
    fetchCallsPerUserGrandTotals(scopedQuery),
  ]);

  return { items, total, page, pageSize, totals };
}

export const reportService = {
  async getDashboard(query: DashboardReportQuery) {
    const leadWhere = scopedLeadCreated({
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      userId: query.userId,
    });
    const callWhere = callStartedFilter(query, query.userId);

    const [leadsByStatus, [newLeadsRow], [hotLeadsRow], [callTotals], callsByAgent] =
      await Promise.all([
        db
          .select({
            status: leads.leadStatus,
            count: sql<number>`count(*)::int`,
          })
          .from(leads)
          .where(leadWhere)
          .groupBy(leads.leadStatus)
          .orderBy(leads.leadStatus),
        db.select({ count: sql<number>`count(*)::int` }).from(leads).where(leadWhere),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(leads)
          .where(and(leadWhere, eq(leads.temperature, "hot"))),
        db
          .select({
            total: sql<number>`count(*)::int`,
            completed: sql<number>`count(*) filter (where ${callRecords.status} = 'completed')::int`,
            missed: sql<number>`count(*) filter (where ${callRecords.status} = 'missed')::int`,
            totalDuration: sql<number>`coalesce(sum(${callRecords.durationSeconds}), 0)::int`,
          })
          .from(callRecords)
          .where(callWhere),
        db
          .select({
            userId: users.id,
            name: users.name,
            totalCalls: sql<number>`count(${callRecords.id})::int`,
            completedCalls: sql<number>`count(${callRecords.id}) filter (where ${callRecords.status} = 'completed')::int`,
            totalDuration: sql<number>`coalesce(sum(${callRecords.durationSeconds}), 0)::int`,
          })
          .from(callRecords)
          .innerJoin(users, eq(callRecords.userId, users.id))
          .where(callWhere)
          .groupBy(users.id, users.name)
          .orderBy(sql`count(${callRecords.id}) desc`),
      ]);

    const totalCalls = callTotals?.total ?? 0;
    const totalDuration = callTotals?.totalDuration ?? 0;

    return {
      leads_by_status: leadsByStatus.map((row) => ({
        status: row.status,
        count: row.count,
      })),
      new_leads_count: newLeadsRow?.count ?? 0,
      hot_leads_count: hotLeadsRow?.count ?? 0,
      calls_summary: {
        total: totalCalls,
        completed: callTotals?.completed ?? 0,
        missed: callTotals?.missed ?? 0,
        avg_duration: totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0,
      },
      calls_by_agent: callsByAgent.map((row) => ({
        user_id: row.userId,
        name: row.name,
        total_calls: row.totalCalls,
        completed_calls: row.completedCalls,
        avg_duration: row.totalCalls > 0 ? Math.round(row.totalDuration / row.totalCalls) : 0,
      })),
    };
  },

  async getCallsReportPerUser(query: CallsReportQuery) {
    return fetchCallsReportPerUserPaginated(query);
  },

  async exportCallsReportPerUserCsv(query: CallsReportQuery) {
    const scopedQuery = await resolveCallsReportQuery(query);
    const [items, totals] = await Promise.all([
      fetchCallsPerUserRows(scopedQuery),
      fetchCallsPerUserGrandTotals(scopedQuery),
    ]);
    return buildCallsUserReportCsv(items, totals);
  },

  async getCallsReport(query: CallsReportQuery) {
    const scopedQuery = await resolveCallsReportQuery(query);
    const scope = leadScopeFromQuery(scopedQuery);
    const userScope: CallsUserScope = {
      userId: scopedQuery.userId,
      userIds: scopedQuery.userIds,
    };
    const callWhere = callScopeFilter(scope, userScope);
    const activityWhere = activityScopeFilter(scope, userScope);

    const [
      callsOverTime,
      dispositionBreakdown,
      directionBreakdown,
      callsOnLeadsOverTime,
      meetingsOverTime,
      notesOverTime,
    ] = await Promise.all([
      db
        .select({
          date: sql<string>`to_char(date_trunc('day', ${callRecords.startedAt}), 'YYYY-MM-DD')`,
          totalCalls: sql<number>`count(*)::int`,
          completedCalls: sql<number>`count(*) filter (where ${callRecords.status} = 'completed')::int`,
          missedCalls: sql<number>`count(*) filter (where ${callRecords.status} = 'missed')::int`,
        })
        .from(callRecords)
        .where(callWhere)
        .groupBy(sql`date_trunc('day', ${callRecords.startedAt})`)
        .orderBy(sql`date_trunc('day', ${callRecords.startedAt})`),
      db
        .select({
          disposition: sql<string>`coalesce(${callRecords.disposition}, 'unknown')`,
          count: sql<number>`count(*)::int`,
        })
        .from(callRecords)
        .where(callWhere)
        .groupBy(callRecords.disposition)
        .orderBy(sql`count(*) desc`),
      db
        .select({
          direction: callRecords.direction,
          count: sql<number>`count(*)::int`,
        })
        .from(callRecords)
        .where(callWhere)
        .groupBy(callRecords.direction)
        .orderBy(callRecords.direction),
      db
        .select({
          date: sql<string>`to_char(date_trunc('day', ${callRecords.startedAt}), 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(callRecords)
        .where(and(callWhere, isNotNull(callRecords.leadId)))
        .groupBy(sql`date_trunc('day', ${callRecords.startedAt})`)
        .orderBy(sql`date_trunc('day', ${callRecords.startedAt})`),
      db
        .select({
          date: sql<string>`to_char(date_trunc('day', ${leadActivities.createdAt}), 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(leadActivities)
        .where(and(activityWhere, eq(leadActivities.type, "meeting")))
        .groupBy(sql`date_trunc('day', ${leadActivities.createdAt})`)
        .orderBy(sql`date_trunc('day', ${leadActivities.createdAt})`),
      db
        .select({
          date: sql<string>`to_char(date_trunc('day', ${leadActivities.createdAt}), 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(leadActivities)
        .where(and(activityWhere, eq(leadActivities.type, "note")))
        .groupBy(sql`date_trunc('day', ${leadActivities.createdAt})`)
        .orderBy(sql`date_trunc('day', ${leadActivities.createdAt})`),
    ]);

    return {
      calls_over_time: callsOverTime.map((row) => ({
        date: row.date,
        total_calls: row.totalCalls,
        completed_calls: row.completedCalls,
        missed_calls: row.missedCalls,
      })),
      disposition_breakdown: dispositionBreakdown.map((row) => ({
        disposition: row.disposition,
        count: row.count,
      })),
      direction_breakdown: directionBreakdown.map((row) => ({
        direction: row.direction,
        count: row.count,
      })),
      activity_on_leads_over_time: buildActivityOnLeadsOverTime(
        callsOnLeadsOverTime.map((row) => ({ date: row.date, count: row.count })),
        meetingsOverTime.map((row) => ({ date: row.date, count: row.count })),
        notesOverTime.map((row) => ({ date: row.date, count: row.count })),
      ),
    };
  },

  async getLeadsReport(query: LeadsReportQuery) {
    const leadWhere = leadCreatedFilter(query);

    const firstCalls = db
      .select({
        leadId: callRecords.leadId,
        firstCallAt: sql<Date>`min(${callRecords.startedAt})`.as("first_call_at"),
      })
      .from(callRecords)
      .where(
        and(eq(callRecords.orgId, SINGLE_TENANT_ORG_ID), sql`${callRecords.leadId} is not null`),
      )
      .groupBy(callRecords.leadId)
      .as("first_calls");

    const [newLeadsOverTime, leadsByDateAndSource, statusConversion, [avgFirstCall]] =
      await Promise.all([
        db
          .select({
            date: sql<string>`to_char(date_trunc('day', ${leads.createdAt}), 'YYYY-MM-DD')`,
            count: sql<number>`count(*)::int`,
          })
          .from(leads)
          .where(leadWhere)
          .groupBy(sql`date_trunc('day', ${leads.createdAt})`)
          .orderBy(sql`date_trunc('day', ${leads.createdAt})`),
        db
          .select({
            date: sql<string>`to_char(date_trunc('day', ${leads.createdAt}), 'YYYY-MM-DD')`,
            source: leads.leadSource,
            count: sql<number>`count(*)::int`,
          })
          .from(leads)
          .where(leadWhere)
          .groupBy(sql`date_trunc('day', ${leads.createdAt})`, leads.leadSource)
          .orderBy(sql`date_trunc('day', ${leads.createdAt})`),
        db
          .select({
            fromStatus: sql<string>`${leadActivities.metadata}->>'from'`,
            toStatus: sql<string>`${leadActivities.metadata}->>'to'`,
            count: sql<number>`count(*)::int`,
          })
          .from(leadActivities)
          .where(
            and(
              eq(leadActivities.orgId, SINGLE_TENANT_ORG_ID),
              eq(leadActivities.type, "status_change"),
              gte(leadActivities.createdAt, query.dateFrom),
              lte(leadActivities.createdAt, query.dateTo),
              sql`${leadActivities.metadata}->>'from' is not null`,
              sql`${leadActivities.metadata}->>'to' is not null`,
            ),
          )
          .groupBy(sql`${leadActivities.metadata}->>'from'`, sql`${leadActivities.metadata}->>'to'`)
          .orderBy(sql`count(*) desc`),
        db
          .select({
            avgSeconds: sql<number>`coalesce(avg(extract(epoch from (${firstCalls.firstCallAt} - ${leads.createdAt}))), 0)`,
          })
          .from(leads)
          .innerJoin(firstCalls, eq(firstCalls.leadId, leads.id))
          .where(leadWhere),
      ]);

    const avgSeconds = avgFirstCall?.avgSeconds ?? 0;

    const leadsOverTime = buildLeadsOverTimeReport(
      leadsByDateAndSource.map((row) => ({
        date: row.date,
        source: row.source,
        count: row.count,
      })),
    );

    return {
      new_leads_over_time: newLeadsOverTime.map((row) => ({
        date: row.date,
        count: row.count,
      })),
      leads_over_time: leadsOverTime,
      status_conversion: statusConversion.map((row) => ({
        from_status: row.fromStatus,
        to_status: row.toStatus,
        count: row.count,
      })),
      avg_time_to_first_call: Math.round(Number(avgSeconds)),
    };
  },

  async getTeamToday(dateFrom: Date, dateTo: Date) {
    const callWhere = and(
      eq(callRecords.orgId, SINGLE_TENANT_ORG_ID),
      gte(callRecords.startedAt, dateFrom),
      lte(callRecords.startedAt, dateTo),
    );

    const wonWhere = and(
      eq(leadActivities.orgId, SINGLE_TENANT_ORG_ID),
      eq(leadActivities.type, "status_change"),
      gte(leadActivities.createdAt, dateFrom),
      lte(leadActivities.createdAt, dateTo),
      sql`${leadActivities.metadata}->>'to' = 'won'`,
    );

    const [orgUsers, callStats, leadsTouched, dealsWon] = await Promise.all([
      db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(and(eq(users.orgId, SINGLE_TENANT_ORG_ID), eq(users.isActive, true)))
        .orderBy(users.name),
      db
        .select({
          userId: callRecords.userId,
          callsToday: sql<number>`count(*)::int`,
          completedToday: sql<number>`count(*) filter (where ${callRecords.status} = 'completed')::int`,
          avgDurationToday: sql<number | null>`avg(${callRecords.durationSeconds})`,
        })
        .from(callRecords)
        .where(callWhere)
        .groupBy(callRecords.userId),
      db
        .select({
          userId: callRecords.userId,
          leadsTouchedToday: sql<number>`count(distinct ${callRecords.leadId})::int`,
        })
        .from(callRecords)
        .where(and(callWhere, sql`${callRecords.leadId} is not null`))
        .groupBy(callRecords.userId),
      db
        .select({
          userId: leadActivities.userId,
          dealsWonToday: sql<number>`count(*)::int`,
        })
        .from(leadActivities)
        .where(wonWhere)
        .groupBy(leadActivities.userId),
    ]);

    const callMap = new Map(callStats.map((r) => [r.userId, r]));
    const touchedMap = new Map(leadsTouched.map((r) => [r.userId, r]));
    const wonMap = new Map(dealsWon.map((r) => [r.userId, r]));

    return {
      users: orgUsers.map((user) => {
        const calls = callMap.get(user.id);
        const touched = touchedMap.get(user.id);
        const won = wonMap.get(user.id);

        return {
          userId: user.id,
          name: user.name,
          email: user.email,
          callsToday: calls?.callsToday ?? 0,
          completedToday: calls?.completedToday ?? 0,
          avgDurationToday: calls?.avgDurationToday
            ? Math.round(Number(calls.avgDurationToday))
            : 0,
          leadsTouchedToday: touched?.leadsTouchedToday ?? 0,
          dealsWonToday: won?.dealsWonToday ?? 0,
        };
      }),
    };
  },

  async getOverviewStats(query: OverviewReportQuery) {
    const scope = leadScopeFromQuery(query);
    const periodStart = scope.dateFrom;
    const periodEnd = scope.dateTo;
    const { start: todayStart, end: todayEnd } = calendarDayRange();
    const { start: yesterdayStart, end: yesterdayEnd } = calendarDayRange(-1);
    const { start: monthStart, end: monthEnd } = calendarMonthRange();

    const deletedLeadFilter = scope.userId
      ? and(
          eq(leads.orgId, SINGLE_TENANT_ORG_ID),
          isNotNull(leads.deletedAt),
          eq(leads.assignedTo, scope.userId),
        )
      : and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), isNotNull(leads.deletedAt));

    const [
      [newLeadsToday],
      [newLeadsYesterday],
      [hotLeads],
      [dealsWonMonth],
      [callsTodayAgg],
      [callsYesterdayAgg],
      [followUpsDueToday],
      leadsByStatus,
      callsOverWeek,
      leadsOverWeek,
      pipelineStages,
      [wonValueMonth],
      [avgDealSize],
      hotLeadsList,
      orgUsers,
      leadsOwnedRows,
      callStatsToday,
      dealsWonMonthByUser,
      [totalLeadsAgg],
      [activeLeadsAgg],
      [unassignedLeadsAgg],
      [deletedLeadsAgg],
      [notInterestedAgg],
      [droppedLeadsAgg],
      [pendingCallbacksAgg],
      [todayMeetingsAgg],
      [bookedLeadsAgg],
      [overdueFollowupsAgg],
      leadsBySource,
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(
          and(
            scopedLeadBook(scope),
            gte(leads.createdAt, todayStart),
            lte(leads.createdAt, todayEnd),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(
          and(
            scopedLeadBook(scope),
            gte(leads.createdAt, yesterdayStart),
            lte(leads.createdAt, yesterdayEnd),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(and(scopedLeadBook(scope), eq(leads.temperature, "hot"))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leadActivities)
        .where(
          and(
            eq(leadActivities.orgId, SINGLE_TENANT_ORG_ID),
            eq(leadActivities.type, "status_change"),
            sql`${leadActivities.metadata}->>'to' = 'won'`,
            gte(leadActivities.createdAt, monthStart),
            lte(leadActivities.createdAt, monthEnd),
            scope.userId ? eq(leadActivities.userId, scope.userId) : sql`true`,
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(callRecords)
        .where(
          and(
            eq(callRecords.orgId, SINGLE_TENANT_ORG_ID),
            gte(callRecords.startedAt, todayStart),
            lte(callRecords.startedAt, todayEnd),
            scope.userId ? eq(callRecords.userId, scope.userId) : sql`true`,
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(callRecords)
        .where(
          and(
            eq(callRecords.orgId, SINGLE_TENANT_ORG_ID),
            gte(callRecords.startedAt, yesterdayStart),
            lte(callRecords.startedAt, yesterdayEnd),
            scope.userId ? eq(callRecords.userId, scope.userId) : sql`true`,
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(
          and(
            scopedLeadBook(scope),
            isNotNull(leads.nextFollowupAt),
            lte(leads.nextFollowupAt, todayEnd),
            sql`${leads.leadStatus} not in ('won', 'lost')`,
          ),
        ),
      db
        .select({
          status: leads.leadStatus,
          count: sql<number>`count(*)::int`,
        })
        .from(leads)
        .where(scopedLeadBook(scope))
        .groupBy(leads.leadStatus),
      db
        .select({
          date: sql<string>`to_char(date_trunc('day', ${callRecords.startedAt}), 'YYYY-MM-DD')`,
          total: sql<number>`count(*)::int`,
        })
        .from(callRecords)
        .where(callScopeFilter(scope))
        .groupBy(sql`date_trunc('day', ${callRecords.startedAt})`)
        .orderBy(sql`date_trunc('day', ${callRecords.startedAt})`),
      db
        .select({
          date: sql<string>`to_char(date_trunc('day', ${leads.createdAt}), 'YYYY-MM-DD')`,
          total: sql<number>`count(*)::int`,
        })
        .from(leads)
        .where(scopedLeadCreated(scope))
        .groupBy(sql`date_trunc('day', ${leads.createdAt})`)
        .orderBy(sql`date_trunc('day', ${leads.createdAt})`),
      Promise.all(PIPELINE_STAGES.map((stage) => pipelineStageStats(stage, scope))),
      db
        .select({
          total: sql<string>`coalesce(sum(${leads.estimatedValue}::numeric), 0)`,
        })
        .from(leads)
        .where(
          and(
            scopedLeadBook(scope),
            eq(leads.leadStatus, "won"),
            gte(leads.updatedAt, periodStart),
            lte(leads.updatedAt, periodEnd),
          ),
        ),
      db
        .select({
          avg: sql<string | null>`avg(${leads.estimatedValue}::numeric)`,
        })
        .from(leads)
        .where(
          and(scopedLeadBook(scope), eq(leads.leadStatus, "won"), isNotNull(leads.estimatedValue)),
        ),
      db
        .select({
          id: leads.id,
          firstName: leads.firstName,
          lastName: leads.lastName,
          phone: leads.phone,
          city: leads.city,
          leadStatus: leads.leadStatus,
          lastContactedAt: leads.lastContactedAt,
          nextFollowupAt: leads.nextFollowupAt,
        })
        .from(leads)
        .where(and(scopedLeadBook(scope), eq(leads.temperature, "hot")))
        .orderBy(sql`${leads.nextFollowupAt} asc nulls last`)
        .limit(5),
      db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(and(eq(users.orgId, SINGLE_TENANT_ORG_ID), eq(users.isActive, true)))
        .orderBy(users.name),
      db
        .select({
          userId: leads.assignedTo,
          count: sql<number>`count(*)::int`,
        })
        .from(leads)
        .where(and(scopedLeadBook(scope), isNotNull(leads.assignedTo)))
        .groupBy(leads.assignedTo),
      db
        .select({
          userId: callRecords.userId,
          callsToday: sql<number>`count(*)::int`,
          avgDurationToday: sql<number | null>`avg(${callRecords.durationSeconds})`,
        })
        .from(callRecords)
        .where(
          and(
            eq(callRecords.orgId, SINGLE_TENANT_ORG_ID),
            gte(callRecords.startedAt, todayStart),
            lte(callRecords.startedAt, todayEnd),
            scope.userId ? eq(callRecords.userId, scope.userId) : sql`true`,
          ),
        )
        .groupBy(callRecords.userId),
      db
        .select({
          userId: leadActivities.userId,
          count: sql<number>`count(*)::int`,
        })
        .from(leadActivities)
        .where(
          and(
            eq(leadActivities.orgId, SINGLE_TENANT_ORG_ID),
            eq(leadActivities.type, "status_change"),
            sql`${leadActivities.metadata}->>'to' = 'won'`,
            gte(leadActivities.createdAt, monthStart),
            lte(leadActivities.createdAt, monthEnd),
            scope.userId ? eq(leadActivities.userId, scope.userId) : sql`true`,
          ),
        )
        .groupBy(leadActivities.userId),
      db.select({ count: sql<number>`count(*)::int` }).from(leads).where(scopedLeadBook(scope)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(and(scopedLeadBook(scope), sql`${leads.leadStatus} not in ('lost', 'won')`)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(
          and(
            eq(leads.orgId, SINGLE_TENANT_ORG_ID),
            isNull(leads.deletedAt),
            isNull(leads.assignedTo),
            scope.status ? eq(leads.leadStatus, scope.status) : sql`true`,
            scope.userId ? sql`false` : sql`true`,
          ),
        ),
      db.select({ count: sql<number>`count(*)::int` }).from(leads).where(deletedLeadFilter),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(and(scopedLeadBook(scope), eq(leads.leadStatus, "lost"))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(
          and(
            deletedLeadFilter,
            gte(leads.deletedAt, periodStart),
            lte(leads.deletedAt, periodEnd),
          ),
        ),
      db
        .select({ count: sql<number>`count(distinct ${callRecords.leadId})::int` })
        .from(callRecords)
        .where(
          and(
            callScopeFilter(scope),
            eq(callRecords.disposition, "callback"),
            isNotNull(callRecords.leadId),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leadActivities)
        .where(
          and(
            eq(leadActivities.orgId, SINGLE_TENANT_ORG_ID),
            eq(leadActivities.type, "meeting"),
            gte(leadActivities.createdAt, todayStart),
            lte(leadActivities.createdAt, todayEnd),
            scope.userId ? eq(leadActivities.userId, scope.userId) : sql`true`,
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(and(scopedLeadBook(scope), eq(leads.leadStatus, "won"))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(
          and(
            scopedLeadBook(scope),
            isNotNull(leads.nextFollowupAt),
            lt(leads.nextFollowupAt, todayStart),
            sql`${leads.leadStatus} not in ('won', 'lost')`,
          ),
        ),
      db
        .select({
          source: leads.leadSource,
          count: sql<number>`count(*)::int`,
        })
        .from(leads)
        .where(scopedLeadBook(scope))
        .groupBy(leads.leadSource),
    ]);

    const newLeadsTodayCount = newLeadsToday?.count ?? 0;
    const newLeadsYesterdayCount = newLeadsYesterday?.count ?? 1;
    const callsTodayCount = callsTodayAgg?.count ?? 0;
    const callsYesterdayCount = callsYesterdayAgg?.count || 1;

    const wonValueMonthNum = Number(wonValueMonth?.total ?? 0);
    const avgDealSizeNum = avgDealSize?.avg ? Math.round(Number(avgDealSize.avg)) : 0;

    const ownedMap = new Map(leadsOwnedRows.map((r) => [r.userId, r.count]));
    const callMap = new Map(callStatsToday.map((r) => [r.userId, r]));
    const wonMap = new Map(dealsWonMonthByUser.map((r) => [r.userId, r.count]));

    const teamPerformance = orgUsers.map((user) => {
      const calls = callMap.get(user.id);
      return {
        user_id: user.id,
        name: user.name,
        leads_owned: ownedMap.get(user.id) ?? 0,
        calls_today: calls?.callsToday ?? 0,
        avg_duration_today: calls?.avgDurationToday
          ? Math.round(Number(calls.avgDurationToday))
          : 0,
        deals_won_month: wonMap.get(user.id) ?? 0,
      };
    });

    const leadsWeekMap = new Map(leadsOverWeek.map((r) => [r.date, r.total]));
    const activityLast7Days = callsOverWeek.map((row) => ({
      date: row.date,
      calls: row.total,
      leads: leadsWeekMap.get(row.date) ?? 0,
    }));

    for (const row of leadsOverWeek) {
      if (!activityLast7Days.find((d) => d.date === row.date)) {
        activityLast7Days.push({ date: row.date, calls: 0, leads: row.total });
      }
    }
    activityLast7Days.sort((a, b) => a.date.localeCompare(b.date));

    return {
      kpis: {
        new_leads_today: newLeadsTodayCount,
        new_leads_trend: Math.round(
          ((newLeadsTodayCount - newLeadsYesterdayCount) / newLeadsYesterdayCount) * 100,
        ),
        calls_today: callsTodayCount,
        calls_trend: Math.round(
          ((callsTodayCount - callsYesterdayCount) / callsYesterdayCount) * 100,
        ),
        deals_won_month: dealsWonMonth?.count ?? 0,
        hot_leads: hotLeads?.count ?? 0,
        follow_ups_due_today: followUpsDueToday?.count ?? 0,
      },
      lead_strip: {
        total_leads: totalLeadsAgg?.count ?? 0,
        active_leads: activeLeadsAgg?.count ?? 0,
        unassigned_leads: unassignedLeadsAgg?.count ?? 0,
        deleted_leads: deletedLeadsAgg?.count ?? 0,
        not_interested_count: notInterestedAgg?.count ?? 0,
        dropped_count: droppedLeadsAgg?.count ?? 0,
        today_new_leads: newLeadsTodayCount,
        today_calls: callsTodayCount,
        pending_callbacks_count: pendingCallbacksAgg?.count ?? 0,
        today_meetings_count: todayMeetingsAgg?.count ?? 0,
        booked_count: bookedLeadsAgg?.count ?? 0,
      },
      status_breakdown: buildStatusBreakdown(leadsByStatus, overdueFollowupsAgg?.count ?? 0),
      pipeline: pipelineStages,
      revenue: {
        won_value_month: wonValueMonthNum,
        avg_deal_size: avgDealSizeNum,
      },
      hot_leads_list: hotLeadsList.map((row) => ({
        id: row.id,
        name: `${row.firstName} ${row.lastName}`.trim(),
        phone: row.phone,
        city: row.city,
        status: row.leadStatus,
        last_contacted_at: row.lastContactedAt?.toISOString() ?? null,
        next_followup_at: row.nextFollowupAt?.toISOString() ?? null,
      })),
      leads_by_status: leadsByStatus.map((row) => ({
        status: row.status,
        count: row.count,
      })),
      calls_last_7_days: callsOverWeek.map((row) => ({
        date: row.date,
        total: row.total,
      })),
      activity_last_7_days: activityLast7Days,
      team_performance: teamPerformance,
      leads_from_source: buildSourceGroupReport(
        leadsBySource.map((row) => ({ source: row.source, count: row.count })),
      ),
    };
  },

  async getSourcesReport(query: SourcesReportQuery) {
    const scope = leadScopeFromQuery(query);
    const leads_from_source = await queryLeadsBySource(scope);
    return { leads_from_source };
  },

  async getProjects() {
    const projectNameExpr = sql<string>`coalesce(${leads.projectName}, ${leads.customFields}->>'project_name')`;

    const rows = await db
      .select({
        name: projectNameExpr,
        leadsCount: sql<number>`count(*)::int`,
        hotLeadsCount: sql<number>`count(*) filter (where ${leads.temperature} = 'hot')::int`,
        wonCount: sql<number>`count(*) filter (where ${leads.leadStatus} = 'won')::int`,
      })
      .from(leads)
      .where(
        and(
          leadBaseFilter(),
          or(isNotNull(leads.projectName), sql`${leads.customFields}->>'project_name' is not null`),
        ),
      )
      .groupBy(projectNameExpr)
      .having(sql`coalesce(${leads.projectName}, ${leads.customFields}->>'project_name') <> ''`)
      .orderBy(sql`count(*) desc`)
      .limit(6);

    return {
      projects: rows
        .filter((row) => row.name?.trim())
        .map((row) => ({
          name: row.name.trim(),
          leadsCount: row.leadsCount,
          hotLeadsCount: row.hotLeadsCount,
          wonCount: row.wonCount,
        })),
    };
  },
};
