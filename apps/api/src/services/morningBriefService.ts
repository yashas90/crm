import {
  agentCallingData,
  agentDevices,
  agentTargets,
  contactCallLogs,
  leads,
  projects,
  siteVisits,
  users,
} from "@propninja/db";
import {
  formatVisitTimeIst,
  getIstDateKey,
  getIstDayBounds,
  getIstHourMinute,
} from "@propninja/types/ist";
import { formatINR } from "@propninja/types/money";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { appraisalResult } from "../lib/appraisalMath.js";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import type { Database } from "../lib/db.js";
import { notFound } from "../lib/errors.js";
import {
  BADGE_META,
  type LeaderboardDeal,
  type LeaderboardPerson,
  assembleLeaderboard,
  dealClosedMessage,
} from "../lib/leaderboardRank.js";
import {
  aboveTargetPercent,
  briefFirstName,
  dailyNeeded,
  daysRemainingInIstMonth,
  formatIstBriefDate,
  greetingForIstClock,
  isIncentiveUnlocked,
  quoteForIstDate,
  resolveMonthlyTarget,
} from "../lib/morningBriefMath.js";
import { dateInQuarter, quarterFromDate } from "../lib/quarters.js";
import { sqlTimestamptz } from "../lib/sqlTimestamp.js";
import type { AuthUser } from "../middleware/auth.js";
import { loadLeaderboardFacts } from "./leaderboardService.js";

const CALLBACK_LIMIT = 20;

export type MorningCallback = {
  id: string;
  source: "lead" | "calling";
  name: string;
  phone: string | null;
  at: string;
  leadId: string | null;
};

