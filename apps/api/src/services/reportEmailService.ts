import {
  callRecords,
  leadActivities,
  leads,
  organizations,
  siteVisits,
  users,
} from "@propninja/db";
import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, sql } from "drizzle-orm";
import {
  type ReportMetricRow,
  buildReportSummaryHtml,
  buildReportSummarySubject,
  buildReportSummaryText,
} from "../emails/reportSummary.js";
import { answeredCallFilter } from "../lib/callTalkTime.js";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { type Database, db } from "../lib/db.js";
import { getIstDayBounds } from "../lib/istSchedule.js";
import { buildReportUnsubscribeUrl } from "../lib/reportUnsubscribe.js";
import { sendHtmlEmail } from "../lib/resendEmail.js";

export type ReportSummaryData = {
  date: string;
  newLeads: number;
  totalCallsMade: number;
  callsAnswered: number;
  siteVisitsToday: number;
  overdueFollowUps: number;
  coldLeads: number;
  leadsWon: number;
};

export type ReportSummaryComparison = {
  current: ReportSummaryData;
  previous: ReportSummaryData;
  topAgents?: { name: string; callsMade: number }[];
};

type DateRange = {
  start: Date;
  end: Date;
  dateKey: string;
  fromDateKey?: string;
  toDateKey?: string;
};

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function leadBaseFilter() {
  return and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), isNull(leads.deletedAt));
}

async function countNewLeads(range: DateRange) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(
      and(leadBaseFilter(), gte(leads.createdAt, range.start), lte(leads.createdAt, range.end)),
    );
  return row?.count ?? 0;
}

async function countCalls(range: DateRange, answeredOnly = false) {
  const filters = [
    eq(callRecords.orgId, SINGLE_TENANT_ORG_ID),
    gte(callRecords.startedAt, range.start),
    lte(callRecords.startedAt, range.end),
  ];
  if (answeredOnly) {
    filters.push(answeredCallFilter());
  }
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(callRecords)
    .where(and(...filters));
  return row?.count ?? 0;
}

async function countSiteVisitsOnDate(dateKey: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(siteVisits)
    .where(
      and(
        eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID),
        eq(siteVisits.visitDate, dateKey),
        ne(siteVisits.status, "cancelled"),
      ),
    );
  return row?.count ?? 0;
}

async function countSiteVisitsBetween(fromDateKey: string, toDateKey: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(siteVisits)
    .where(
      and(
        eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID),
        gte(siteVisits.visitDate, fromDateKey),
        lte(siteVisits.visitDate, toDateKey),
        ne(siteVisits.status, "cancelled"),
      ),
    );
  return row?.count ?? 0;
}

async function countOverdueFollowUps(at: Date) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(
      and(
        leadBaseFilter(),
        isNotNull(leads.nextFollowupAt),
        lte(leads.nextFollowupAt, at),
        sql`${leads.leadStatus} not in ('won', 'lost')`,
      ),
    );
  return row?.count ?? 0;
}

async function countColdLeads() {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(leadBaseFilter(), isNotNull(leads.coldSince)));
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
        gte(leadActivities.createdAt, range.start),
        lte(leadActivities.createdAt, range.end),
      ),
    );
  return row?.count ?? 0;
}

async function aggregatePeriod(range: DateRange): Promise<ReportSummaryData> {
  const [
    newLeads,
    totalCallsMade,
    callsAnswered,
    siteVisitsCount,
    overdueFollowUps,
    coldLeads,
    leadsWon,
  ] = await Promise.all([
    countNewLeads(range),
    countCalls(range),
    countCalls(range, true),
    countSiteVisitsOnDate(range.dateKey),
    countOverdueFollowUps(range.end),
    countColdLeads(),
    countLeadsWon(range),
  ]);

  return {
    date: range.dateKey,
    newLeads,
    totalCallsMade,
    callsAnswered,
    siteVisitsToday: siteVisitsCount,
    overdueFollowUps,
    coldLeads,
    leadsWon,
  };
}

function getWeeklyRanges(reference = new Date()) {
  const endDay = getIstDayBounds(-1, reference);
  const startDay = getIstDayBounds(-7, reference);
  const priorEndDay = getIstDayBounds(-8, reference);
  const priorStartDay = getIstDayBounds(-14, reference);

  const current: DateRange = {
    start: startDay.start,
    end: endDay.end,
    dateKey: `${startDay.dateKey} — ${endDay.dateKey}`,
    fromDateKey: startDay.dateKey,
    toDateKey: endDay.dateKey,
  };
  const previous: DateRange = {
    start: priorStartDay.start,
    end: priorEndDay.end,
    dateKey: `${priorStartDay.dateKey} — ${priorEndDay.dateKey}`,
    fromDateKey: priorStartDay.dateKey,
    toDateKey: priorEndDay.dateKey,
  };
  return { current, previous };
}

