import { callRecords, leadActivities, leads, users } from "@propninja/db";
import { and, eq, gte, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import type {
  CallsReportQuery,
  DashboardReportQuery,
  LeadsReportQuery,
} from "../lib/validators/reports.js";

type DateRange = { dateFrom: Date; dateTo: Date };

const PIPELINE_STAGES = ["new", "contacted", "negotiation", "won"] as const;

function leadBaseFilter() {
  return and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), isNull(leads.deletedAt));
}

async function pipelineStageStats(status: string, thirtyDaysAgo: Date, sixtyDaysAgo: Date) {
  const stageFilter = and(leadBaseFilter(), eq(leads.leadStatus, status));

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
      .where(and(stageFilter, gte(leads.updatedAt, thirtyDaysAgo))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(
        and(stageFilter, gte(leads.updatedAt, sixtyDaysAgo), lt(leads.updatedAt, thirtyDaysAgo)),
      ),
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
    status,
    count: current?.count ?? 0,
    total_value: Number(current?.totalValue ?? 0),
    trend_percent: trendPercent,
  };
}

function leadCreatedFilter(range: DateRange, userId?: string) {
  const filters = [
    eq(leads.orgId, SINGLE_TENANT_ORG_ID),
    isNull(leads.deletedAt),
    gte(leads.createdAt, range.dateFrom),
    lte(leads.createdAt, range.dateTo),
  ];

  if (userId) {
    filters.push(eq(leads.assignedTo, userId));
  }

  return and(...filters);
}

function callStartedFilter(range: DateRange, userId?: string) {
  const filters = [
    eq(callRecords.orgId, SINGLE_TENANT_ORG_ID),
    gte(callRecords.startedAt, range.dateFrom),
    lte(callRecords.startedAt, range.dateTo),
  ];

  if (userId) {
    filters.push(eq(callRecords.userId, userId));
  }

  return and(...filters);
}

export const reportService = {
  async getDashboard(query: DashboardReportQuery) {
    const leadWhere = leadCreatedFilter(query, query.userId);
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

  async getCallsReport(query: CallsReportQuery) {
    const callWhere = callStartedFilter(query, query.userId);

    const [callsOverTime, dispositionBreakdown, directionBreakdown] = await Promise.all([
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

    const [newLeadsOverTime, statusConversion, [avgFirstCall]] = await Promise.all([
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

    return {
      new_leads_over_time: newLeadsOverTime.map((row) => ({
        date: row.date,
        count: row.count,
      })),
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

  async getOverviewStats() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

    const weekAgo = new Date(todayStart);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const thirtyDaysAgo = new Date(todayStart);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(todayStart);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

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
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(
          and(
            eq(leads.orgId, SINGLE_TENANT_ORG_ID),
            isNull(leads.deletedAt),
            gte(leads.createdAt, todayStart),
            lte(leads.createdAt, todayEnd),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(
          and(
            eq(leads.orgId, SINGLE_TENANT_ORG_ID),
            isNull(leads.deletedAt),
            gte(leads.createdAt, yesterdayStart),
            lte(leads.createdAt, yesterdayEnd),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(
          and(
            eq(leads.orgId, SINGLE_TENANT_ORG_ID),
            isNull(leads.deletedAt),
            eq(leads.temperature, "hot"),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leadActivities)
        .where(
          and(
            eq(leadActivities.orgId, SINGLE_TENANT_ORG_ID),
            eq(leadActivities.type, "status_change"),
            gte(leadActivities.createdAt, monthStart),
            lte(leadActivities.createdAt, todayEnd),
            sql`${leadActivities.metadata}->>'to' = 'won'`,
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
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(
          and(
            leadBaseFilter(),
            isNotNull(leads.nextFollowupAt),
            lte(leads.nextFollowupAt, todayEnd),
          ),
        ),
      db
        .select({
          status: leads.leadStatus,
          count: sql<number>`count(*)::int`,
        })
        .from(leads)
        .where(and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), isNull(leads.deletedAt)))
        .groupBy(leads.leadStatus),
      db
        .select({
          date: sql<string>`to_char(date_trunc('day', ${callRecords.startedAt}), 'YYYY-MM-DD')`,
          total: sql<number>`count(*)::int`,
        })
        .from(callRecords)
        .where(
          and(
            eq(callRecords.orgId, SINGLE_TENANT_ORG_ID),
            gte(callRecords.startedAt, weekAgo),
            lte(callRecords.startedAt, todayEnd),
          ),
        )
        .groupBy(sql`date_trunc('day', ${callRecords.startedAt})`)
        .orderBy(sql`date_trunc('day', ${callRecords.startedAt})`),
      db
        .select({
          date: sql<string>`to_char(date_trunc('day', ${leads.createdAt}), 'YYYY-MM-DD')`,
          total: sql<number>`count(*)::int`,
        })
        .from(leads)
        .where(and(leadBaseFilter(), gte(leads.createdAt, weekAgo), lte(leads.createdAt, todayEnd)))
        .groupBy(sql`date_trunc('day', ${leads.createdAt})`)
        .orderBy(sql`date_trunc('day', ${leads.createdAt})`),
      Promise.all(
        PIPELINE_STAGES.map((stage) => pipelineStageStats(stage, thirtyDaysAgo, sixtyDaysAgo)),
      ),
      db
        .select({
          total: sql<string>`coalesce(sum(${leads.estimatedValue}::numeric), 0)`,
        })
        .from(leads)
        .where(
          and(
            leadBaseFilter(),
            eq(leads.leadStatus, "won"),
            gte(leads.updatedAt, monthStart),
            lte(leads.updatedAt, todayEnd),
          ),
        ),
      db
        .select({
          avg: sql<string | null>`avg(${leads.estimatedValue}::numeric)`,
        })
        .from(leads)
        .where(and(leadBaseFilter(), eq(leads.leadStatus, "won"), isNotNull(leads.estimatedValue))),
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
        .where(and(leadBaseFilter(), eq(leads.temperature, "hot")))
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
        .where(and(leadBaseFilter(), isNotNull(leads.assignedTo)))
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
            gte(leadActivities.createdAt, monthStart),
            lte(leadActivities.createdAt, todayEnd),
            sql`${leadActivities.metadata}->>'to' = 'won'`,
          ),
        )
        .groupBy(leadActivities.userId),
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
    };
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
