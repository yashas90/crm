import {
  appraisalApprovals,
  incentiveApprovals,
  incentiveDisbursements,
  incentiveProfiles,
  notifications,
  salaryHistory,
  users,
} from "@propninja/db";
import { getIstDateKey } from "@propninja/types/ist";
import { formatINR } from "@propninja/types/money";
import { and, eq, lt, lte, sql } from "drizzle-orm";
import { appraisalResult } from "../lib/appraisalMath.js";
import {
  firstOfNextMonth,
  formatEffectiveDate,
  formatMonthLabel,
  isMonthEnd,
  isMonthStart,
  isQuarterEnd,
  previousMonthKey,
  quarterForMonth,
  quarterName,
  quarterStorageKey,
} from "../lib/approvalCalendar.js";
import {
  appraisalApprovedMessage,
  appraisalRejectedMessage,
  incentiveApprovedMessage,
  incentiveDisbursedMessage,
  incentiveRejectedMessage,
  monthEndPendingMessage,
  monthlyIncentiveAdminMessage,
  quarterlyAppraisalAdminMessage,
  salaryAppliedAdminMessage,
  staleIncentiveReminder,
} from "../lib/approvalCopy.js";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import type { Database } from "../lib/db.js";
import { badRequest, forbidden } from "../lib/errors.js";
import { excelWorkbook } from "../lib/excelSheet.js";
import {
  type IncentivePerson,
  dealsFor,
  dealsInMonth,
  loadIncentiveDeals,
  loadIncentivePeople,
  num,
} from "../lib/incentiveData.js";
import {
  type IncentiveDeal,
  shareOf,
  splitEsop,
  summarizeAgentIncentive,
} from "../lib/incentiveMath.js";
import { parseQuarterKey, quarterFromDate, quarterKey } from "../lib/quarters.js";
import type { AuthUser } from "../middleware/auth.js";
import { NOTIFICATION_TYPES, createNotificationService } from "./notificationService.js";

const ADMIN_ONLY = "Only an admin can approve incentives and appraisals";

export type ApprovalFilters = {
  month?: string;
  quarter?: string;
  grade?: string;
  status?: string;
  q?: string;
  eligible?: boolean;
};

function assertAdmin(actor: AuthUser) {
  if (actor.role !== "admin") throw forbidden(ADMIN_ONLY);
}

function money(value: number) {
  return Math.round(value).toFixed(2);
}

function requireReason(reason: string) {
  const trimmed = reason.trim();
  if (!trimmed) throw badRequest("A written reason is required");
  return trimmed;
}

function payoutFor(person: IncentivePerson, people: IncentivePerson[], deals: IncentiveDeal[]) {
  const reports = people.filter((member) => member.reportingToId === person.userId);
  return summarizeAgentIncentive({
    agentId: person.userId,
    band: person.band,
    monthlyBasic: person.monthlyBasic,
    deals,
    team: reports.map((member) => ({
      userId: member.userId,
      monthlyBasic: member.monthlyBasic,
      deals,
    })),
  });
}

function incentiveValues(
  person: IncentivePerson,
  people: IncentivePerson[],
  monthDeals: IncentiveDeal[],
) {
  const payout = payoutFor(person, people, monthDeals);
  const byId = new Map(monthDeals.map((deal) => [deal.id, deal]));
  return {
    monthlySalary: money(person.monthlyBasic),
    eligibilityTarget: money(payout.eligibilityTarget),
    nrAchieved: money(payout.achievedNr),
    achievementPercent: payout.achievementPercent.toFixed(2),
    incentiveTillTarget: money(payout.tillIncentive),
    incentiveAboveTarget: money(payout.aboveIncentive),
    grossIncentive: money(payout.grossIncentive),
    cashAmount: money(payout.cash),
    esopAmount: money(payout.esop),
    n1Bonus: money(payout.n1TeamKicker),
    totalPayable: money(payout.earned),
    details: {
      deals: payout.deals.map((deal) => {
        const source = byId.get(deal.id);
        return {
          tcfCode: deal.tcfCode,
          propertyName: source?.productName ?? null,
          dealValue: Math.round(source?.netRevenue ?? 0),
          nr: Math.round(deal.confirmNr || deal.countedNr),
          closedOn: source?.closedOn ?? null,
          invoiceStatus: deal.invoiceStatus,
        };
      }),
    },
  };
}

