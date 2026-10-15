import {
  agentBadges,
  incentiveProfiles,
  leaderboardAnnouncements,
  leaderboardRankSnapshots,
  notifications,
  transactionClosureShares,
  transactionClosures,
  users,
} from "@propninja/db";
import { addDaysToDateKey, getIstDateKey } from "@propninja/types/ist";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import type { Database } from "../lib/db.js";
import { badRequest, forbidden } from "../lib/errors.js";
import { excelWorkbook } from "../lib/excelSheet.js";
import { loadIncentiveDeals, num } from "../lib/incentiveData.js";
import { isIncentiveBand } from "../lib/incentiveMath.js";
import { buildLeaderboardPdf } from "../lib/leaderboardPdf.js";
import {
  type AnnouncementRow,
  BADGE_TYPES,
  type BadgeAward,
  type BadgeType,
  type LeaderboardDeal,
  type LeaderboardPayload,
  type LeaderboardPerson,
  type LeaderboardQuery,
  type LeaderboardRole,
  type RankSnapshot,
  type StoredBadge,
  assembleLeaderboard,
  badgeEarnedMessage,
  buildHallOfFame,
  buildTeamComparison,
  computeStandings,
  dealClosedMessage,
  evaluateBadgeAwards,
  exportMatrix,
  isLastIstDay,
  monthEndMessage,
} from "../lib/leaderboardRank.js";
import { clearLeaderboardCache, clearMorningBriefCache } from "../lib/responseCache.js";
import type { AuthUser } from "../middleware/auth.js";
import { NOTIFICATION_TYPES, createNotificationService } from "./notificationService.js";

type Facts = {
  people: LeaderboardPerson[];
  deals: LeaderboardDeal[];
  snapshots: RankSnapshot[];
  badges: StoredBadge[];
  announcements: AnnouncementRow[];
};

function dateKey(value: string | Date | null | undefined) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function badgeKey(award: {
  agentId: string;
  type: string;
  periodYear: number | null;
  periodMonth: number | null;
  periodQuarter: number | null;
}) {
  return [
    award.agentId,
    award.type,
    award.periodYear ?? "x",
    award.periodMonth ?? "x",
    award.periodQuarter ?? "x",
  ].join("|");
}

function isBadgeType(value: string): value is BadgeType {
  return (BADGE_TYPES as readonly string[]).includes(value);
}

export async function loadLeaderboardFacts(db: Database, now = new Date()): Promise<Facts> {
  const yesterday = addDaysToDateKey(getIstDateKey(now), -1);
  const [peopleRows, dealRows, snapRows, badgeRows, announcementRows] = await Promise.all([
    db
      .select({
        userId: users.id,
        name: users.name,
        role: users.role,
        designation: users.designation,
        department: users.department,
        reportingToId: users.reportingToId,
        showLeaderboardAvatar: users.showLeaderboardAvatar,
        band: incentiveProfiles.band,
        profileDesignation: incentiveProfiles.designation,
        monthlyBasic: incentiveProfiles.monthlyBasic,
      })
      .from(users)
      .leftJoin(incentiveProfiles, eq(incentiveProfiles.userId, users.id))
      .where(and(eq(users.orgId, SINGLE_TENANT_ORG_ID), eq(users.isActive, true))),
    loadIncentiveDeals(db),
    db
      .select()
      .from(leaderboardRankSnapshots)
      .where(gte(leaderboardRankSnapshots.snapshotDate, yesterday)),
    db.select().from(agentBadges),
    db
      .select()
      .from(leaderboardAnnouncements)
      .where(eq(leaderboardAnnouncements.orgId, SINGLE_TENANT_ORG_ID))
      .orderBy(desc(leaderboardAnnouncements.createdAt)),
  ]);

  const people: LeaderboardPerson[] = peopleRows.map((row) => ({
    userId: row.userId,
    name: row.name,
    role: (row.role === "admin" || row.role === "manager" ? row.role : "agent") as LeaderboardRole,
    designation: row.profileDesignation ?? row.designation,
    band: isIncentiveBand(row.band) ? row.band : null,
    monthlyBasic: num(row.monthlyBasic),
    reportingToId: row.reportingToId,
    department: row.department,
    showLeaderboardAvatar: row.showLeaderboardAvatar,
  }));

  const deals: LeaderboardDeal[] = dealRows.map((deal) => ({
    id: deal.id,
    status: deal.status,
    invoiceStatus: deal.invoiceStatus,
    netRevenue: deal.netRevenue,
    closedOn: deal.closedOn ?? null,
    shares: deal.shares,
  }));

  return {
    people,
    deals,
    snapshots: snapRows.map((row) => ({
      userId: row.userId,
      periodKey: row.periodKey,
      scopeKey: row.scopeKey,
      rank: row.rank,
      snapshotDate: dateKey(row.snapshotDate),
    })),
    badges: badgeRows.flatMap((row) => {
      if (!isBadgeType(row.badgeType)) return [];
      return [
        {
          agentId: row.agentId,
          type: row.badgeType,
          earnedAt: row.earnedAt.toISOString(),
          periodMonth: row.periodMonth,
          periodYear: row.periodYear,
          periodQuarter: row.periodQuarter,
        },
      ];
    }),
    announcements: announcementRows.flatMap((row) => {
      if (row.kind !== "announcement" && row.kind !== "challenge") return [];
      return [
        {
          id: row.id,
          kind: row.kind,
          body: row.body,
          active: row.active,
          createdAt: row.createdAt.toISOString(),
        },
      ];
    }),
  };
}