async function aggregateWeeklyPeriod(range: DateRange): Promise<ReportSummaryData> {
  const fromKey = range.fromDateKey ?? range.dateKey;
  const toKey = range.toDateKey ?? range.dateKey;
  const [
    newLeads,
    totalCallsMade,
    callsAnswered,
    siteVisitsCount,
    overdueFollowUps,
    coldLeads,
    leadsWon,
  ] = await Promise.all([
    countNewLeads(range),
    countCalls(range),
    countCalls(range, true),
    countSiteVisitsBetween(fromKey, toKey),
    countOverdueFollowUps(range.end),
    countColdLeads(),
    countLeadsWon(range),
  ]);

  return {
    date: range.dateKey,
    newLeads,
    totalCallsMade,
    callsAnswered,
    siteVisitsToday: siteVisitsCount,
    overdueFollowUps,
    coldLeads,
    leadsWon,
  };
}

async function fetchTopAgentsByCalls(range: DateRange, limit = 3) {
  const rows = await db
    .select({
      name: users.name,
      callsMade: sql<number>`count(*)::int`,
    })
    .from(callRecords)
    .innerJoin(users, eq(callRecords.userId, users.id))
    .where(
      and(
        eq(callRecords.orgId, SINGLE_TENANT_ORG_ID),
        gte(callRecords.startedAt, range.start),
        lte(callRecords.startedAt, range.end),
      ),
    )
    .groupBy(users.id, users.name)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  return rows.map((row) => ({ name: row.name, callsMade: row.callsMade }));
}

export function summaryToMetricRows(
  current: ReportSummaryData,
  previous: ReportSummaryData,
): ReportMetricRow[] {
  return [
    {
      label: "New leads",
      value: current.newLeads,
      previousValue: previous.newLeads,
      changePercent: pctChange(current.newLeads, previous.newLeads),
    },
    {
      label: "Calls made",
      value: current.totalCallsMade,
      previousValue: previous.totalCallsMade,
      changePercent: pctChange(current.totalCallsMade, previous.totalCallsMade),
    },
    {
      label: "Calls answered",
      value: current.callsAnswered,
      previousValue: previous.callsAnswered,
      changePercent: pctChange(current.callsAnswered, previous.callsAnswered),
    },
    {
      label: "Site visits",
      value: current.siteVisitsToday,
      previousValue: previous.siteVisitsToday,
      changePercent: pctChange(current.siteVisitsToday, previous.siteVisitsToday),
    },
    {
      label: "Overdue follow-ups",
      value: current.overdueFollowUps,
      previousValue: previous.overdueFollowUps,
      changePercent: pctChange(current.overdueFollowUps, previous.overdueFollowUps),
    },
    {
      label: "Cold leads",
      value: current.coldLeads,
      previousValue: previous.coldLeads,
      changePercent: pctChange(current.coldLeads, previous.coldLeads),
    },
    {
      label: "Leads won",
      value: current.leadsWon,
      previousValue: previous.leadsWon,
      changePercent: pctChange(current.leadsWon, previous.leadsWon),
    },
  ];
}

export async function aggregateDailyReportSummary(
  reference = new Date(),
): Promise<ReportSummaryComparison> {
  const currentRange = getIstDayBounds(-1, reference);
  const previousRange = getIstDayBounds(-2, reference);
  const [current, previous] = await Promise.all([
    aggregatePeriod(currentRange),
    aggregatePeriod(previousRange),
  ]);
  return { current, previous };
}

export async function aggregateWeeklyReportSummary(
  reference = new Date(),
): Promise<ReportSummaryComparison> {
  const { current: currentRange, previous: previousRange } = getWeeklyRanges(reference);
  const [current, previous, topAgents] = await Promise.all([
    aggregateWeeklyPeriod(currentRange),
    aggregateWeeklyPeriod(previousRange),
    fetchTopAgentsByCalls(currentRange),
  ]);
  return { current, previous, topAgents };
}

export function isReportEmailEnabledForOrg(settings: Record<string, unknown> | null | undefined) {
  return settings?.reportEmailEnabled === true;
}

export async function getReportEmailRecipients(database: Database = db) {
  return database
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    })
    .from(users)
    .where(
      and(
        eq(users.orgId, SINGLE_TENANT_ORG_ID),
        eq(users.isActive, true),
        eq(users.reportEmailEnabled, true),
        inArray(users.role, ["admin", "manager"]),
      ),
    );
}

