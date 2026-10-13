import {
  incentiveDisbursements,
  incentiveProfiles,
  transactionClosureShares,
  transactionClosures,
  users,
} from "@propninja/db";
import { and, eq, inArray } from "drizzle-orm";
import { APPRAISAL_POLICY, appraisalResult } from "../lib/appraisalMath.js";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import type { Database } from "../lib/db.js";
import { badRequest, forbidden } from "../lib/errors.js";
import {
  INCENTIVE_BANDS,
  type IncentiveBand,
  type IncentiveDeal,
  isIncentiveBand,
  summarizeAgentIncentive,
} from "../lib/incentiveMath.js";
import { type QuarterRef, dateInQuarter, parseQuarterKey, quarterKey } from "../lib/quarters.js";
import type { AuthUser } from "../middleware/auth.js";

function num(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

type Profile = {
  userId: string;
  name: string;
  band: IncentiveBand | null;
  designation: string | null;
  monthlyBasic: number;
  reportingToId: string | null;
};

async function loadProfiles(db: Database): Promise<Profile[]> {
  const people = await db
    .select({
      userId: users.id,
      name: users.name,
      reportingToId: users.reportingToId,
      band: incentiveProfiles.band,
      designation: incentiveProfiles.designation,
      monthlyBasic: incentiveProfiles.monthlyBasic,
    })
    .from(users)
    .leftJoin(incentiveProfiles, eq(incentiveProfiles.userId, users.id))
    .where(and(eq(users.orgId, SINGLE_TENANT_ORG_ID), eq(users.isActive, true)));
  return people.map((person) => ({
    userId: person.userId,
    name: person.name,
    reportingToId: person.reportingToId,
    band: isIncentiveBand(person.band) ? person.band : null,
    designation: person.designation,
    monthlyBasic: num(person.monthlyBasic),
  }));
}

async function loadDeals(db: Database): Promise<IncentiveDeal[]> {
  const rows = await db
    .select()
    .from(transactionClosures)
    .where(eq(transactionClosures.orgId, SINGLE_TENANT_ORG_ID));
  if (rows.length === 0) return [];
  const shares = await db
    .select()
    .from(transactionClosureShares)
    .where(
      inArray(
        transactionClosureShares.tcfId,
        rows.map((row) => row.id),
      ),
    );
  return rows.map((row) => ({
    id: row.id,
    tcfCode: row.tcfCode,
    status: row.status as IncentiveDeal["status"],
    invoiceStatus: row.invoiceStatus as IncentiveDeal["invoiceStatus"],
    netRevenue: num(row.netRevenue),
    convertible: row.convertible,
    closedOn: row.dealClosureDate,
    shares: shares
      .filter((share) => share.tcfId === row.id && share.userId)
      .map((share) => ({
        userId: share.userId as string,
        sharePercent: num(share.sharePercent),
      })),
  }));
}

function dealsFor(all: IncentiveDeal[], userId: string, quarter: QuarterRef) {
  return all.filter(
    (deal) =>
      dateInQuarter(deal.closedOn, quarter) &&
      deal.shares.some((share) => share.userId === userId && share.sharePercent > 0),
  );
}

export function createIncentiveService(db: Database) {
  return {
    slabs() {
      return Object.entries(INCENTIVE_BANDS).map(([band, slab]) => ({
        band,
        multiplier: slab.multiplier,
        tillPercent: slab.tillRate * 100,
        abovePercent: slab.aboveRate * 100,
        team: slab.team,
      }));
    },

    async mine(user: AuthUser, quarterValue?: string) {
      const quarter = parseQuarterKey(quarterValue);
      const [profiles, deals, disbursed] = await Promise.all([
        loadProfiles(db),
        loadDeals(db),
        db
          .select()
          .from(incentiveDisbursements)
          .where(
            and(
              eq(incentiveDisbursements.userId, user.id),
              eq(incentiveDisbursements.quarterKey, quarterKey(quarter)),
            ),
          ),
      ]);
      const profile = profiles.find((person) => person.userId === user.id);
      const team = profiles.filter((person) => person.reportingToId === user.id);
      const payout = summarizeAgentIncentive({
        agentId: user.id,
        band: profile?.band ?? null,
        monthlyBasic: profile?.monthlyBasic ?? 0,
        deals: dealsFor(deals, user.id, quarter),
        team: team.map((member) => ({
          userId: member.userId,
          monthlyBasic: member.monthlyBasic,
          deals: dealsFor(deals, member.userId, quarter),
        })),
        disbursedAmount: num(disbursed[0]?.earnedAmount),
      });
      return {
        quarter,
        profile: profile ?? null,
        slabs: this.slabs(),
        payout,
        disbursed: Boolean(disbursed[0]),
      };
    },

    async team(user: AuthUser, quarterValue?: string) {
      const quarter = parseQuarterKey(quarterValue);
      const profiles = await loadProfiles(db);
      const me = profiles.find((person) => person.userId === user.id);
      const members =
        user.role === "admin"
          ? profiles
          : profiles.filter(
              (person) => person.reportingToId === user.id || person.userId === user.id,
            );
      if (user.role === "agent" && !me?.band) {
        return {
          quarter,
          members: [] as unknown[],
          note: "Set your band on Appraisal to see team incentive.",
        };
      }
      const deals = await loadDeals(db);
      const rows = [];
      for (const member of members) {
        const reports = profiles.filter((person) => person.reportingToId === member.userId);
        const payout = summarizeAgentIncentive({
          agentId: member.userId,
          band: member.band,
          monthlyBasic: member.monthlyBasic,
          deals: dealsFor(deals, member.userId, quarter),
          team: reports.map((report) => ({
            userId: report.userId,
            monthlyBasic: report.monthlyBasic,
            deals: dealsFor(deals, report.userId, quarter),
          })),
        });
        rows.push({ userId: member.userId, name: member.name, band: member.band, payout });
      }
      return { quarter, members: rows, note: null };
    },

    async appraisal(user: AuthUser, quarterValue?: string, everyone = false) {
      const quarter = parseQuarterKey(quarterValue);
      const profiles = await loadProfiles(db);
      const deals = await loadDeals(db);
      const subjects = everyone ? profiles : profiles.filter((person) => person.userId === user.id);
      const results = subjects.map((person) => {
        const ownDeals = dealsFor(deals, person.userId, quarter).map((deal) => ({
          agentId: person.userId,
          status: deal.status,
          invoiceStatus: deal.invoiceStatus,
          sharePercent:
            deal.shares.find((share) => share.userId === person.userId)?.sharePercent ?? 0,
        }));
        return {
          userId: person.userId,
          name: person.name,
          designation: person.designation,
          band: person.band,
          monthlyBasic: person.monthlyBasic,
          ...appraisalResult({
            agentId: person.userId,
            designation: person.designation,
            monthlyBasic: person.monthlyBasic,
            deals: ownDeals,
          }),
        };
      });
      return { quarter, policy: APPRAISAL_POLICY, results };
    },

    async saveProfile(
      actor: AuthUser,
      input: {
        userId: string;
        band?: IncentiveBand | null;
        designation?: string | null;
        monthlyBasic?: number;
      },
    ) {
      if (actor.role !== "admin") throw forbidden("Only an admin can edit incentive profiles");
      const [current] = await db
        .select()
        .from(incentiveProfiles)
        .where(eq(incentiveProfiles.userId, input.userId))
        .limit(1);
      const band =
        input.band === undefined
          ? isIncentiveBand(current?.band)
            ? current.band
            : null
          : input.band;
      const designation =
        input.designation === undefined ? (current?.designation ?? null) : input.designation;
      const monthlyBasic =
        input.monthlyBasic === undefined ? num(current?.monthlyBasic) : input.monthlyBasic;
      await db
        .insert(incentiveProfiles)
        .values({
          userId: input.userId,
          orgId: SINGLE_TENANT_ORG_ID,
          band,
          designation,
          monthlyBasic: monthlyBasic.toFixed(2),
          updatedBy: actor.id,
        })
        .onConflictDoUpdate({
          target: incentiveProfiles.userId,
          set: {
            band,
            designation,
            monthlyBasic: monthlyBasic.toFixed(2),
            updatedBy: actor.id,
            updatedAt: new Date(),
          },
        });
      return { ok: true };
    },

    async disbursements(actor: AuthUser, quarterValue?: string) {
      if (actor.role !== "admin") throw forbidden("Only an admin can view disbursements");
      const quarter = parseQuarterKey(quarterValue);
      const profiles = await loadProfiles(db);
      const deals = await loadDeals(db);
      const paid = await db
        .select()
        .from(incentiveDisbursements)
        .where(eq(incentiveDisbursements.quarterKey, quarterKey(quarter)));
      const rows = profiles.map((person) => {
        const reports = profiles.filter((member) => member.reportingToId === person.userId);
        const payout = summarizeAgentIncentive({
          agentId: person.userId,
          band: person.band,
          monthlyBasic: person.monthlyBasic,
          deals: dealsFor(deals, person.userId, quarter),
          team: reports.map((member) => ({
            userId: member.userId,
            monthlyBasic: member.monthlyBasic,
            deals: dealsFor(deals, member.userId, quarter),
          })),
          disbursedAmount: num(paid.find((row) => row.userId === person.userId)?.earnedAmount),
        });
        return {
          userId: person.userId,
          name: person.name,
          band: person.band,
          designation: person.designation,
          monthlyBasic: person.monthlyBasic,
          payout,
          disbursed: paid.some((row) => row.userId === person.userId),
        };
      });
      return { quarter, rows };
    },

    async disburse(actor: AuthUser, userId: string, quarterValue: string) {
      if (actor.role !== "admin") throw forbidden("Only an admin can disburse incentive");
      const quarter = parseQuarterKey(quarterValue);
      const view = await this.disbursements(actor, quarterKey(quarter));
      const row = view.rows.find((item) => item.userId === userId);
      if (!row) throw badRequest("Agent not found");
      if (row.payout.earned <= 0) throw badRequest("Nothing has been earned for this quarter");
      await db
        .insert(incentiveDisbursements)
        .values({
          orgId: SINGLE_TENANT_ORG_ID,
          userId,
          quarterKey: quarterKey(quarter),
          earnedAmount: row.payout.earned.toFixed(2),
          cashAmount: row.payout.cash.toFixed(2),
          esopAmount: row.payout.esop.toFixed(2),
          disbursedBy: actor.id,
        })
        .onConflictDoUpdate({
          target: [incentiveDisbursements.userId, incentiveDisbursements.quarterKey],
          set: {
            earnedAmount: row.payout.earned.toFixed(2),
            cashAmount: row.payout.cash.toFixed(2),
            esopAmount: row.payout.esop.toFixed(2),
            disbursedBy: actor.id,
            disbursedAt: new Date(),
          },
        });
      return { ok: true };
    },
  };
}