export function createApprovalService(db: Database) {
  const notificationsApi = createNotificationService(db);

  async function adminIds() {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.orgId, SINGLE_TENANT_ORG_ID),
          eq(users.role, "admin"),
          eq(users.isActive, true),
        ),
      );
    return rows.map((row) => row.id);
  }

  async function notifyOnce(
    userId: string,
    type: string,
    dedupeKey: string,
    title: string,
    message: string,
    href: string,
  ) {
    const [existing] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.type, type),
          sql`${notifications.payload}->>'dedupeKey' = ${dedupeKey}`,
        ),
      )
      .limit(1);
    if (existing) return;
    await notificationsApi.createNotification(userId, type, { title, message, href, dedupeKey });
  }

  async function notifyAdmins(type: string, dedupeKey: string, title: string, message: string) {
    for (const adminId of await adminIds()) {
      await notifyOnce(adminId, type, dedupeKey, title, message, "/approvals");
    }
  }

  function presentIncentive(row: typeof incentiveApprovals.$inferSelect) {
    const quarter = parseQuarterKey(row.quarterKey);
    return {
      id: row.id,
      userId: row.userId,
      monthKey: row.monthKey,
      monthLabel: formatMonthLabel(row.monthKey),
      quarterKey: row.quarterKey,
      quarterName: quarterName(quarter),
      employeeName: row.employeeName,
      designation: row.designation,
      grade: row.band,
      monthlySalary: num(row.monthlySalary),
      eligibilityTarget: num(row.eligibilityTarget),
      nrAchieved: num(row.nrAchieved),
      achievementPercent: num(row.achievementPercent),
      incentiveTillTarget: num(row.incentiveTillTarget),
      incentiveAboveTarget: num(row.incentiveAboveTarget),
      grossIncentive: num(row.grossIncentive),
      cashAmount: num(row.cashAmount),
      esopAmount: num(row.esopAmount),
      n1Bonus: num(row.n1Bonus),
      totalPayable: num(row.totalPayable),
      status: row.status,
      rejectionReason: row.rejectionReason,
      approvedBy: row.approvedBy,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      disbursedAt: row.disbursedAt?.toISOString() ?? null,
      deals: row.details?.deals ?? [],
    };
  }

  function presentAppraisal(row: typeof appraisalApprovals.$inferSelect) {
    const quarter = parseQuarterKey(row.quarterKey);
    return {
      id: row.id,
      userId: row.userId,
      quarterKey: row.quarterKey,
      quarterName: quarterName(quarter),
      employeeName: row.employeeName,
      designation: row.designation,
      grade: row.band,
      requiredSales: row.requiredSales == null ? null : num(row.requiredSales),
      requiredUnits: row.requiredUnits == null ? null : num(row.requiredUnits),
      achievedSales: num(row.achievedSales),
      achievedUnits: num(row.achievedUnits),
      eligible: row.eligible,
      currentSalary: num(row.currentSalary),
      hikePercent: num(row.hikePercent),
      newSalary: num(row.newSalary),
      incrementAmount: num(row.incrementAmount),
      status: row.status,
      rejectionReason: row.rejectionReason,
      approvedBy: row.approvedBy,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      effectiveFrom: row.effectiveFrom,
      effectiveFromLabel: row.effectiveFrom ? formatEffectiveDate(row.effectiveFrom) : null,
      salaryAppliedAt: row.salaryAppliedAt?.toISOString() ?? null,
      deals: row.deals ?? [],
    };
  }

  function incentiveWhere(filters: ApprovalFilters) {
    const clauses = [eq(incentiveApprovals.orgId, SINGLE_TENANT_ORG_ID)];
    if (filters.month) clauses.push(eq(incentiveApprovals.monthKey, filters.month));
    if (filters.quarter) clauses.push(eq(incentiveApprovals.quarterKey, filters.quarter));
    if (filters.grade) clauses.push(eq(incentiveApprovals.band, filters.grade));
    if (filters.status) clauses.push(eq(incentiveApprovals.status, filters.status));
    if (filters.q) {
      const term = `%${filters.q.replace(/[%_]/g, "")}%`;
      clauses.push(sql`${incentiveApprovals.employeeName} ILIKE ${term}`);
    }
    if (filters.eligible) clauses.push(sql`${incentiveApprovals.totalPayable} > 0`);
    return and(...clauses);
  }

  function appraisalWhere(filters: ApprovalFilters) {
    const clauses = [eq(appraisalApprovals.orgId, SINGLE_TENANT_ORG_ID)];
    if (filters.quarter) clauses.push(eq(appraisalApprovals.quarterKey, filters.quarter));
    if (filters.grade) clauses.push(eq(appraisalApprovals.band, filters.grade));
    if (filters.status) clauses.push(eq(appraisalApprovals.status, filters.status));
    if (filters.q) {
      const term = `%${filters.q.replace(/[%_]/g, "")}%`;
      clauses.push(sql`${appraisalApprovals.employeeName} ILIKE ${term}`);
    }
    if (filters.eligible) clauses.push(eq(appraisalApprovals.eligible, true));
    return and(...clauses);
  }

  async function calculateMonth(monthKey: string, notify: boolean) {
    if (!/^\d{4}-\d{2}$/.test(monthKey)) throw badRequest("Month must be YYYY-MM");
    const quarter = quarterForMonth(monthKey);
    const people = await loadIncentivePeople(db);
    const monthDeals = dealsInMonth(await loadIncentiveDeals(db), monthKey);
    const existing = await db
      .select({ userId: incentiveApprovals.userId, status: incentiveApprovals.status })
      .from(incentiveApprovals)
      .where(eq(incentiveApprovals.monthKey, monthKey));
    const locked = new Set(
      existing.filter((row) => row.status !== "pending_admin_approval").map((row) => row.userId),
    );
    let eligibleEmployees = 0;
    let totalPayout = 0;
    for (const person of people) {
      if (locked.has(person.userId)) continue;
      const values = incentiveValues(person, people, monthDeals);
      const payable = num(values.totalPayable);
      if (payable > 0) {
        eligibleEmployees += 1;
        totalPayout += payable;
      }
      await db
        .insert(incentiveApprovals)
        .values({
          orgId: SINGLE_TENANT_ORG_ID,
          userId: person.userId,
          monthKey,
          quarterKey: quarterStorageKey(quarter),
          employeeName: person.name,
          designation: person.designation,
          band: person.band,
          status: "pending_admin_approval",
          ...values,
        })
        .onConflictDoUpdate({
          target: [incentiveApprovals.userId, incentiveApprovals.monthKey],
          set: {
            quarterKey: quarterStorageKey(quarter),
            employeeName: person.name,
            designation: person.designation,
            band: person.band,
            calculatedAt: new Date(),
            ...values,
          },
        });
    }
    if (notify) {
      const message = monthlyIncentiveAdminMessage({ monthKey, eligibleEmployees, totalPayout });
      await notifyAdmins(
        NOTIFICATION_TYPES.INCENTIVE_CALCULATED,
        `incentive-calculated:${monthKey}`,
        "📊 Monthly incentives calculated",
        message,
      );
    }
    return { monthKey, eligibleEmployees, totalPayout };
  }

  async function calculateQuarter(quarterValue: string | undefined, notify: boolean) {
    const quarter = parseQuarterKey(quarterValue);
    const key = quarterKey(quarter);
    const people = await loadIncentivePeople(db);
    const deals = await loadIncentiveDeals(db);
    const existing = await db
      .select({ userId: appraisalApprovals.userId, status: appraisalApprovals.status })
      .from(appraisalApprovals)
      .where(eq(appraisalApprovals.quarterKey, key));
    const locked = new Set(
      existing.filter((row) => row.status !== "pending_admin_approval").map((row) => row.userId),
    );
    let eligible = 0;
    for (const person of people) {
      if (locked.has(person.userId)) continue;
      const own = dealsFor(deals, person.userId, quarter);
      const result = appraisalResult({
        agentId: person.userId,
        designation: person.designation,
        monthlyBasic: person.monthlyBasic,
        deals: own.map((deal) => ({
          agentId: person.userId,
          status: deal.status,
          invoiceStatus: deal.invoiceStatus,
          sharePercent: shareOf(deal, person.userId),
        })),
      });
      if (result.eligible) eligible += 1;
      const counted = own.filter(
        (deal) => deal.status === "approved" && deal.invoiceStatus === "collected",
      );
      await db
        .insert(appraisalApprovals)
        .values({
          orgId: SINGLE_TENANT_ORG_ID,
          userId: person.userId,
          quarterKey: key,
          employeeName: person.name,
          designation: person.designation,
          band: person.band,
          requiredSales: result.minSales == null ? null : result.minSales.toFixed(2),
          requiredUnits: result.minUnits == null ? null : result.minUnits.toFixed(2),
          achievedSales: result.countedSales.toFixed(2),
          achievedUnits: result.countedUnits.toFixed(2),
          eligible: result.eligible,
          currentSalary: money(person.monthlyBasic),
          hikePercent: result.hikePercent.toFixed(4),
          newSalary: money(result.recommendedBasic),
          incrementAmount: money(result.hikeAmount),
          status: "pending_admin_approval",
          deals: counted.map((deal) => ({
            tcfCode: deal.tcfCode,
            propertyName: deal.productName ?? null,
            dealValue: Math.round(deal.netRevenue),
            nr: Math.round((deal.netRevenue * shareOf(deal, person.userId)) / 100),
            closedOn: deal.closedOn ?? null,
            invoiceRaised: deal.invoiceStatus === "raised" || deal.invoiceStatus === "collected",
            paymentCollected: deal.invoiceStatus === "collected",
          })),
        })
        .onConflictDoUpdate({
          target: [appraisalApprovals.userId, appraisalApprovals.quarterKey],
          set: {
            employeeName: person.name,
            designation: person.designation,
            band: person.band,
            requiredSales: result.minSales == null ? null : result.minSales.toFixed(2),
            requiredUnits: result.minUnits == null ? null : result.minUnits.toFixed(2),
            achievedSales: result.countedSales.toFixed(2),
            achievedUnits: result.countedUnits.toFixed(2),
            eligible: result.eligible,
            currentSalary: money(person.monthlyBasic),
            hikePercent: result.hikePercent.toFixed(4),
            newSalary: money(result.recommendedBasic),
            incrementAmount: money(result.hikeAmount),
            deals: counted.map((deal) => ({
              tcfCode: deal.tcfCode,
              propertyName: deal.productName ?? null,
              dealValue: Math.round(deal.netRevenue),
              nr: Math.round((deal.netRevenue * shareOf(deal, person.userId)) / 100),
              closedOn: deal.closedOn ?? null,
              invoiceRaised: deal.invoiceStatus === "raised" || deal.invoiceStatus === "collected",
              paymentCollected: deal.invoiceStatus === "collected",
            })),
            calculatedAt: new Date(),
          },
        });
    }
    if (notify) {
      const message = quarterlyAppraisalAdminMessage({
        quarterName: quarterName(quarter),
        employees: people.length - locked.size,
        eligible,
      });
      await notifyAdmins(
        NOTIFICATION_TYPES.APPRAISAL_READY,
        `appraisal-ready:${key}`,
        "📋 Quarterly appraisals ready",
        message,
      );
    }
    return { quarterKey: key, employees: people.length, eligible };
  }

  return {
    async summary(actor: AuthUser) {
      assertAdmin(actor);
      const [incentives, appraisals] = await Promise.all([
        db
          .select()
          .from(incentiveApprovals)
          .where(eq(incentiveApprovals.orgId, SINGLE_TENANT_ORG_ID)),
        db
          .select()
          .from(appraisalApprovals)
          .where(eq(appraisalApprovals.orgId, SINGLE_TENANT_ORG_ID)),
      ]);
      const current = quarterStorageKey(parseQuarterKey(undefined));
      const pendingIncentiveRows = incentives.filter(
        (row) => row.status === "pending_admin_approval",
      );
      const approvedQuarter = incentives.filter(
        (row) => row.status === "approved" && row.quarterKey === current,
      );
      const pendingAppraisalRows = appraisals.filter(
        (row) => row.status === "pending_admin_approval",
      );
      const hikes = appraisals.filter((row) => row.status === "approved");
      const distinct = (rows: { userId: string }[]) => new Set(rows.map((row) => row.userId)).size;
      const sum = (
        rows: { totalPayable?: unknown; incrementAmount?: unknown }[],
        key: "totalPayable" | "incrementAmount",
      ) => rows.reduce((total, row) => total + num(row[key] as string), 0);
      return {
        pendingIncentives: {
          employees: distinct(pendingIncentiveRows),
          total: sum(pendingIncentiveRows, "totalPayable"),
        },
        approvedThisQuarter: {
          employees: distinct(approvedQuarter),
          total: sum(approvedQuarter, "totalPayable"),
        },
        pendingAppraisals: { employees: distinct(pendingAppraisalRows) },
        hikesToApply: {
          employees: distinct(hikes),
          totalIncrement: sum(hikes, "incrementAmount"),
        },
      };
    },

    async listIncentives(actor: AuthUser, filters: ApprovalFilters) {
      assertAdmin(actor);
      const rows = await db.select().from(incentiveApprovals).where(incentiveWhere(filters));
      return rows.map(presentIncentive);
    },

    async listAppraisals(actor: AuthUser, filters: ApprovalFilters) {
      assertAdmin(actor);
      const rows = await db.select().from(appraisalApprovals).where(appraisalWhere(filters));
      return rows.map(presentAppraisal);
    },

    async approveIncentive(actor: AuthUser, id: string) {
      assertAdmin(actor);
      const [row] = await db
        .update(incentiveApprovals)
        .set({
          status: "approved",
          approvedBy: actor.id,
          approvedAt: new Date(),
          rejectionReason: null,
        })
        .where(
          and(
            eq(incentiveApprovals.id, id),
            eq(incentiveApprovals.status, "pending_admin_approval"),
          ),
        )
        .returning();
      if (!row) throw badRequest("Only a pending incentive can be approved");
      const quarter = parseQuarterKey(row.quarterKey);
      await notificationsApi.createNotification(row.userId, NOTIFICATION_TYPES.INCENTIVE_APPROVED, {
        title: "Incentive approved",
        message: incentiveApprovedMessage({
          total: num(row.totalPayable),
          cash: num(row.cashAmount),
          esop: num(row.esopAmount),
          quarterName: quarterName(quarter),
        }),
        href: "/incentives",
        dedupeKey: `incentive-approved:${row.id}`,
      });
      return presentIncentive(row);
    },

    async rejectIncentive(actor: AuthUser, id: string, reason: string) {
      assertAdmin(actor);
      const written = requireReason(reason);
      const [row] = await db
        .update(incentiveApprovals)
        .set({
          status: "rejected",
          approvedBy: actor.id,
          approvedAt: new Date(),
          rejectionReason: written,
        })
        .where(
          and(
            eq(incentiveApprovals.id, id),
            eq(incentiveApprovals.status, "pending_admin_approval"),
          ),
        )
        .returning();
      if (!row) throw badRequest("Only a pending incentive can be rejected");
      await notificationsApi.createNotification(row.userId, NOTIFICATION_TYPES.INCENTIVE_REJECTED, {
        title: "Incentive not approved",
        message: incentiveRejectedMessage({ monthKey: row.monthKey, reason: written }),
        href: "/incentives",
        dedupeKey: `incentive-rejected:${row.id}`,
      });
      return presentIncentive(row);
    },

    async approveEligibleIncentives(actor: AuthUser, filters: ApprovalFilters) {
      assertAdmin(actor);
      const rows = await db
        .select()
        .from(incentiveApprovals)
        .where(
          and(incentiveWhere({ ...filters, status: "pending_admin_approval", eligible: true })),
        );
      let approved = 0;
      for (const row of rows) {
        await this.approveIncentive(actor, row.id);
        approved += 1;
      }
      return { approved };
    },

    async approveAppraisal(actor: AuthUser, id: string) {
      assertAdmin(actor);
      const effectiveFrom = firstOfNextMonth();
      const [row] = await db
        .update(appraisalApprovals)
        .set({
          status: "approved",
          approvedBy: actor.id,
          approvedAt: new Date(),
          effectiveFrom,
          rejectionReason: null,
        })
        .where(
          and(
            eq(appraisalApprovals.id, id),
            eq(appraisalApprovals.status, "pending_admin_approval"),
          ),
        )
        .returning();
      if (!row) throw badRequest("Only a pending appraisal can be approved");
      const quarter = parseQuarterKey(row.quarterKey);
      await notificationsApi.createNotification(row.userId, NOTIFICATION_TYPES.APPRAISAL_APPROVED, {
        title: "Appraisal approved",
        message: appraisalApprovedMessage({
          currentSalary: num(row.currentSalary),
          newSalary: num(row.newSalary),
          effectiveFrom,
          hikePercent: num(row.hikePercent),
        }),
        href: "/appraisals",
        dedupeKey: `appraisal-approved:${row.id}`,
      });
      return { ...presentAppraisal(row), quarterName: quarterName(quarter) };
    },

    async rejectAppraisal(actor: AuthUser, id: string, reason: string) {
      assertAdmin(actor);
      const written = requireReason(reason);
      const [row] = await db
        .update(appraisalApprovals)
        .set({
          status: "rejected",
          approvedBy: actor.id,
          approvedAt: new Date(),
          rejectionReason: written,
        })
        .where(
          and(
            eq(appraisalApprovals.id, id),
            eq(appraisalApprovals.status, "pending_admin_approval"),
          ),
        )
        .returning();
      if (!row) throw badRequest("Only a pending appraisal can be rejected");
      const quarter = parseQuarterKey(row.quarterKey);
      await notificationsApi.createNotification(row.userId, NOTIFICATION_TYPES.APPRAISAL_REJECTED, {
        title: "Appraisal reviewed",
        message: appraisalRejectedMessage({ quarterName: quarterName(quarter), reason: written }),
        href: "/appraisals",
        dedupeKey: `appraisal-rejected:${row.id}`,
      });
      return presentAppraisal(row);
    },

    async approveEligibleAppraisals(actor: AuthUser, filters: ApprovalFilters) {
      assertAdmin(actor);
      const rows = await db
        .select()
        .from(appraisalApprovals)
        .where(appraisalWhere({ ...filters, status: "pending_admin_approval", eligible: true }));
      let approved = 0;
      for (const row of rows) {
        await this.approveAppraisal(actor, row.id);
        approved += 1;
      }
      return { approved };
    },

    async quarterlyBundle(actor: AuthUser, quarterValue?: string) {
      assertAdmin(actor);
      const quarter = parseQuarterKey(quarterValue);
      const key = quarterKey(quarter);
      const rows = await db
        .select()
        .from(incentiveApprovals)
        .where(eq(incentiveApprovals.quarterKey, key));
      const byUser = new Map<string, typeof rows>();
      for (const row of rows) {
        const list = byUser.get(row.userId) ?? [];
        list.push(row);
        byUser.set(row.userId, list);
      }
      return {
        quarter,
        rows: [...byUser.entries()].map(([userId, months]) => {
          const approved = months.filter(
            (month) => month.status === "approved" || month.status === "disbursed",
          );
          const waiting = months.filter((month) => month.status === "approved");
          return {
            userId,
            employeeName: months[0]?.employeeName ?? "",
            grade: months[0]?.band ?? null,
            cashTotal: approved.reduce((sum, month) => sum + num(month.cashAmount), 0),
            esopTotal: approved.reduce((sum, month) => sum + num(month.esopAmount), 0),
            combinedTotal: approved.reduce((sum, month) => sum + num(month.totalPayable), 0),
            canDisburse: waiting.length > 0,
            months: months.map((month) => ({
              id: month.id,
              monthKey: month.monthKey,
              monthLabel: formatMonthLabel(month.monthKey),
              status: month.status,
              totalPayable: num(month.totalPayable),
              cashAmount: num(month.cashAmount),
              esopAmount: num(month.esopAmount),
            })),
          };
        }),
      };
    },

    async disburse(actor: AuthUser, input: { quarter: string; userId?: string }) {
      assertAdmin(actor);
      const quarter = parseQuarterKey(input.quarter);
      const key = quarterKey(quarter);
      const clauses = [
        eq(incentiveApprovals.quarterKey, key),
        eq(incentiveApprovals.status, "approved"),
      ];
      if (input.userId) clauses.push(eq(incentiveApprovals.userId, input.userId));
      const waiting = await db
        .select()
        .from(incentiveApprovals)
        .where(and(...clauses));
      if (waiting.length === 0) throw badRequest("Nothing approved is waiting for disbursement");
      const now = new Date();
      await db
        .update(incentiveApprovals)
        .set({ status: "disbursed", disbursedAt: now })
        .where(and(...clauses));
      const byUser = new Map<string, typeof waiting>();
      for (const row of waiting) {
        const list = byUser.get(row.userId) ?? [];
        list.push(row);
        byUser.set(row.userId, list);
      }
      for (const [userId, months] of byUser) {
        const earned = months.reduce((sum, month) => sum + num(month.totalPayable), 0);
        const cash = months.reduce((sum, month) => sum + num(month.cashAmount), 0);
        const esop = months.reduce((sum, month) => sum + num(month.esopAmount), 0);
        await db
          .insert(incentiveDisbursements)
          .values({
            orgId: SINGLE_TENANT_ORG_ID,
            userId,
            quarterKey: key,
            earnedAmount: money(earned),
            cashAmount: money(cash),
            esopAmount: money(esop),
            disbursedBy: actor.id,
            disbursedAt: now,
          })
          .onConflictDoUpdate({
            target: [incentiveDisbursements.userId, incentiveDisbursements.quarterKey],
            set: {
              earnedAmount: money(earned),
              cashAmount: money(cash),
              esopAmount: money(esop),
              disbursedBy: actor.id,
              disbursedAt: now,
            },
          });
        await notificationsApi.createNotification(userId, NOTIFICATION_TYPES.INCENTIVE_DISBURSED, {
          title: "Incentive disbursed",
          message: incentiveDisbursedMessage({ quarterName: quarterName(quarter), total: earned }),
          href: "/incentives",
          dedupeKey: `incentive-disbursed:${key}:${userId}:${now.toISOString()}`,
        });
      }
      return { disbursed: byUser.size };
    },

    async calculateIncentives(actor: AuthUser, month?: string) {
      assertAdmin(actor);
      return calculateMonth(month || previousMonthKey(), true);
    },

    async calculateAppraisals(actor: AuthUser, quarter?: string) {
      assertAdmin(actor);
      return calculateQuarter(quarter, true);
    },

    async overrideIncentive(
      actor: AuthUser,
      id: string,
      patch: {
        monthlySalary?: number;
        eligibilityTarget?: number;
        nrAchieved?: number;
        incentiveTillTarget?: number;
        incentiveAboveTarget?: number;
        n1Bonus?: number;
      },
    ) {
      assertAdmin(actor);
      const [current] = await db
        .select()
        .from(incentiveApprovals)
        .where(eq(incentiveApprovals.id, id))
        .limit(1);
      if (!current) throw badRequest("Incentive not found");
      if (current.status !== "pending_admin_approval") {
        throw badRequest("Only a pending incentive can be overridden");
      }
      const till = patch.incentiveTillTarget ?? num(current.incentiveTillTarget);
      const above = patch.incentiveAboveTarget ?? num(current.incentiveAboveTarget);
      const n1 = patch.n1Bonus ?? num(current.n1Bonus);
      const gross = Math.round(till + above);
      const total = Math.round(gross + n1);
      const split = splitEsop(total);
      const target = patch.eligibilityTarget ?? num(current.eligibilityTarget);
      const achieved = patch.nrAchieved ?? num(current.nrAchieved);
      const [row] = await db
        .update(incentiveApprovals)
        .set({
          monthlySalary: money(patch.monthlySalary ?? num(current.monthlySalary)),
          eligibilityTarget: money(target),
          nrAchieved: money(achieved),
          achievementPercent: (target > 0
            ? Math.round((achieved / target) * 10000) / 100
            : 0
          ).toFixed(2),
          incentiveTillTarget: money(till),
          incentiveAboveTarget: money(above),
          grossIncentive: money(gross),
          n1Bonus: money(n1),
          cashAmount: money(split.cash),
          esopAmount: money(split.esop),
          totalPayable: money(total),
        })
        .where(eq(incentiveApprovals.id, id))
        .returning();
      return presentIncentive(row!);
    },

    async exportIncentives(actor: AuthUser, filters: ApprovalFilters) {
      assertAdmin(actor);
      const rows = await this.listIncentives(actor, filters);
      const xml = excelWorkbook(
        "Incentives",
        ["Name", "Grade", "Gross", "Cash", "ESOP", "Status"],
        rows.map((row) => [
          row.employeeName,
          row.grade ?? "",
          formatINR(row.grossIncentive),
          formatINR(row.cashAmount),
          formatINR(row.esopAmount),
          row.status,
        ]),
      );
      return { filename: "incentive-sheet.xls", body: xml };
    },

    async exportAppraisals(actor: AuthUser, filters: ApprovalFilters) {
      assertAdmin(actor);
      const rows = await this.listAppraisals(actor, filters);
      const xml = excelWorkbook(
        "Appraisals",
        ["Name", "Designation", "Current Salary", "New Salary", "Increment", "Effective Date"],
        rows.map((row) => [
          row.employeeName,
          row.designation ?? "",
          formatINR(row.currentSalary),
          formatINR(row.newSalary),
          formatINR(row.incrementAmount),
          row.effectiveFromLabel ?? "",
        ]),
      );
      return { filename: "appraisal-sheet.xls", body: xml };
    },

    async applyDueSalaries(now = new Date()) {
      const today = getIstDateKey(now);
      const due = await db
        .select()
        .from(appraisalApprovals)
        .where(
          and(
            eq(appraisalApprovals.status, "approved"),
            lte(appraisalApprovals.effectiveFrom, today),
          ),
        );
      for (const row of due) {
        const nextSalary = num(row.newSalary);
        const previous = num(row.currentSalary);
        const [profile] = await db
          .select()
          .from(incentiveProfiles)
          .where(eq(incentiveProfiles.userId, row.userId))
          .limit(1);
        if (profile) {
          await db
            .update(incentiveProfiles)
            .set({ monthlyBasic: money(nextSalary), updatedAt: now })
            .where(eq(incentiveProfiles.userId, row.userId));
        } else {
          await db.insert(incentiveProfiles).values({
            userId: row.userId,
            orgId: SINGLE_TENANT_ORG_ID,
            monthlyBasic: money(nextSalary),
            designation: row.designation,
            band: row.band,
          });
        }
        await db.insert(salaryHistory).values({
          orgId: SINGLE_TENANT_ORG_ID,
          userId: row.userId,
          previousSalary: money(previous),
          newSalary: money(nextSalary),
          incrementAmount: money(num(row.incrementAmount)),
          reason: `Appraisal ${row.quarterKey}`,
          appraisalId: row.id,
          effectiveFrom: row.effectiveFrom,
          changedBy: null,
        });
        await db
          .update(appraisalApprovals)
          .set({ status: "salary_applied", salaryAppliedAt: now })
          .where(eq(appraisalApprovals.id, row.id));
      }
      if (due.length > 0) {
        const message = salaryAppliedAdminMessage(due.length);
        await notifyAdmins(
          NOTIFICATION_TYPES.SALARY_APPLIED,
          `salary-applied:${today}`,
          "Salary updated",
          message,
        );
      }
      return { applied: due.length };
    },

    async runDaily(now = new Date()) {
      const dateKey = getIstDateKey(now);
      if (isMonthStart(dateKey)) {
        await calculateMonth(previousMonthKey(now), true);
      }
      if (isQuarterEnd(dateKey)) {
        const quarter = quarterFromDate(dateKey);
        if (quarter) await calculateQuarter(quarterKey(quarter), true);
      }
      await this.applyDueSalaries(now);
      const staleBefore = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const stale = await db
        .select({ userId: incentiveApprovals.userId })
        .from(incentiveApprovals)
        .where(
          and(
            eq(incentiveApprovals.status, "pending_admin_approval"),
            lt(incentiveApprovals.calculatedAt, staleBefore),
          ),
        );
      const staleEmployees = new Set(stale.map((row) => row.userId)).size;
      if (staleEmployees > 0) {
        await notifyAdmins(
          NOTIFICATION_TYPES.INCENTIVE_PENDING_REMINDER,
          `incentive-stale:${dateKey}`,
          "Pending incentive approvals",
          staleIncentiveReminder(staleEmployees),
        );
      }
      if (isMonthEnd(dateKey)) {
        const pending = await db
          .select({ userId: incentiveApprovals.userId })
          .from(incentiveApprovals)
          .where(eq(incentiveApprovals.status, "pending_admin_approval"));
        const pendingEmployees = new Set(pending.map((row) => row.userId)).size;
        if (pendingEmployees > 0) {
          await notifyAdmins(
            NOTIFICATION_TYPES.INCENTIVE_MONTH_END,
            `incentive-month-end:${dateKey.slice(0, 7)}`,
            "End of month",
            monthEndPendingMessage(pendingEmployees),
          );
        }
      }
      return { ok: true };
    },
  };
}