async function updateOrgReportSentAt(
  database: Database,
  key: "reportEmailLastSentAt" | "reportEmailLastWeeklySentAt",
) {
  const [org] = await database
    .select()
    .from(organizations)
    .where(eq(organizations.id, SINGLE_TENANT_ORG_ID))
    .limit(1);
  if (!org) return;

  const settings = {
    ...(org.settings ?? {}),
    [key]: new Date().toISOString(),
  };

  await database
    .update(organizations)
    .set({ settings })
    .where(eq(organizations.id, SINGLE_TENANT_ORG_ID));
}

async function sendSummaryToRecipients(
  input: {
    comparison: ReportSummaryComparison;
    isWeekly: boolean;
    periodLabel: string;
    comparisonLabel: string;
  },
  database: Database = db,
) {
  const recipients = await getReportEmailRecipients(database);
  let sent = 0;

  const subject = buildReportSummarySubject(input.periodLabel, input.isWeekly);
  const metrics = summaryToMetricRows(input.comparison.current, input.comparison.previous);

  await Promise.all(
    recipients.map(async (recipient) => {
      const unsubscribeUrl = buildReportUnsubscribeUrl(recipient.id);
      const html = buildReportSummaryHtml({
        recipientName: recipient.name,
        periodLabel: input.periodLabel,
        comparisonLabel: input.comparisonLabel,
        metrics,
        topAgents: input.comparison.topAgents,
        unsubscribeUrl,
      });
      const text = buildReportSummaryText({
        recipientName: recipient.name,
        periodLabel: input.periodLabel,
        comparisonLabel: input.comparisonLabel,
        metrics,
        topAgents: input.comparison.topAgents,
        unsubscribeUrl,
      });
      await sendHtmlEmail({ to: recipient.email, subject, html, text });
      sent += 1;
    }),
  );

  return { sent, recipients: recipients.length };
}

export async function sendDailyReportEmails(database: Database = db, reference = new Date()) {
  const [org] = await database
    .select()
    .from(organizations)
    .where(eq(organizations.id, SINGLE_TENANT_ORG_ID))
    .limit(1);

  if (!org || !isReportEmailEnabledForOrg(org.settings)) {
    return { skipped: true, reason: "disabled" as const };
  }

  const comparison = await aggregateDailyReportSummary(reference);
  const result = await sendSummaryToRecipients(
    {
      comparison,
      isWeekly: false,
      periodLabel: comparison.current.date,
      comparisonLabel: comparison.previous.date,
    },
    database,
  );

  if (result.sent > 0) {
    await updateOrgReportSentAt(database, "reportEmailLastSentAt");
  }

  return { skipped: false, ...result, date: comparison.current.date };
}

export async function sendWeeklyReportEmails(database: Database = db, reference = new Date()) {
  const [org] = await database
    .select()
    .from(organizations)
    .where(eq(organizations.id, SINGLE_TENANT_ORG_ID))
    .limit(1);

  if (!org || !isReportEmailEnabledForOrg(org.settings)) {
    return { skipped: true, reason: "disabled" as const };
  }

  const comparison = await aggregateWeeklyReportSummary(reference);
  const result = await sendSummaryToRecipients(
    {
      comparison,
      isWeekly: true,
      periodLabel: comparison.current.date,
      comparisonLabel: comparison.previous.date,
    },
    database,
  );

  if (result.sent > 0) {
    await updateOrgReportSentAt(database, "reportEmailLastWeeklySentAt");
  }

  return { skipped: false, ...result, period: comparison.current.date };
}

export async function sendTestReportEmail(
  recipient: { id: string; email: string; name: string },
  _database: Database = db,
) {
  const comparison = await aggregateDailyReportSummary();
  const metrics = summaryToMetricRows(comparison.current, comparison.previous);
  const unsubscribeUrl = buildReportUnsubscribeUrl(recipient.id);
  const subject = `[Test] ${buildReportSummarySubject(comparison.current.date, false)}`;

  await sendHtmlEmail({
    to: recipient.email,
    subject,
    html: buildReportSummaryHtml({
      recipientName: recipient.name,
      periodLabel: comparison.current.date,
      comparisonLabel: comparison.previous.date,
      metrics,
      unsubscribeUrl,
    }),
    text: buildReportSummaryText({
      recipientName: recipient.name,
      periodLabel: comparison.current.date,
      comparisonLabel: comparison.previous.date,
      metrics,
      unsubscribeUrl,
    }),
  });
}

export async function unsubscribeUserFromReports(userId: string, database: Database = db) {
  const [updated] = await database
    .update(users)
    .set({ reportEmailEnabled: false })
    .where(eq(users.id, userId))
    .returning({ id: users.id });

  return updated ?? null;
}

export const reportEmailAggregators = {
  aggregatePeriod,
  aggregateWeeklyPeriod,
  pctChange,
  summaryToMetricRows,
};