export type MorningBrief = {
  greeting: string;
  name: string;
  date: string;
  trackingStatus: {
    on: boolean;
    label: "On" | "Off";
    health: string | null;
    agentStatus: string | null;
    lastSeenAt: string | null;
  };
  quoteOfDay: { text: string; dayOfYear: number };
  target: {
    amount: number;
    amountLabel: string;
    achieved: number;
    achievedLabel: string;
    dailyNeeded: number;
    dailyNeededLabel: string;
    daysRemaining: number;
    percent: number;
    unlocked: boolean;
    aboveTargetPercent: number;
    band: string | null;
    source: "incentive" | "agent_target" | "none";
  };
  teamTarget: {
    memberCount: number;
    target: number;
    targetLabel: string;
    achieved: number;
    achievedLabel: string;
    aboveTargetCount: number;
  } | null;
  callbacks: {
    overdue: MorningCallback[];
    today: MorningCallback[];
    count: number;
  };
  leaderboard: {
    rank: number;
    previousRank: number | null;
    trend: "up" | "down" | "flat";
    nameAbove: string | null;
    neighborBelow: { name: string; rank: number } | null;
    gapToNext: number;
    gapToNextLabel: string;
  };
  callingData: {
    pending: number;
    calledToday: number;
    interestedToday: number;
    remaining: number;
  };
  leads: {
    hot: number;
    warm: number;
    cold: number;
    siteVisit: number;
    negotiation: number;
    urgent: number;
  };
  teamFeed: {
    items: {
      id: string;
      kind: "deal" | "announcement" | "badge";
      title: string;
      body: string;
      at: string;
      reactions: number;
    }[];
    viewAll: {
      label: string;
      surface: "whatsapp" | "announcements";
      webPath: string;
    };
  };
  schedule: {
    items: {
      id: string;
      time: string;
      timeLabel: string;
      leadName: string;
      projectName: string | null;
      status: string;
      agentName: string | null;
    }[];
  };
  appraisal: {
    quarter: string;
    quarterLabel: string;
    mapped: boolean;
    sales: number;
    units: number;
    minSales: number | null;
    minUnits: number | null;
    hikePercent: number;
    eligible: boolean;
    hikeAmount: number;
    hikeAmountLabel: string;
  };
};

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function countOf(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function directReportIds(people: LeaderboardPerson[], viewerId: string) {
  return people
    .filter((person) => person.reportingToId === viewerId)
    .map((person) => person.userId);
}

function dataUserIds(role: AuthUser["role"], people: LeaderboardPerson[], viewerId: string) {
  if (role !== "manager") return [viewerId];
  return [...new Set([viewerId, ...directReportIds(people, viewerId)])];
}

function squadIds(people: LeaderboardPerson[], viewer: LeaderboardPerson) {
  const leadId = viewer.role === "agent" ? (viewer.reportingToId ?? viewer.userId) : viewer.userId;
  return people
    .filter((person) => person.userId === leadId || person.reportingToId === leadId)
    .map((person) => person.userId);
}

function collectedNr(deals: LeaderboardDeal[], userId: string, monthKey: string) {
  let total = 0;
  for (const deal of deals) {
    if (deal.status !== "approved" || deal.invoiceStatus !== "collected") continue;
    if (!deal.closedOn?.startsWith(monthKey)) continue;
    const pct = deal.shares.find((share) => share.userId === userId)?.sharePercent ?? 0;
    if (pct <= 0) continue;
    total = money(total + (Math.max(0, deal.netRevenue) * pct) / 100);
  }
  return total;
}

function achievementPercent(achieved: number, target: number) {
  if (target <= 0) return 0;
  return Math.round((achieved / target) * 1000) / 10;
}

export async function buildMorningBrief(
  db: Database,
  user: AuthUser,
  now = new Date(),
): Promise<MorningBrief> {
  const dateKey = getIstDateKey(now);
  const monthKey = dateKey.slice(0, 7);
  const { start, end } = getIstDayBounds(0, now);
  const clock = getIstHourMinute(now);
  const quarter = quarterFromDate(dateKey) ?? quarterFromDate(now);

  const [facts, profileRow, targetRows, deviceRows] = await Promise.all([
    loadLeaderboardFacts(db, now),
    db
      .select({
        firstName: users.firstName,
        name: users.name,
        designation: users.designation,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1),
    db
      .select({
        userId: agentTargets.userId,
        targetRevenue: agentTargets.targetRevenue,
      })
      .from(agentTargets)
      .where(and(eq(agentTargets.orgId, SINGLE_TENANT_ORG_ID), eq(agentTargets.month, monthKey))),
    db
      .select({
        trackingEnabled: agentDevices.trackingEnabled,
        healthStatus: agentDevices.healthStatus,
        agentStatus: agentDevices.agentStatus,
        lastSeenAt: agentDevices.lastSeenAt,
      })
      .from(agentDevices)
      .where(eq(agentDevices.userId, user.id))
      .orderBy(desc(agentDevices.isCurrent), desc(agentDevices.lastSeenAt))
      .limit(1),
  ]);

  const viewer =
    facts.people.find((person) => person.userId === user.id) ??
    ({
      userId: user.id,
      name: profileRow[0]?.name ?? user.name,
      role: user.role,
      designation: profileRow[0]?.designation ?? null,
      band: null,
      monthlyBasic: 0,
      reportingToId: null,
      department: null,
      showLeaderboardAvatar: false,
    } satisfies LeaderboardPerson);

  const scopeIds = dataUserIds(user.role, facts.people, user.id);
  const storedByUser = new Map(
    targetRows.map((row) => [row.userId, Number(row.targetRevenue ?? 0)]),
  );
  const personalTarget = resolveMonthlyTarget({
    monthlyBasic: viewer.monthlyBasic,
    band: viewer.band,
    storedRevenueTarget: storedByUser.get(user.id) ?? 0,
  });
  const achieved = collectedNr(facts.deals, user.id, monthKey);
  const daysRemaining = daysRemainingInIstMonth(now);
  const needed = dailyNeeded(personalTarget.amount, achieved, daysRemaining);
  const showTeam = user.role === "manager" || viewer.band === "N2" || viewer.band === "N3";
  const reportIds = directReportIds(facts.people, user.id);

  let teamTarget: MorningBrief["teamTarget"] = null;
  if (showTeam) {
    let targetSum = 0;
    let achievedSum = 0;
    let above = 0;
    for (const memberId of reportIds) {
      const member = facts.people.find((person) => person.userId === memberId);
      if (!member) continue;
      const memberTarget = resolveMonthlyTarget({
        monthlyBasic: member.monthlyBasic,
        band: member.band,
        storedRevenueTarget: storedByUser.get(memberId) ?? 0,
      });
      const memberNr = collectedNr(facts.deals, memberId, monthKey);
      targetSum = money(targetSum + memberTarget.amount);
      achievedSum = money(achievedSum + memberNr);
      if (isIncentiveUnlocked(memberNr, memberTarget.amount)) above += 1;
    }
    teamTarget = {
      memberCount: reportIds.length,
      target: targetSum,
      targetLabel: formatINR(targetSum),
      achieved: achievedSum,
      achievedLabel: formatINR(achievedSum),
      aboveTargetCount: above,
    };
  }

  const board = assembleLeaderboard({
    ...facts,
    viewerId: user.id,
    viewerRole: user.role,
    query: { period: "month", scope: "team" },
    now,
  });
  const below = board.entries.find((row) => row.rank === board.me.rank + 1) ?? null;

  const [leadCounts, callbackLeads, callbackCalls, callingPool, callingLogs, visits] =
    await Promise.all([
      leadPipelineCounts(db, scopeIds, now, dateKey),
      db
        .select({
          id: leads.id,
          firstName: leads.firstName,
          lastName: leads.lastName,
          phone: leads.phone,
          at: leads.nextFollowupAt,
        })
        .from(leads)
        .where(
          and(
            eq(leads.orgId, SINGLE_TENANT_ORG_ID),
            isNull(leads.deletedAt),
            inArray(leads.assignedTo, scopeIds),
            isNotNull(leads.nextFollowupAt),
            lt(leads.nextFollowupAt, end),
          ),
        ),
      db
        .select({
          id: agentCallingData.recordId,
          name: agentCallingData.name,
          phone: agentCallingData.phone,
          at: agentCallingData.callbackScheduledAt,
        })
        .from(agentCallingData)
        .where(
          and(
            eq(agentCallingData.orgId, SINGLE_TENANT_ORG_ID),
            isNull(agentCallingData.deletedAt),
            eq(agentCallingData.status, "callback"),
            isNotNull(agentCallingData.callbackScheduledAt),
            inArray(agentCallingData.agentId, scopeIds),
            lt(agentCallingData.callbackScheduledAt, end),
          ),
        ),
      db
        .select({
          pending: sql<number>`count(*) filter (where ${agentCallingData.status} = 'pending' and ${agentCallingData.deletedAt} is null)::int`,
          remaining: sql<number>`count(*) filter (where ${agentCallingData.deletedAt} is null)::int`,
        })
        .from(agentCallingData)
        .where(
          and(
            eq(agentCallingData.orgId, SINGLE_TENANT_ORG_ID),
            inArray(agentCallingData.agentId, scopeIds),
          ),
        ),
      db
        .select({
          calledToday: sql<number>`count(*)::int`,
          interestedToday: sql<number>`count(*) filter (where ${contactCallLogs.outcome} = 'interested')::int`,
        })
        .from(contactCallLogs)
        .where(
          and(
            eq(contactCallLogs.orgId, SINGLE_TENANT_ORG_ID),
            inArray(contactCallLogs.agentId, scopeIds),
            gte(contactCallLogs.calledAt, start),
          ),
        ),
      db
        .select({
          id: siteVisits.id,
          visitTime: siteVisits.visitTime,
          status: siteVisits.status,
          agentId: siteVisits.agentId,
          leadFirst: leads.firstName,
          leadLast: leads.lastName,
          projectName: projects.name,
        })
        .from(siteVisits)
        .innerJoin(leads, eq(leads.id, siteVisits.leadId))
        .leftJoin(projects, eq(projects.id, siteVisits.projectId))
        .where(
          and(
            eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID),
            eq(siteVisits.visitDate, dateKey),
            inArray(siteVisits.agentId, scopeIds),
            inArray(siteVisits.status, ["scheduled", "completed"]),
          ),
        )
        .orderBy(asc(siteVisits.visitTime)),
    ]);

  const overdue: MorningCallback[] = [];
  const today: MorningCallback[] = [];
  for (const row of callbackLeads) {
    if (!row.at) continue;
    const item: MorningCallback = {
      id: row.id,
      source: "lead",
      name: `${row.firstName} ${row.lastName}`.trim(),
      phone: row.phone,
      at: row.at.toISOString(),
      leadId: row.id,
    };
    (row.at < start ? overdue : today).push(item);
  }
  for (const row of callbackCalls) {
    if (!row.at) continue;
    const item: MorningCallback = {
      id: row.id,
      source: "calling",
      name: row.name,
      phone: row.phone,
      at: row.at.toISOString(),
      leadId: null,
    };
    (row.at < start ? overdue : today).push(item);
  }
  overdue.sort((a, b) => (a.at < b.at ? -1 : 1));
  today.sort((a, b) => (a.at < b.at ? -1 : 1));

  const device = deviceRows[0];
  const trackingOn = Boolean(device?.trackingEnabled);
  const names = new Map(facts.people.map((person) => [person.userId, person.name]));
  const feedIds = user.role === "admin" ? null : new Set(squadIds(facts.people, viewer));

  const appraisalDeals = facts.deals.flatMap((deal) => {
    if (!quarter || !dateInQuarter(deal.closedOn, quarter)) return [];
    const share = deal.shares.find((row) => row.userId === user.id);
    if (!share) return [];
    return [
      {
        agentId: user.id,
        status: deal.status,
        invoiceStatus: deal.invoiceStatus,
        sharePercent: share.sharePercent,
      },
    ];
  });
  const appraisal = appraisalResult({
    agentId: user.id,
    designation: viewer.designation,
    monthlyBasic: viewer.monthlyBasic,
    deals: appraisalDeals,
  });

  return {
    greeting: greetingForIstClock(clock.hour, clock.minute),
    name: briefFirstName(profileRow[0]?.firstName, profileRow[0]?.name ?? viewer.name),
    date: formatIstBriefDate(now),
    trackingStatus: {
      on: trackingOn,
      label: trackingOn ? "On" : "Off",
      health: device && device.healthStatus !== "UNKNOWN" ? device.healthStatus : null,
      agentStatus: device?.agentStatus ?? null,
      lastSeenAt: device?.lastSeenAt?.toISOString() ?? null,
    },
    quoteOfDay: quoteForIstDate(now),
    target: {
      amount: personalTarget.amount,
      amountLabel: formatINR(personalTarget.amount),
      achieved,
      achievedLabel: formatINR(achieved),
      dailyNeeded: needed,
      dailyNeededLabel: formatINR(needed),
      daysRemaining,
      percent: achievementPercent(achieved, personalTarget.amount),
      unlocked: isIncentiveUnlocked(achieved, personalTarget.amount),
      aboveTargetPercent: aboveTargetPercent(personalTarget.band),
      band: personalTarget.band,
      source: personalTarget.source,
    },
    teamTarget,
    callbacks: {
      overdue: overdue.slice(0, CALLBACK_LIMIT),
      today: today.slice(0, CALLBACK_LIMIT),
      count: overdue.length + today.length,
    },
    leaderboard: {
      rank: board.me.rank,
      previousRank: board.me.previousRank,
      trend: board.me.trend,
      nameAbove: board.me.nameAbove,
      neighborBelow: below ? { name: below.agentName, rank: below.rank } : null,
      gapToNext: board.me.gapToNext,
      gapToNextLabel: formatINR(board.me.gapToNext),
    },
    callingData: {
      pending: countOf(callingPool[0]?.pending),
      calledToday: countOf(callingLogs[0]?.calledToday),
      interestedToday: countOf(callingLogs[0]?.interestedToday),
      remaining: countOf(callingPool[0]?.remaining),
    },
    leads: leadCounts,
    teamFeed: buildFeed(facts, board.entries, feedIds, names),
    schedule: {
      items: visits.map((visit) => ({
        id: visit.id,
        time: visit.visitTime,
        timeLabel: formatVisitTimeIst(visit.visitTime),
        leadName: `${visit.leadFirst} ${visit.leadLast}`.trim(),
        projectName: visit.projectName,
        status: visit.status,
        agentName: user.role === "agent" ? null : (names.get(visit.agentId) ?? null),
      })),
    },
    appraisal: {
      quarter: quarter?.code ?? "JFM",
      quarterLabel: quarter?.name ?? "This quarter",
      mapped: appraisal.mapped,
      sales: appraisal.countedSales,
      units: appraisal.countedUnits,
      minSales: appraisal.minSales,
      minUnits: appraisal.minUnits,
      hikePercent: appraisal.hikePercent,
      eligible: appraisal.eligible,
      hikeAmount: appraisal.hikeAmount,
      hikeAmountLabel: formatINR(appraisal.hikeAmount),
    },
  };
}

async function leadPipelineCounts(db: Database, scopeIds: string[], now: Date, dateKey: string) {
  const [row] = await db
    .select({
      hot: sql<number>`count(*) filter (where ${leads.temperature} = 'hot')::int`,
      warm: sql<number>`count(*) filter (where ${leads.temperature} = 'warm')::int`,
      cold: sql<number>`count(*) filter (where ${leads.temperature} = 'cold')::int`,
      siteVisit: sql<number>`count(*) filter (where ${leads.pipelineStage} in ('site_visit_scheduled', 'site_visit_done'))::int`,
      negotiation: sql<number>`count(*) filter (where ${leads.leadStatus} = 'negotiation' or ${leads.pipelineStage} = 'negotiation')::int`,
      urgent: sql<number>`count(*) filter (where (${leads.nextFollowupAt} is not null and ${leads.nextFollowupAt} < ${sqlTimestamptz(now)}) or exists (
        select 1 from site_visits sv
        where sv.lead_id = ${leads.id}
          and sv.visit_date = ${dateKey}::date
          and sv.status = 'scheduled'
      ))::int`,
    })
    .from(leads)
    .where(
      and(
        eq(leads.orgId, SINGLE_TENANT_ORG_ID),
        isNull(leads.deletedAt),
        inArray(leads.assignedTo, scopeIds),
      ),
    );
  return {
    hot: countOf(row?.hot),
    warm: countOf(row?.warm),
    cold: countOf(row?.cold),
    siteVisit: countOf(row?.siteVisit),
    negotiation: countOf(row?.negotiation),
    urgent: countOf(row?.urgent),
  };
}

function buildFeed(
  facts: Awaited<ReturnType<typeof loadLeaderboardFacts>>,
  entries: { userId: string | null; rank: number }[],
  feedIds: Set<string> | null,
  names: Map<string, string>,
): MorningBrief["teamFeed"] {
  const allowed = (userId: string) => feedIds === null || feedIds.has(userId);
  const rankOf = new Map(
    entries.flatMap((row) => (row.userId ? [[row.userId, row.rank] as const] : [])),
  );
  const stamped: { at: string; item: MorningBrief["teamFeed"]["items"][number] }[] = [];

  const seenDeals = new Set<string>();
  const recentDeals = [...facts.deals]
    .filter(
      (deal) => deal.status === "approved" && deal.invoiceStatus === "collected" && deal.closedOn,
    )
    .sort((a, b) => ((a.closedOn ?? "") < (b.closedOn ?? "") ? 1 : -1));
  for (const deal of recentDeals) {
    if (seenDeals.has(deal.id)) continue;
    const share = [...deal.shares]
      .filter((row) => allowed(row.userId) && row.sharePercent > 0)
      .sort((a, b) => b.sharePercent - a.sharePercent)[0];
    if (!share) continue;
    seenDeals.add(deal.id);
    const agentName = names.get(share.userId) ?? "A teammate";
    const amount = money((Math.max(0, deal.netRevenue) * share.sharePercent) / 100);
    stamped.push({
      at: `${deal.closedOn}T12:00:00.000Z`,
      item: {
        id: `deal:${deal.id}`,
        kind: "deal",
        title: "Collected deal",
        body: dealClosedMessage(agentName, amount, rankOf.get(share.userId) ?? 0),
        at: `${deal.closedOn}T12:00:00.000Z`,
        reactions: 0,
      },
    });
    if (stamped.length >= 8) break;
  }

  for (const announcement of facts.announcements) {
    if (!announcement.active || announcement.kind !== "announcement") continue;
    stamped.push({
      at: announcement.createdAt,
      item: {
        id: `announcement:${announcement.id}`,
        kind: "announcement",
        title: "Announcement",
        body: announcement.body,
        at: announcement.createdAt,
        reactions: 0,
      },
    });
  }

  const recentBadges = [...facts.badges].sort((a, b) => (a.earnedAt < b.earnedAt ? 1 : -1));
  for (const badge of recentBadges) {
    if (!allowed(badge.agentId)) continue;
    const meta = BADGE_META[badge.type];
    stamped.push({
      at: badge.earnedAt,
      item: {
        id: `badge:${badge.agentId}:${badge.type}:${badge.earnedAt}`,
        kind: "badge",
        title: meta.name,
        body: `${names.get(badge.agentId) ?? "A teammate"} earned ${meta.name}.`,
        at: badge.earnedAt,
        reactions: 0,
      },
    });
    if (stamped.filter((row) => row.item.kind === "badge").length >= 8) break;
  }

  stamped.sort((a, b) => (a.at < b.at ? 1 : -1));
  return {
    items: stamped.slice(0, 3).map((row) => row.item),
    viewAll:
      feedIds === null
        ? { label: "View full team chat", surface: "whatsapp", webPath: "/whatsapp" }
        : {
            label: "View full team chat",
            surface: "announcements",
            webPath: "/leaderboard",
          },
  };
}

/**
 * Lead follow-ups have no "done" route (PATCH follow-up only reschedules).
 * Calling rows have no completed status, so a checked callback leaves the
 * reminder list and returns to the pending calling queue.
 */
async function scopeIdsFor(db: Database, user: AuthUser) {
  if (user.role !== "manager") return [user.id];
  const reports = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.orgId, SINGLE_TENANT_ORG_ID),
        eq(users.isActive, true),
        eq(users.reportingToId, user.id),
      ),
    );
  return [...new Set([user.id, ...reports.map((row) => row.id)])];
}

export async function completeMorningCallback(
  db: Database,
  user: AuthUser,
  input: { source: "lead" | "calling"; id: string },
) {
  const scopeIds = await scopeIdsFor(db, user);
  if (input.source === "lead") {
    const [row] = await db
      .update(leads)
      .set({ nextFollowupAt: null, updatedAt: new Date() })
      .where(
        and(
          eq(leads.id, input.id),
          eq(leads.orgId, SINGLE_TENANT_ORG_ID),
          isNull(leads.deletedAt),
          inArray(leads.assignedTo, scopeIds),
          isNotNull(leads.nextFollowupAt),
        ),
      )
      .returning({ id: leads.id });
    if (!row) throw notFound("Callback not found");
    return;
  }
  const [row] = await db
    .update(agentCallingData)
    .set({ callbackScheduledAt: null, status: "pending" })
    .where(
      and(
        eq(agentCallingData.recordId, input.id),
        eq(agentCallingData.orgId, SINGLE_TENANT_ORG_ID),
        isNull(agentCallingData.deletedAt),
        eq(agentCallingData.status, "callback"),
        inArray(agentCallingData.agentId, scopeIds),
      ),
    )
    .returning({ id: agentCallingData.recordId });
  if (!row) throw notFound("Callback not found");
}
