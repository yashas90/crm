import {
  incentiveProfiles,
  transactionClosureShares,
  transactionClosures,
  users,
} from "@propninja/db";
import { and, eq, inArray } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";
import type { Database } from "./db.js";
import { type IncentiveBand, type IncentiveDeal, isIncentiveBand } from "./incentiveMath.js";
import { type QuarterRef, dateInQuarter } from "./quarters.js";

export function num(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type IncentivePerson = {
  userId: string;
  name: string;
  band: IncentiveBand | null;
  designation: string | null;
  monthlyBasic: number;
  reportingToId: string | null;
};

export async function loadIncentivePeople(db: Database): Promise<IncentivePerson[]> {
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

export async function loadIncentiveDeals(db: Database): Promise<IncentiveDeal[]> {
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
    productName: row.productName,
    shares: shares
      .filter((share) => share.tcfId === row.id && share.userId)
      .map((share) => ({
        userId: share.userId as string,
        sharePercent: num(share.sharePercent),
      })),
  }));
}

export function dealsFor(all: IncentiveDeal[], userId: string, quarter: QuarterRef) {
  return all.filter(
    (deal) =>
      dateInQuarter(deal.closedOn, quarter) &&
      deal.shares.some((share) => share.userId === userId && share.sharePercent > 0),
  );
}

export function dealsInMonth(all: IncentiveDeal[], monthKey: string) {
  return all.filter((deal) => deal.closedOn?.slice(0, 7) === monthKey);
}