async function writeSnapshots(
  db: Database,
  standings: ReturnType<typeof computeStandings>,
  day: string,
) {
  if (standings.length === 0) return;
  await db
    .insert(leaderboardRankSnapshots)
    .values(
      standings.map((row) => ({
        userId: row.userId,
        periodKey: row.periodKey,
        scopeKey: row.scopeKey,
        rank: row.rank,
        snapshotDate: day,
      })),
    )
    .onConflictDoUpdate({
      target: [
        leaderboardRankSnapshots.userId,
        leaderboardRankSnapshots.periodKey,
        leaderboardRankSnapshots.scopeKey,
        leaderboardRankSnapshots.snapshotDate,
      ],
      set: { rank: sql`excluded.rank` },
    });
}

function teamRecipients(people: LeaderboardPerson[], agentId: string) {
  const agent = people.find((person) => person.userId === agentId);
  if (!agent) return [agentId];
  const leadId = agent.role === "agent" ? (agent.reportingToId ?? agent.userId) : agent.userId;
  const ids = people
    .filter(
      (person) =>
        person.userId === agentId || person.userId === leadId || person.reportingToId === leadId,
    )
    .map((person) => person.userId);
  return [...new Set(ids)];
}

export function createLeaderboardService(db: Database) {
  return {
    async board(
      user: AuthUser,
      query: LeaderboardQuery,
      now = new Date(),
    ): Promise<LeaderboardPayload> {
      const facts = await loadLeaderboardFacts(db, now);
      const input = {
        ...facts,
        viewerId: user.id,
        viewerRole: user.role,
        query,
        now,
      };
      const standings = computeStandings(input);
      const today = getIstDateKey(now);
      const yesterday = addDaysToDateKey(today, -1);
      const periodKey = standings[0]?.periodKey;
      const scopeKey = standings[0]?.scopeKey;
      const haveYesterday =
        periodKey != null &&
        scopeKey != null &&
        facts.snapshots.some(
          (row) =>
            row.snapshotDate === yesterday &&
            row.periodKey === periodKey &&
            row.scopeKey === scopeKey,
        );
      if (!haveYesterday && standings.length > 0) {
        await writeSnapshots(db, standings, yesterday);
        facts.snapshots.push(
          ...standings.map((row) => ({
            userId: row.userId,
            periodKey: row.periodKey,
            scopeKey: row.scopeKey,
            rank: row.rank,
            snapshotDate: yesterday,
          })),
        );
      }
      await writeSnapshots(db, standings, today);

      const desired = evaluateBadgeAwards(facts.people, facts.deals, now);
      const owned = new Set(facts.badges.map((badge) => badgeKey(badge)));
      const fresh = desired.filter((award) => !owned.has(badgeKey(award)));
      let inserted: BadgeAward[] = [];
      if (fresh.length > 0) {
        const rows = await db
          .insert(agentBadges)
          .values(
            fresh.map((award) => ({
              agentId: award.agentId,
              badgeType: award.type,
              periodMonth: award.periodMonth,
              periodYear: award.periodYear,
              periodQuarter: award.periodQuarter,
            })),
          )
          .onConflictDoNothing()
          .returning();
        inserted = rows.flatMap((row) => {
          if (!isBadgeType(row.badgeType)) return [];
          return [
            {
              agentId: row.agentId,
              type: row.badgeType,
              periodMonth: row.periodMonth,
              periodYear: row.periodYear,
              periodQuarter: row.periodQuarter,
            },
          ];
        });
        const [year, month] = getIstDateKey(now).split("-").map(Number);
        const cheered = inserted.filter(
          (award) =>
            award.periodYear == null || (award.periodYear === year && award.periodMonth === month),
        );
        const notificationsApi = createNotificationService(db);
        await Promise.all(
          cheered.map((award) =>
            notificationsApi.createNotification(
              award.agentId,
              NOTIFICATION_TYPES.LEADERBOARD_BADGE,
              {
                title: "Badge earned",
                message: badgeEarnedMessage(award.type),
                badgeType: award.type,
              },
            ),
          ),
        );
        return assembleLeaderboard({ ...input, freshBadges: cheered });
      }

      return assembleLeaderboard(input);
    },

    async hall(user: AuthUser, query: LeaderboardQuery, now = new Date()) {
      const facts = await loadLeaderboardFacts(db, now);
      return buildHallOfFame({
        ...facts,
        viewerId: user.id,
        viewerRole: user.role,
        query,
        now,
      });
    },

    async teams(user: AuthUser, query: LeaderboardQuery, now = new Date()) {
      if (user.role === "agent") throw forbidden("Team comparison is for managers and admins");
      const facts = await loadLeaderboardFacts(db, now);
      const self = facts.people.find((person) => person.userId === user.id);
      const allowed = user.role === "admin" || self?.band === "N2" || self?.band === "N3";
      if (!allowed) throw forbidden("Team comparison is for N2, N3, and admin");
      return buildTeamComparison({
        ...facts,
        viewerId: user.id,
        viewerRole: user.role,
        query,
        now,
      });
    },

    async listAnnouncements(user: AuthUser) {
      if (user.role !== "admin") throw forbidden("Only an admin can manage leaderboard banners");
      const facts = await loadLeaderboardFacts(db);
      return facts.announcements;
    },

    async saveAnnouncement(
      user: AuthUser,
      input: { kind: "announcement" | "challenge"; body: string },
    ) {
      if (user.role !== "admin") throw forbidden("Only an admin can pin a leaderboard banner");
      const body = input.body.trim();
      if (!body) throw badRequest("Write a message before pinning it");
      await db
        .update(leaderboardAnnouncements)
        .set({ active: false })
        .where(
          and(
            eq(leaderboardAnnouncements.orgId, SINGLE_TENANT_ORG_ID),
            eq(leaderboardAnnouncements.kind, input.kind),
            eq(leaderboardAnnouncements.active, true),
          ),
        );
      const [row] = await db
        .insert(leaderboardAnnouncements)
        .values({
          orgId: SINGLE_TENANT_ORG_ID,
          kind: input.kind,
          body,
          active: true,
          createdBy: user.id,
        })
        .returning();
      clearLeaderboardCache();
      return row;
    },

    async setAvatar(user: AuthUser, show: boolean) {
      await db.update(users).set({ showLeaderboardAvatar: show }).where(eq(users.id, user.id));
      return { showLeaderboardAvatar: show };
    },

    async exportFile(
      user: AuthUser,
      query: LeaderboardQuery,
      format: "xls" | "pdf",
      now = new Date(),
    ) {
      if (user.role !== "admin") throw forbidden("Only an admin can export the leaderboard");
      const facts = await loadLeaderboardFacts(db, now);
      const payload = assembleLeaderboard({
        ...facts,
        viewerId: user.id,
        viewerRole: "admin",
        query,
        now,
        exportMode: true,
      });
      const matrix = exportMatrix(payload);
      const filename = `leaderboard-${payload.periodKey}.${format === "pdf" ? "pdf" : "xls"}`;
      if (format === "pdf") {
        const body = await buildLeaderboardPdf(matrix.headers, matrix.rows, payload.periodKey);
        return { body, filename, contentType: "application/pdf" };
      }
      return {
        body: excelWorkbook("Leaderboard", matrix.headers, matrix.rows),
        filename,
        contentType: "application/vnd.ms-excel; charset=utf-8",
      };
    },

    async runDaily(now = new Date()) {
      const facts = await loadLeaderboardFacts(db, now);
      const admin = facts.people.find((person) => person.role === "admin");
      if (admin) {
        const asUser = {
          id: admin.userId,
          role: "admin" as const,
          email: "",
          name: admin.name,
          orgId: SINGLE_TENANT_ORG_ID,
          isFirstLogin: false,
        };
        await this.board(asUser, { period: "month", scope: "all" }, now);
        for (const manager of facts.people.filter((person) => person.role === "manager")) {
          await this.board(
            { ...asUser, id: manager.userId, role: "manager", name: manager.name },
            { period: "month", scope: "team" },
            now,
          );
        }
      }
      if (!isLastIstDay(now)) return;
      const ranked = assembleLeaderboard({
        ...facts,
        viewerId: admin?.userId ?? facts.people[0]?.userId ?? "system",
        viewerRole: "admin",
        query: { period: "month", scope: "all" },
        now,
        exportMode: true,
      });
      const agents = new Set(
        facts.people.filter((person) => person.role === "agent").map((person) => person.userId),
      );
      const date = getIstDateKey(now);
      const notificationsApi = createNotificationService(db);
      for (const row of ranked.entries) {
        if (!row.userId || !agents.has(row.userId)) continue;
        const [existing] = await db
          .select({ id: notifications.id })
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, row.userId),
              eq(notifications.type, NOTIFICATION_TYPES.LEADERBOARD_MONTH_END),
              sql`${notifications.payload}->>'date' = ${date}`,
            ),
          )
          .limit(1);
        if (existing) continue;
        await notificationsApi.createNotification(
          row.userId,
          NOTIFICATION_TYPES.LEADERBOARD_MONTH_END,
          {
            title: "Month ends tonight",
            message: monthEndMessage(row.rank, row.totalNr, Math.max(1, row.rank - 1)),
            date,
            rank: row.rank,
          },
        );
      }
    },
  };
}

