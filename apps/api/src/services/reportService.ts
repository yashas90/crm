import {
  agentCallLogs,
  callRecords,
  leadActivities,
  leads,
  projects,
  siteVisits,
  tasks,
  users,
} from "@propninja/db";
import { getIstDateKey, getIstDayBounds, getIstMonthBounds } from "@propninja/types/ist";
import {
  type SQL,
  type SQLWrapper,
  and,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { newLeadFreshnessCutoff } from "../lib/ageOutNewLeads.js";
import { answeredCallFilter, connectedTalkTimeFilter } from "../lib/callTalkTime.js";
import { expandTeamUserIds } from "../lib/callsReportScope.js";
import {
  type CombinedCallEvent,
  aggregateCombinedCalls,
  dedupeCombinedCalls,
  emptyCombinedCallStats,
  sumCallCountTotals,
} from "../lib/combinedCallStats.js";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { expandLeadSourceFilter } from "../lib/leadSourceAliases.js";
import {
  buildLeadsOverTimeReport,
  buildSourceGroupReport,
  formatSourceName,
} from "../lib/leadSourceGroups.js";
import { loadCombinedCallEvents } from "../lib/loadCombinedCallEvents.js";
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
import { asyncLinesToCsvStream } from "../utils/csvExport.js";
import { resolveHotLeadCondition } from "./leadScoringService.js";

type DateRange = { dateFrom: Date; dateTo: Date };

const PIPELINE_STAGES = ["new", "contacted", "negotiation", "won"] as const;

const LEAD_STATUS_ORDER = ["new", "contacted", "qualified", "negotiation", "won", "lost"] as const;

/** Today / offset day in IST (CRM operating timezone). */
function calendarDayRange(offsetDays = 0) {
  const { start, end } = getIstDayBounds(offsetDays);
  return { start, end };
}

/** Month-to-date in IST (1st 00:00 → end of today). */
function calendarMonthRange() {
  return getIstMonthBounds();
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

export type SourceMatrixCount = { count: number; unique: number };

export type SourceMatrixRow = {
  source: string;
  allLeads: SourceMatrixCount;
  newLeads: SourceMatrixCount;
  pending: SourceMatrixCount;
  callback: SourceMatrixCount;
  qualified: SourceMatrixCount;
  duplicate: SourceMatrixCount;
  meetingScheduled: SourceMatrixCount;
  meetingDone: SourceMatrixCount;
  meetingNotDone: SourceMatrixCount;
  siteVisitScheduled: SourceMatrixCount;
  siteVisitDone: SourceMatrixCount;
  siteVisitNotDone: SourceMatrixCount;
  booked: SourceMatrixCount;
  bookingCancel: SourceMatrixCount;
  notInterested: SourceMatrixCount;
  dropped: SourceMatrixCount;
  expressionOfInterest: SourceMatrixCount;
};

const SOURCE_MATRIX_COLUMNS = [
  { key: "allLeads", label: "All Leads" },
  { key: "newLeads", label: "New" },
  { key: "pending", label: "Pending" },
  { key: "callback", label: "Callback" },
  { key: "qualified", label: "Qualified" },
  { key: "duplicate", label: "Duplicate" },
  { key: "meetingScheduled", label: "Meeting Scheduled" },
  { key: "meetingDone", label: "Meeting Done" },
  { key: "meetingNotDone", label: "Meeting Not Done" },
  { key: "siteVisitScheduled", label: "Site Visit Scheduled" },
  { key: "siteVisitDone", label: "Site Visit Done" },
  { key: "siteVisitNotDone", label: "Site Visit Not Done" },
  { key: "booked", label: "Booked" },
  { key: "bookingCancel", label: "Booking Cancel" },
  { key: "notInterested", label: "Not Interested" },
  { key: "dropped", label: "Dropped" },
  { key: "expressionOfInterest", label: "Expression Of Interest" },
] as const;

const SOURCE_MATRIX_KEYS = SOURCE_MATRIX_COLUMNS.map((column) => column.key);

const phoneKeySql = sql`RIGHT(regexp_replace(COALESCE(${leads.phone}, ''), '[^0-9]', '', 'g'), 10)`;

function matrixCountExprs(filter?: SQL) {
  const whereCount = filter ? sql`filter (where ${filter})` : sql``;
  const whereUniquePhone = filter
    ? sql`${filter} AND length(${phoneKeySql}) >= 10`
    : sql`length(${phoneKeySql}) >= 10`;
  const whereUniqueBlank = filter
    ? sql`${filter} AND length(${phoneKeySql}) < 10`
    : sql`length(${phoneKeySql}) < 10`;
  return {
    count: sql<number>`count(*) ${whereCount}::int`,
    unique: sql<number>`(
      count(distinct case when ${whereUniquePhone} then ${phoneKeySql} end)
      + count(*) filter (where ${whereUniqueBlank})
    )::int`,
  };
}

function taskExistsSql(taskType: string, statuses: string[]) {
  const statusList = sql.join(
    statuses.map((status) => sql`${status}`),
    sql`, `,
  );
  return sql`EXISTS (
    SELECT 1 FROM ${tasks} t
    WHERE t.lead_id = ${leads.id}
      AND t.org_id = ${leads.orgId}
      AND t.task_type = ${taskType}
      AND t.status IN (${statusList})
  )`;
}

function siteVisitExistsSql(statuses: string[]) {
  const statusList = sql.join(
    statuses.map((status) => sql`${status}`),
    sql`, `,
  );
  return sql`EXISTS (
    SELECT 1 FROM ${siteVisits} sv
    WHERE sv.lead_id = ${leads.id}
      AND sv.org_id = ${leads.orgId}
      AND sv.status IN (${statusList})
  )`;
}

function duplicateLeadSql() {
  return sql`EXISTS (
    SELECT 1 FROM ${leads} l2
    WHERE l2.org_id = ${leads.orgId}
      AND l2.id <> ${leads.id}
      AND l2.deleted_at IS NULL
      AND length(RIGHT(regexp_replace(COALESCE(l2.phone, ''), '[^0-9]', '', 'g'), 10)) >= 10
      AND RIGHT(regexp_replace(COALESCE(l2.phone, ''), '[^0-9]', '', 'g'), 10) = ${phoneKeySql}
      AND (
        l2.created_at < ${leads.createdAt}
        OR (l2.created_at = ${leads.createdAt} AND l2.id::text < ${leads.id}::text)
      )
  )`;
}

function sourceMatrixSelect() {
  const pendingCutoff = newLeadFreshnessCutoff().toISOString();
  const pending = sql`(
    (
      ${leads.leadStatus} = 'contacted'
      OR (${leads.leadStatus} = 'new' AND ${leads.createdAt} < ${pendingCutoff}::timestamptz)
    )
    AND ${leads.nextFollowupAt} IS NULL
  )`;
  const callback = sql`(
    ${leads.nextFollowupAt} IS NOT NULL
    AND ${leads.leadStatus} NOT IN ('won', 'lost', 'dropped', 'not_interested')
  )`;
  const specs = {
    allLeads: matrixCountExprs(),
    newLeads: matrixCountExprs(sql`${leads.leadStatus} = 'new'`),
    pending: matrixCountExprs(pending),
    callback: matrixCountExprs(callback),
    qualified: matrixCountExprs(sql`${leads.leadStatus} = 'qualified'`),
    duplicate: matrixCountExprs(duplicateLeadSql()),
    meetingScheduled: matrixCountExprs(taskExistsSql("meeting", ["pending", "in_progress"])),
    meetingDone: matrixCountExprs(taskExistsSql("meeting", ["completed"])),
    meetingNotDone: matrixCountExprs(taskExistsSql("meeting", ["cancelled"])),
    siteVisitScheduled: matrixCountExprs(siteVisitExistsSql(["scheduled"])),
    siteVisitDone: matrixCountExprs(siteVisitExistsSql(["completed"])),
    siteVisitNotDone: matrixCountExprs(siteVisitExistsSql(["cancelled", "no_show"])),
    booked: matrixCountExprs(sql`${leads.leadStatus} = 'won'`),
    bookingCancel: matrixCountExprs(sql`${leads.leadStatus} = 'lost'`),
    notInterested: matrixCountExprs(sql`${leads.leadStatus} = 'not_interested'`),
    dropped: matrixCountExprs(sql`${leads.leadStatus} = 'dropped'`),
    expressionOfInterest: matrixCountExprs(sql`${leads.leadStatus} = 'negotiation'`),
  };

  return {
    allLeadsCount: specs.allLeads.count,
    allLeadsUnique: specs.allLeads.unique,
    newLeadsCount: specs.newLeads.count,
    newLeadsUnique: specs.newLeads.unique,
    pendingCount: specs.pending.count,
    pendingUnique: specs.pending.unique,
    callbackCount: specs.callback.count,
    callbackUnique: specs.callback.unique,
    qualifiedCount: specs.qualified.count,
    qualifiedUnique: specs.qualified.unique,
    duplicateCount: specs.duplicate.count,
    duplicateUnique: specs.duplicate.unique,
    meetingScheduledCount: specs.meetingScheduled.count,
    meetingScheduledUnique: specs.meetingScheduled.unique,
    meetingDoneCount: specs.meetingDone.count,
    meetingDoneUnique: specs.meetingDone.unique,
    meetingNotDoneCount: specs.meetingNotDone.count,
    meetingNotDoneUnique: specs.meetingNotDone.unique,
    siteVisitScheduledCount: specs.siteVisitScheduled.count,
    siteVisitScheduledUnique: specs.siteVisitScheduled.unique,
    siteVisitDoneCount: specs.siteVisitDone.count,
    siteVisitDoneUnique: specs.siteVisitDone.unique,
    siteVisitNotDoneCount: specs.siteVisitNotDone.count,
    siteVisitNotDoneUnique: specs.siteVisitNotDone.unique,
    bookedCount: specs.booked.count,
    bookedUnique: specs.booked.unique,
    bookingCancelCount: specs.bookingCancel.count,
    bookingCancelUnique: specs.bookingCancel.unique,
    notInterestedCount: specs.notInterested.count,
    notInterestedUnique: specs.notInterested.unique,
    droppedCount: specs.dropped.count,
    droppedUnique: specs.dropped.unique,
    expressionOfInterestCount: specs.expressionOfInterest.count,
    expressionOfInterestUnique: specs.expressionOfInterest.unique,
  };
}

type SourceMatrixSqlRow = {
  source: string | null;
  allLeadsCount: number;
  allLeadsUnique: number;
  newLeadsCount: number;
  newLeadsUnique: number;
  pendingCount: number;
  pendingUnique: number;
  callbackCount: number;
  callbackUnique: number;
  qualifiedCount: number;
  qualifiedUnique: number;
  duplicateCount: number;
  duplicateUnique: number;
  meetingScheduledCount: number;
  meetingScheduledUnique: number;
  meetingDoneCount: number;
  meetingDoneUnique: number;
  meetingNotDoneCount: number;
  meetingNotDoneUnique: number;
  siteVisitScheduledCount: number;
  siteVisitScheduledUnique: number;
  siteVisitDoneCount: number;
  siteVisitDoneUnique: number;
  siteVisitNotDoneCount: number;
  siteVisitNotDoneUnique: number;
  bookedCount: number;
  bookedUnique: number;
  bookingCancelCount: number;
  bookingCancelUnique: number;
  notInterestedCount: number;
  notInterestedUnique: number;
  droppedCount: number;
  droppedUnique: number;
  expressionOfInterestCount: number;
  expressionOfInterestUnique: number;
};

function matrixRowFromSql(source: string, row: SourceMatrixSqlRow): SourceMatrixRow {
  const pair = (count: number, unique: number): SourceMatrixCount => ({
    count: Number(count ?? 0),
    unique: Number(unique ?? 0),
  });
  return {
    source,
    allLeads: pair(row.allLeadsCount, row.allLeadsUnique),
    newLeads: pair(row.newLeadsCount, row.newLeadsUnique),
    pending: pair(row.pendingCount, row.pendingUnique),
    callback: pair(row.callbackCount, row.callbackUnique),
    qualified: pair(row.qualifiedCount, row.qualifiedUnique),
    duplicate: pair(row.duplicateCount, row.duplicateUnique),
    meetingScheduled: pair(row.meetingScheduledCount, row.meetingScheduledUnique),
    meetingDone: pair(row.meetingDoneCount, row.meetingDoneUnique),
    meetingNotDone: pair(row.meetingNotDoneCount, row.meetingNotDoneUnique),
    siteVisitScheduled: pair(row.siteVisitScheduledCount, row.siteVisitScheduledUnique),
    siteVisitDone: pair(row.siteVisitDoneCount, row.siteVisitDoneUnique),
    siteVisitNotDone: pair(row.siteVisitNotDoneCount, row.siteVisitNotDoneUnique),
    booked: pair(row.bookedCount, row.bookedUnique),
    bookingCancel: pair(row.bookingCancelCount, row.bookingCancelUnique),
    notInterested: pair(row.notInterestedCount, row.notInterestedUnique),
    dropped: pair(row.droppedCount, row.droppedUnique),
    expressionOfInterest: pair(row.expressionOfInterestCount, row.expressionOfInterestUnique),
  };
}

function addMatrixRows(left: SourceMatrixRow, right: SourceMatrixRow): SourceMatrixRow {
  const next = { ...left, source: left.source };
  for (const key of SOURCE_MATRIX_KEYS) {
    next[key] = {
      count: left[key].count + right[key].count,
      unique: left[key].unique + right[key].unique,
    };
  }
  return next;
}

async function querySourceStatusMatrix(scope: ReportScope): Promise<{
  rows: SourceMatrixRow[];
  totals: SourceMatrixRow;
}> {
  const sourceKey = sql<string>`COALESCE(NULLIF(btrim(${leads.leadSource}), ''), 'Manual')`;
  const where = scopedLeadCreated(scope);
  const metrics = sourceMatrixSelect();

  const [grouped, ungrouped] = await Promise.all([
    db
      .select({ source: sourceKey, ...metrics })
      .from(leads)
      .where(where)
      .groupBy(sourceKey)
      .orderBy(sql`count(*) desc`),
    db.select(metrics).from(leads).where(where),
  ]);

  const merged = new Map<string, SourceMatrixRow>();
  for (const row of grouped) {
    const label = row.source?.trim() ? formatSourceName(row.source) : "Manual";
    const mapped = matrixRowFromSql(label, row);
    const existing = merged.get(label);
    merged.set(label, existing ? addMatrixRows(existing, mapped) : mapped);
  }

  const rows = [...merged.values()].sort((a, b) => b.allLeads.count - a.allLeads.count);
  const totals = matrixRowFromSql(
    "Total",
    (ungrouped[0] ?? { source: "Total" }) as SourceMatrixSqlRow,
  );

  return { rows, totals };
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

function buildReportLeadExistsFilter(query: CallsReportQuery, leadIdRef: unknown) {
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
    where ${leads.id} = ${leadIdRef}
    and ${leadMatch}
  )`;
}

function callReportLeadExistsFilter(query: CallsReportQuery) {
  return buildReportLeadExistsFilter(query, callRecords.leadId);
}

function siteVisitReportLeadExistsFilter(query: CallsReportQuery) {
  return buildReportLeadExistsFilter(query, sql`sv.lead_id`);
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

/** Expand selected users to their direct reports, or every associate when none are linked. */
async function expandCallsReportUserScope(query: CallsReportQuery): Promise<CallsReportQuery> {
  if (!query.withTeam) return query;

  const managerIds = query.userIds?.length ? query.userIds : query.userId ? [query.userId] : [];

  if (managerIds.length === 0) return query;

  const directReports = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.orgId, SINGLE_TENANT_ORG_ID),
        or(inArray(users.reportingToId, managerIds), inArray(users.generalManagerId, managerIds)),
      ),
    );

  let staffIds: string[] = [];
  if (directReports.length === 0) {
    const staff = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.orgId, SINGLE_TENANT_ORG_ID),
          or(eq(users.role, "agent"), eq(users.role, "manager")),
        ),
      );
    staffIds = staff.map((row) => row.id);
  }

  return {
    ...query,
    userId: undefined,
    userIds: expandTeamUserIds(
      managerIds,
      directReports.map((row) => row.id),
      staffIds,
    ),
  };
}

async function resolveCallsReportQuery(query: CallsReportQuery) {
  return expandCallsReportUserScope(query);
}

/** Self + field staff (agents/managers). Reporting tree is a fallback, not a gate. */
async function listManagerTeamUserIds(managerId: string): Promise<string[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.orgId, SINGLE_TENANT_ORG_ID),
        or(
          eq(users.id, managerId),
          eq(users.role, "agent"),
          eq(users.role, "manager"),
          eq(users.reportingToId, managerId),
          eq(users.generalManagerId, managerId),
        ),
      ),
    );

  return rows.map((row) => row.id);
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
  siteVisitsBooked: number;
  siteVisitsConducted: number;
};

type CallsPerUserTotalsRow = Omit<CallsPerUserMetricsRow, "userId" | "userName">;

const connectedTalk = connectedTalkTimeFilter();
const answeredCall = answeredCallFilter();

function reportUsesLeadFilter(query: CallsReportQuery) {
  return Boolean(
    query.source ||
      query.subSource ||
      query.projectName ||
      query.campaignName ||
      query.projectStatus,
  );
}

function unmatchedDeviceCallExistsSql() {
  return sql`not exists (
    select 1 from ${callRecords} cr
    where cr.user_id = ${agentCallLogs.userId}
      and cr.org_id = ${SINGLE_TENANT_ORG_ID}
      and cr.started_at >= ${agentCallLogs.callStartTime} - interval '2 minutes'
      and cr.started_at <= ${agentCallLogs.callStartTime} + interval '2 minutes'
  )`;
}

function buildCallsPerUserUserWhere(query: CallsReportQuery) {
  const filters = [eq(users.orgId, SINGLE_TENANT_ORG_ID)];

  if (query.userStatus === "active") {
    filters.push(eq(users.isActive, true));
  } else if (query.userStatus === "inactive") {
    filters.push(eq(users.isActive, false));
  }
  if (query.userName) {
    filters.push(ilike(users.name, `%${query.userName}%`));
  }
  if (query.userIds?.length) {
    filters.push(inArray(users.id, query.userIds));
  } else if (query.userId) {
    filters.push(eq(users.id, query.userId));
  }

  return and(...filters);
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
    "Site Visits Booked",
    "Site Visits Conducted",
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
        row.siteVisitsBooked,
        row.siteVisitsConducted,
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
      totals.siteVisitsBooked,
      totals.siteVisitsConducted,
    ].join(","),
  );

  return `${lines.join("\n")}\n`;
}

async function fetchSiteVisitCountsByUser(query: CallsReportQuery) {
  const scope = leadScopeFromQuery(query);
  const userWhere = buildCallsPerUserUserWhere(query);
  const leadFilter = siteVisitReportLeadExistsFilter(query);

  const booked = await db
    .select({
      userId: siteVisits.agentId,
      count: sql<number>`count(*)::int`,
    })
    .from(siteVisits)
    .innerJoin(users, eq(siteVisits.agentId, users.id))
    .where(
      and(
        eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID),
        gte(siteVisits.createdAt, scope.dateFrom),
        lte(siteVisits.createdAt, scope.dateTo),
        ne(siteVisits.status, "cancelled"),
        leadFilter,
        userWhere,
      ),
    )
    .groupBy(siteVisits.agentId);

  const conducted = await db
    .select({
      userId: siteVisits.agentId,
      count: sql<number>`count(*)::int`,
    })
    .from(siteVisits)
    .innerJoin(users, eq(siteVisits.agentId, users.id))
    .where(
      and(
        eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID),
        gte(siteVisits.visitDate, getIstDateKey(scope.dateFrom)),
        lte(siteVisits.visitDate, getIstDateKey(scope.dateTo)),
        eq(siteVisits.status, "completed"),
        leadFilter,
        userWhere,
      ),
    )
    .groupBy(siteVisits.agentId);

  return {
    booked: new Map(booked.map((row) => [row.userId, row.count])),
    conducted: new Map(conducted.map((row) => [row.userId, row.count])),
  };
}

async function buildCallsPerUserReport(query: CallsReportQuery) {
  const people = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(buildCallsPerUserUserWhere(query));

  const userIds = people.map((person) => person.id);
  const leadAttributeFilter = reportUsesLeadFilter(query);
  const events = await loadCombinedCallEvents(db, {
    from: query.dateFrom,
    to: query.dateTo,
    userIds,
    includeDataCalls: !leadAttributeFilter,
    includeDeviceCalls: !leadAttributeFilter,
    leadCallFilter: callReportLeadExistsFilter(query),
  });
  const aggregated = aggregateCombinedCalls(events);
  const visits =
    userIds.length === 0
      ? { booked: new Map<string, number>(), conducted: new Map<string, number>() }
      : await fetchSiteVisitCountsByUser(query);

  const rows: CallsPerUserMetricsRow[] = people.map((person) => {
    const stats = aggregated.byUser.get(person.id) ?? emptyCombinedCallStats();
    return {
      userId: person.id,
      userName: person.name,
      incomingAnswered: stats.incomingAnswered,
      incomingMissed: stats.incomingMissed,
      incomingTotal: stats.incomingTotal,
      outgoingAnswered: stats.outgoingAnswered,
      outgoingNotConnected: stats.outgoingNotConnected,
      outgoingTotal: stats.outgoingTotal,
      totalTalkTimeSeconds: stats.totalTalkTimeSeconds,
      avgTalkTimeSeconds: stats.avgTalkTimeSeconds,
      minTalkTimeSeconds: stats.minTalkTimeSeconds,
      maxTalkTimeSeconds: stats.maxTalkTimeSeconds,
      totalCalls: stats.totalCalls,
      siteVisitsBooked: visits.booked.get(person.id) ?? 0,
      siteVisitsConducted: visits.conducted.get(person.id) ?? 0,
    };
  });

  rows.sort((a, b) => b.totalCalls - a.totalCalls || a.userName.localeCompare(b.userName));

  let siteVisitsBooked = 0;
  let siteVisitsConducted = 0;
  for (const row of rows) {
    siteVisitsBooked += row.siteVisitsBooked;
    siteVisitsConducted += row.siteVisitsConducted;
  }

  const callTotals = sumCallCountTotals(rows);
  const totals: CallsPerUserTotalsRow = {
    ...callTotals,
    siteVisitsBooked,
    siteVisitsConducted,
  };

  return { rows, totals };
}

async function fetchCallsReportPerUserPaginated(query: CallsReportQuery) {
  const scopedQuery = await resolveCallsReportQuery(query);
  const page = scopedQuery.page ?? 1;
  const pageSize = scopedQuery.pageSize ?? 50;
  const offset = (page - 1) * pageSize;
  const built = await buildCallsPerUserReport(scopedQuery);

  return {
    items: built.rows.slice(offset, offset + pageSize),
    total: built.rows.length,
    page,
    pageSize,
    totals: built.totals,
  };
}

async function listCallsReportUserIds(query: CallsReportQuery): Promise<string[]> {
  if (query.userIds?.length) return query.userIds;
  if (query.userId) return [query.userId];
  const people = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.orgId, SINGLE_TENANT_ORG_ID));
  return people.map((row) => row.id);
}

function summarizeCallsAnalytics(events: CombinedCallEvent[]) {
  const unique = dedupeCombinedCalls(events);
  const byDate = new Map<string, { total: number; answered: number; unanswered: number }>();
  const kinds = new Map<string, number>();
  const directions = new Map<string, number>();
  const leadCallsByDate = new Map<string, number>();

  for (const event of unique) {
    const date = getIstDateKey(new Date(event.startedAtMs));
    const bucket = byDate.get(date) ?? { total: 0, answered: 0, unanswered: 0 };
    bucket.total += 1;
    if (event.kind === "answered") bucket.answered += 1;
    else bucket.unanswered += 1;
    byDate.set(date, bucket);
    kinds.set(event.kind, (kinds.get(event.kind) ?? 0) + 1);
    directions.set(event.direction, (directions.get(event.direction) ?? 0) + 1);
    if (event.hasLead) {
      leadCallsByDate.set(date, (leadCallsByDate.get(date) ?? 0) + 1);
    }
  }

  return {
    callsOverTime: [...byDate.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, row]) => ({
        date,
        total_calls: row.total,
        completed_calls: row.answered,
        missed_calls: row.unanswered,
      })),
    dispositionBreakdown: [...kinds.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([disposition, count]) => ({ disposition, count })),
    directionBreakdown: [...directions.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([direction, count]) => ({ direction, count })),
    leadCallsOverTime: [...leadCallsByDate.entries()].map(([date, count]) => ({ date, count })),
  };
}

export const reportService = {
  listManagerTeamUserIds,

  async getDashboard(query: DashboardReportQuery) {
    const leadWhere = scopedLeadCreated({
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      userId: query.userId,
    });
    const callWhere = callStartedFilter(query, query.userId);
    const hotLeadCondition = await resolveHotLeadCondition();

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
          .where(and(leadWhere, hotLeadCondition)),
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
    const built = await buildCallsPerUserReport(scopedQuery);
    return buildCallsUserReportCsv(built.rows, built.totals);
  },

  async exportCallsReportPerUserCsvStream(query: CallsReportQuery) {
    const scopedQuery = await resolveCallsReportQuery(query);
    const built = await buildCallsPerUserReport(scopedQuery);
    const totals = built.totals;

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
      "Site Visits Booked",
      "Site Visits Conducted",
    ];

    const pageSize = 200;
    async function* lines() {
      yield headers.join(",");

      for (let offset = 0; offset < built.rows.length; offset += pageSize) {
        const batch = built.rows.slice(offset, offset + pageSize);

        for (const row of batch) {
          yield [
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
            row.siteVisitsBooked,
            row.siteVisitsConducted,
          ]
            .map((cell) => escapeCsvCell(cell as unknown as string | number))
            .join(",");
        }
      }

      yield [
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
        totals.siteVisitsBooked,
        totals.siteVisitsConducted,
      ]
        .map((cell) => escapeCsvCell(cell as unknown as string | number))
        .join(",");
    }

    return asyncLinesToCsvStream(lines());
  },

  async getCallsReport(query: CallsReportQuery) {
    const scopedQuery = await resolveCallsReportQuery(query);
    const scope = leadScopeFromQuery(scopedQuery);
    const userScope: CallsUserScope = {
      userId: scopedQuery.userId,
      userIds: scopedQuery.userIds,
    };
    const activityWhere = activityScopeFilter(scope, userScope);
    const istDay = (column: SQLWrapper) =>
      sql<string>`to_char(timezone('Asia/Kolkata', ${column}), 'YYYY-MM-DD')`;

    const userIds = await listCallsReportUserIds(scopedQuery);
    const leadAttributeFilter = reportUsesLeadFilter(scopedQuery);
    const [events, meetingsOverTime, notesOverTime] = await Promise.all([
      loadCombinedCallEvents(db, {
        from: scopedQuery.dateFrom,
        to: scopedQuery.dateTo,
        userIds,
        includeDataCalls: !leadAttributeFilter,
        includeDeviceCalls: !leadAttributeFilter,
        leadCallFilter: callReportLeadExistsFilter(scopedQuery),
      }),
      db
        .select({
          date: istDay(leadActivities.createdAt),
          count: sql<number>`count(*)::int`,
        })
        .from(leadActivities)
        .where(and(activityWhere, eq(leadActivities.type, "meeting")))
        .groupBy(istDay(leadActivities.createdAt))
        .orderBy(istDay(leadActivities.createdAt)),
      db
        .select({
          date: istDay(leadActivities.createdAt),
          count: sql<number>`count(*)::int`,
        })
        .from(leadActivities)
        .where(and(activityWhere, eq(leadActivities.type, "note")))
        .groupBy(istDay(leadActivities.createdAt))
        .orderBy(istDay(leadActivities.createdAt)),
    ]);

    const analytics = summarizeCallsAnalytics(events);

    return {
      calls_over_time: analytics.callsOverTime,
      disposition_breakdown: analytics.dispositionBreakdown,
      direction_breakdown: analytics.directionBreakdown,
      activity_on_leads_over_time: buildActivityOnLeadsOverTime(
        analytics.leadCallsOverTime,
        meetingsOverTime.map((row) => ({ date: row.date, count: row.count })),
        notesOverTime.map((row) => ({ date: row.date, count: row.count })),
      ),
    };
  },

  async exportCallsAnalyticsCsvStream(query: CallsReportQuery) {
    const report = await reportService.getCallsReport(query);

    const outcomeLabel = (disposition: string) => {
      switch (disposition) {
        case "answered":
          return "Answered";
        case "no_answer":
          return "No Answer";
        case "busy":
          return "Busy";
        case "left_voicemail":
          return "Left Voicemail";
        default:
          return disposition
            .replace(/_/g, " ")
            .split(" ")
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");
      }
    };

    async function* lines() {
      yield ["Date", "Total Calls", "Answered", "Not answered"].join(",");

      for (const row of report.calls_over_time) {
        yield [row.date, row.total_calls, row.completed_calls, row.missed_calls]
          .map((cell) => escapeCsvCell(cell as unknown as string | number))
          .join(",");
      }

      // Separate outcome breakdown section for the pie chart.
      yield "";
      yield ["Outcome", "Count"].join(",");

      for (const row of report.disposition_breakdown) {
        yield [outcomeLabel(row.disposition), row.count]
          .map((cell) => escapeCsvCell(cell as unknown as string | number))
          .join(",");
      }
    }

    return asyncLinesToCsvStream(lines());
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

    const leadsAssignedWhere = and(
      eq(leads.orgId, SINGLE_TENANT_ORG_ID),
      isNull(leads.deletedAt),
      isNotNull(leads.assignedTo),
      gte(leads.createdAt, dateFrom),
      lte(leads.createdAt, dateTo),
    );

    const tasksCompletedWhere = and(
      eq(tasks.orgId, SINGLE_TENANT_ORG_ID),
      eq(tasks.status, "completed"),
      isNotNull(tasks.assignedTo),
      gte(tasks.completedAt, dateFrom),
      lte(tasks.completedAt, dateTo),
    );

    const [orgUsers, callsMade, deviceCalls, leadsAssigned, tasksCompleted] = await Promise.all([
      db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(and(eq(users.orgId, SINGLE_TENANT_ORG_ID), eq(users.isActive, true)))
        .orderBy(users.name),
      db
        .select({
          userId: callRecords.userId,
          callsMade: sql<number>`count(*)::int`,
        })
        .from(callRecords)
        .where(callWhere)
        .groupBy(callRecords.userId),
      db
        .select({
          userId: agentCallLogs.userId,
          callsMade: sql<number>`count(*)::int`,
        })
        .from(agentCallLogs)
        .where(
          and(
            gte(agentCallLogs.callStartTime, dateFrom),
            lte(agentCallLogs.callStartTime, dateTo),
            unmatchedDeviceCallExistsSql(),
          ),
        )
        .groupBy(agentCallLogs.userId),
      db
        .select({
          userId: leads.assignedTo,
          leadsAssigned: sql<number>`count(distinct ${leads.id})::int`,
        })
        .from(leads)
        .where(leadsAssignedWhere)
        .groupBy(leads.assignedTo),
      db
        .select({
          userId: tasks.assignedTo,
          tasksCompleted: sql<number>`count(*)::int`,
        })
        .from(tasks)
        .where(tasksCompletedWhere)
        .groupBy(tasks.assignedTo),
    ]);

    const callsMap = new Map(callsMade.map((r) => [r.userId, r]));
    const deviceCallsMap = new Map(deviceCalls.map((r) => [r.userId, Number(r.callsMade)]));
    const leadsMap = new Map(leadsAssigned.map((r) => [r.userId, r]));
    const tasksMap = new Map(tasksCompleted.map((r) => [r.userId, r]));

    return {
      users: orgUsers.map((user) => {
        const calls = callsMap.get(user.id);
        const leadsAssignedRow = leadsMap.get(user.id);
        const tasksCompletedRow = tasksMap.get(user.id);

        const callsMadeCount = (calls?.callsMade ?? 0) + (deviceCallsMap.get(user.id) ?? 0);
        const leadsAssignedCount = leadsAssignedRow?.leadsAssigned ?? 0;
        const tasksCompletedCount = tasksCompletedRow?.tasksCompleted ?? 0;

        const conversionRate =
          leadsAssignedCount > 0
            ? Number(((tasksCompletedCount / leadsAssignedCount) * 100).toFixed(2))
            : 0;

        return {
          userId: user.id,
          name: user.name,
          email: user.email,
          leadsAssigned: leadsAssignedCount,
          callsMade: callsMadeCount,
          tasksCompleted: tasksCompletedCount,
          conversionRate,
        };
      }),
    };
  },

  async exportTeamTodayCsvStream(dateFrom: Date, dateTo: Date) {
    const data = await reportService.getTeamToday(dateFrom, dateTo);

    const headers = [
      "Agent Name",
      "Leads Assigned",
      "Calls Made",
      "Tasks Completed",
      "Conversion Rate",
    ];
    async function* lines() {
      yield headers.join(",");
      for (const row of data.users) {
        yield [
          escapeCsvCell(row.name),
          escapeCsvCell(row.leadsAssigned),
          escapeCsvCell(row.callsMade),
          escapeCsvCell(row.tasksCompleted),
          escapeCsvCell(row.conversionRate),
        ].join(",");
      }
    }

    return asyncLinesToCsvStream(lines());
  },

  async getOverviewStats(query: OverviewReportQuery) {
    const scope = leadScopeFromQuery(query);
    const periodStart = scope.dateFrom;
    const periodEnd = scope.dateTo;
    const { start: todayStart, end: todayEnd } = calendarDayRange();
    const { start: yesterdayStart, end: yesterdayEnd } = calendarDayRange(-1);
    const { start: monthStart, end: monthEnd } = calendarMonthRange();
    const hotLeadCondition = await resolveHotLeadCondition();

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
        .where(and(scopedLeadBook(scope), hotLeadCondition)),
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
          score: leads.score,
          lastContactedAt: leads.lastContactedAt,
          nextFollowupAt: leads.nextFollowupAt,
        })
        .from(leads)
        .where(and(scopedLeadBook(scope), hotLeadCondition))
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
        score: row.score,
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
    const [leads_from_source, matrix] = await Promise.all([
      queryLeadsBySource(scope),
      querySourceStatusMatrix(scope),
    ]);
    return { leads_from_source, matrix };
  },

  async exportSourcesReportCsvStream(query: SourcesReportQuery) {
    const scope = leadScopeFromQuery(query);
    const matrix = await querySourceStatusMatrix(scope);
    const headers = [
      "Source Name",
      ...SOURCE_MATRIX_COLUMNS.flatMap((column) => [column.label, `${column.label} unique`]),
    ];
    const cells = (row: SourceMatrixRow) => [
      escapeCsvCell(row.source),
      ...SOURCE_MATRIX_COLUMNS.flatMap((column) => [
        String(row[column.key].count),
        String(row[column.key].unique),
      ]),
    ];
    const lines = async function* () {
      yield headers.map((header) => escapeCsvCell(header)).join(",");
      for (const row of matrix.rows) {
        yield cells(row).join(",");
      }
      yield cells(matrix.totals).join(",");
    };

    return asyncLinesToCsvStream(lines());
  },

  async getProjects() {
    const projectNameExpr = sql<string>`coalesce(${leads.projectName}, ${leads.customFields}->>'project_name')`;
    const hotLeadCondition = await resolveHotLeadCondition();

    const rows = await db
      .select({
        name: projectNameExpr,
        leadsCount: sql<number>`count(*)::int`,
        hotLeadsCount: sql<number>`count(*) filter (where ${hotLeadCondition})::int`,
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

  async getAgentStats(agentId: string) {
    const { start: todayStart, end: todayEnd } = calendarDayRange();
    const { start: monthStart, end: monthEnd } = calendarMonthRange();
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const callBase = and(
      eq(callRecords.orgId, SINGLE_TENANT_ORG_ID),
      eq(callRecords.userId, agentId),
    );

    const [
      [todayCalls],
      [monthCalls],
      [todayLeadsContacted],
      [todayTasksCompleted],
      [todayNewLeads],
      [todayFollowUps],
      [monthTasksCompleted],
      [monthTasksOverdue],
      [monthLeadsConverted],
      [monthLeadsAssigned],
      [monthLeadsContacted],
      bestDayRows,
      callsLast7Days,
      agentCallRanks,
    ] = await Promise.all([
      db
        .select({
          callsMade: sql<number>`count(*)::int`,
          callsAnswered: sql<number>`count(*) filter (where ${answeredCall})::int`,
        })
        .from(callRecords)
        .where(
          and(
            callBase,
            gte(callRecords.startedAt, todayStart),
            lte(callRecords.startedAt, todayEnd),
          ),
        ),
      db
        .select({
          totalCalls: sql<number>`count(*)::int`,
          answeredCalls: sql<number>`count(*) filter (where ${answeredCall})::int`,
          avgDurationSeconds: sql<number>`coalesce(round(avg(${callRecords.durationSeconds}) filter (where ${connectedTalk})), 0)::int`,
        })
        .from(callRecords)
        .where(
          and(
            callBase,
            gte(callRecords.startedAt, monthStart),
            lte(callRecords.startedAt, monthEnd),
          ),
        ),
      db
        .select({
          count: sql<number>`count(distinct ${callRecords.leadId})::int`,
        })
        .from(callRecords)
        .where(
          and(
            callBase,
            isNotNull(callRecords.leadId),
            gte(callRecords.startedAt, todayStart),
            lte(callRecords.startedAt, todayEnd),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(
          and(
            eq(tasks.orgId, SINGLE_TENANT_ORG_ID),
            eq(tasks.assignedTo, agentId),
            eq(tasks.status, "completed"),
            gte(tasks.completedAt, todayStart),
            lte(tasks.completedAt, todayEnd),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(
          and(
            leadBaseFilter(),
            eq(leads.assignedTo, agentId),
            gte(leads.createdAt, todayStart),
            lte(leads.createdAt, todayEnd),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leadActivities)
        .innerJoin(leads, eq(leadActivities.leadId, leads.id))
        .where(
          and(
            eq(leadActivities.orgId, SINGLE_TENANT_ORG_ID),
            eq(leadActivities.type, "follow_up"),
            eq(leadActivities.userId, agentId),
            gte(leadActivities.createdAt, todayStart),
            lte(leadActivities.createdAt, todayEnd),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(
          and(
            eq(tasks.orgId, SINGLE_TENANT_ORG_ID),
            eq(tasks.assignedTo, agentId),
            eq(tasks.status, "completed"),
            gte(tasks.completedAt, monthStart),
            lte(tasks.completedAt, monthEnd),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(
          and(
            eq(tasks.orgId, SINGLE_TENANT_ORG_ID),
            eq(tasks.assignedTo, agentId),
            eq(tasks.status, "pending"),
            isNotNull(tasks.dueAt),
            lt(tasks.dueAt, new Date()),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(
          and(
            leadBaseFilter(),
            eq(leads.assignedTo, agentId),
            eq(leads.leadStatus, "won"),
            gte(leads.updatedAt, monthStart),
            lte(leads.updatedAt, monthEnd),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(
          and(
            leadBaseFilter(),
            eq(leads.assignedTo, agentId),
            gte(leads.createdAt, monthStart),
            lte(leads.createdAt, monthEnd),
          ),
        ),
      db
        .select({
          count: sql<number>`count(distinct ${leads.id})::int`,
        })
        .from(leads)
        .where(
          and(
            leadBaseFilter(),
            eq(leads.assignedTo, agentId),
            isNotNull(leads.lastContactedAt),
            gte(leads.lastContactedAt, monthStart),
            lte(leads.lastContactedAt, monthEnd),
          ),
        ),
      db
        .select({
          date: sql<string>`to_char(${callRecords.startedAt}::date, 'YYYY-MM-DD')`,
          calls: sql<number>`count(*)::int`,
        })
        .from(callRecords)
        .where(
          and(
            callBase,
            gte(callRecords.startedAt, monthStart),
            lte(callRecords.startedAt, monthEnd),
          ),
        )
        .groupBy(sql`${callRecords.startedAt}::date`)
        .orderBy(sql`count(*) desc`)
        .limit(1),
      db
        .select({
          date: sql<string>`to_char(${callRecords.startedAt}::date, 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(callRecords)
        .where(
          and(
            callBase,
            gte(callRecords.startedAt, sevenDaysAgo),
            lte(callRecords.startedAt, todayEnd),
          ),
        )
        .groupBy(sql`${callRecords.startedAt}::date`)
        .orderBy(sql`${callRecords.startedAt}::date`),
      db
        .select({
          userId: callRecords.userId,
          callsThisMonth: sql<number>`count(*)::int`,
        })
        .from(callRecords)
        .innerJoin(users, eq(callRecords.userId, users.id))
        .where(
          and(
            eq(callRecords.orgId, SINGLE_TENANT_ORG_ID),
            eq(users.orgId, SINGLE_TENANT_ORG_ID),
            eq(users.role, "agent"),
            eq(users.isActive, true),
            gte(callRecords.startedAt, monthStart),
            lte(callRecords.startedAt, monthEnd),
          ),
        )
        .groupBy(callRecords.userId)
        .orderBy(sql`count(*) desc`),
    ]);

    const callsMade = todayCalls?.callsMade ?? 0;
    const callsAnswered = todayCalls?.callsAnswered ?? 0;
    const totalCalls = monthCalls?.totalCalls ?? 0;
    const answeredCalls = monthCalls?.answeredCalls ?? 0;
    const leadsAssigned = monthLeadsAssigned?.count ?? 0;
    const leadsContacted = monthLeadsContacted?.count ?? 0;

    const sortedRanks = agentCallRanks.map((row, index) => ({
      agentId: row.userId,
      agentName: "",
      callsThisMonth: row.callsThisMonth,
      leadsConverted: 0,
      rank: index + 1,
    }));

    const rankIndex = sortedRanks.findIndex((row) => row.agentId === agentId);

    return {
      today: {
        callsMade,
        callsAnswered,
        callsAnsweredPercent: callsMade > 0 ? Math.round((callsAnswered / callsMade) * 100) : 0,
        leadsContacted: todayLeadsContacted?.count ?? 0,
        tasksCompleted: todayTasksCompleted?.count ?? 0,
        newLeadsAssigned: todayNewLeads?.count ?? 0,
        followUpsDone: todayFollowUps?.count ?? 0,
      },
      thisMonth: {
        totalCalls,
        answeredPercent: totalCalls > 0 ? Math.round((answeredCalls / totalCalls) * 100) : 0,
        avgCallDurationMinutes: Math.round((monthCalls?.avgDurationSeconds ?? 0) / 60),
        leadsConverted: monthLeadsConverted?.count ?? 0,
        leadsAssigned,
        leadsContacted,
        leadsAssignedVsContactedRatio:
          leadsAssigned > 0 ? Math.round((leadsContacted / leadsAssigned) * 100) : 0,
        tasksCompleted: monthTasksCompleted?.count ?? 0,
        tasksOverdue: monthTasksOverdue?.count ?? 0,
        bestDay: bestDayRows[0] ? { date: bestDayRows[0].date, calls: bestDayRows[0].calls } : null,
      },
      callsLast7Days: callsLast7Days.map((row) => ({ date: row.date, count: row.count })),
      leaderboard: {
        rank: rankIndex >= 0 ? rankIndex + 1 : sortedRanks.length + 1,
        totalAgents: sortedRanks.length,
        metric: "callsThisMonth" as const,
        entries: sortedRanks.slice(0, 10),
      },
    };
  },
};
