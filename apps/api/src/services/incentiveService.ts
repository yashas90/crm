import { incentiveApprovals, incentiveDisbursements, incentiveProfiles } from "@propninja/db";
import { and, eq } from "drizzle-orm";
import { APPRAISAL_POLICY, appraisalResult } from "../lib/appraisalMath.js";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import type { Database } from "../lib/db.js";
import { forbidden } from "../lib/errors.js";
import {
  type IncentivePerson,
  dealsFor,
  loadIncentiveDeals,
  loadIncentivePeople,
  num,
} from "../lib/incentiveData.js";
import {
  INCENTIVE_BANDS,
  type IncentiveBand,
  isIncentiveBand,
  summarizeAgentIncentive,
} from "../lib/incentiveMath.js";
import { parseQuarterKey, quarterKey } from "../lib/quarters.js";
import type { AuthUser } from "../middleware/auth.js";
import { createApprovalService } from "./approvalService.js";

function teamIds(actor: AuthUser, profiles: IncentivePerson[]) {
  if (actor.role === "admin") return null;
  if (actor.role === "manager") {
    return new Set(
      profiles
        .filter((person) => person.userId === actor.id || person.reportingToId === actor.id)
        .map((person) => person.userId),
    );
  }
  return new Set([actor.id]);
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
        loadIncentivePeople(db),
        loadIncentiveDeals(db),
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
      const approvals = await db
        .select()
        .from(incentiveApprovals)
        .where(
          and(
            eq(incentiveApprovals.userId, user.id),
            eq(incentiveApprovals.quarterKey, quarterKey(quarter)),
          ),
        );
      return {
        quarter,
        profile: profile
          ? {
              userId: profile.userId,
              name: profile.name,
              band: profile.band,
              designation: profile.designation,
              monthlyBasic: profile.monthlyBasic,
            }
          : null,
        slabs: this.slabs(),
        payout,
        disbursed: Boolean(disbursed[0]),
        approvals: approvals.map((row) => ({
          id: row.id,
          monthKey: row.monthKey,
          status: row.status,
          totalPayable: num(row.totalPayable),
          cashAmount: num(row.cashAmount),
          esopAmount: num(row.esopAmount),
          grossIncentive: num(row.grossIncentive),
          rejectionReason: row.rejectionReason,
        })),
      };
    },

    async team(user: AuthUser, quarterValue?: string) {
      if (user.role === "agent") {
        throw forbidden("Agents can only view their own incentive");
      }
      const quarter = parseQuarterKey(quarterValue);
      const profiles = await loadIncentivePeople(db);
      const allowed = teamIds(user, profiles);
      const members = allowed ? profiles.filter((person) => allowed.has(person.userId)) : profiles;
      const deals = await loadIncentiveDeals(db);
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
      return {
        quarter,
        members: rows,
        note: user.role === "admin" ? null : "Read only. Only an admin can approve incentives.",
      };
    },

    async appraisal(user: AuthUser, quarterValue?: string, everyone = false) {
      const quarter = parseQuarterKey(quarterValue);
      const profiles = await loadIncentivePeople(db);
      const deals = await loadIncentiveDeals(db);
      const allowed = teamIds(user, profiles);
      const subjects =
        user.role === "admin" && everyone
          ? profiles
          : profiles.filter((person) => (allowed ?? new Set([user.id])).has(person.userId));
      const results = subjects.map((person) => {
        const ownDeals = dealsFor(deals, person.userId, quarter).map((deal) => ({
          agentId: person.userId,
          status: deal.status,
          invoiceStatus: deal.invoiceStatus,
          sharePercent:
            deal.shares.find((share) => share.userId === person.userId)?.sharePercent ?? 0,
        }));
        const result = appraisalResult({
          agentId: person.userId,
          designation: person.designation,
          monthlyBasic: person.monthlyBasic,
          deals: ownDeals,
        });
        const showSalary = user.role === "admin" || person.userId === user.id;
        return {
          userId: person.userId,
          name: person.name,
          designation: person.designation,
          band: person.band,
          monthlyBasic: showSalary ? person.monthlyBasic : null,
          ...result,
          hikeAmount: showSalary ? result.hikeAmount : null,
          recommendedBasic: showSalary ? result.recommendedBasic : null,
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
      const monthlyBasic = Math.round(
        input.monthlyBasic === undefined ? num(current?.monthlyBasic) : input.monthlyBasic,
      );
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
      const profiles = await loadIncentivePeople(db);
      const deals = await loadIncentiveDeals(db);
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
      return createApprovalService(db).disburse(actor, { quarter: quarterValue, userId });
    },
  };
}