export async function onLeaderboardDealChanged(db: Database, tcfId: string, announce: boolean) {
  clearLeaderboardCache();
  clearMorningBriefCache();
  if (!announce) return;
  const [row] = await db
    .select()
    .from(transactionClosures)
    .where(eq(transactionClosures.id, tcfId))
    .limit(1);
  if (!row || row.status !== "approved" || row.invoiceStatus !== "collected") return;
  const shares = await db
    .select()
    .from(transactionClosureShares)
    .where(eq(transactionClosureShares.tcfId, tcfId));
  const facts = await loadLeaderboardFacts(db);
  const admin = facts.people.find((person) => person.role === "admin");
  const standings = computeStandings({
    ...facts,
    viewerId: admin?.userId ?? shares[0]?.userId ?? "system",
    viewerRole: "admin",
    query: { period: "month", scope: "all" },
    now: new Date(),
  });
  const rankOf = new Map(standings.map((standing) => [standing.userId, standing.rank]));
  const notificationsApi = createNotificationService(db);
  for (const share of shares) {
    if (!share.userId || num(share.sharePercent) <= 0) continue;
    const agent = facts.people.find((person) => person.userId === share.userId);
    if (!agent) continue;
    const rank = rankOf.get(agent.userId) ?? 0;
    const message = dealClosedMessage(agent.name, num(row.netRevenue), rank);
    for (const recipient of teamRecipients(facts.people, agent.userId)) {
      await notificationsApi.createNotification(
        recipient,
        NOTIFICATION_TYPES.LEADERBOARD_DEAL_CLOSED,
        {
          title: "Deal closed",
          message,
          agentId: agent.userId,
          rank,
        },
      );
    }
  }
}
