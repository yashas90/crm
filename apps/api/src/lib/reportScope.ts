import { leads } from "@propninja/db";
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { adLeadsOnlyFilter } from "./adLeadFilters.js";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";

export type ReportScope = {
  dateFrom: Date;
  dateTo: Date;
  userId?: string;
  status?: string;
  adLeadsOnly?: boolean;
};

export function scopedLeadBook(scope: Pick<ReportScope, "userId" | "status">) {
  const filters = [eq(leads.orgId, SINGLE_TENANT_ORG_ID), isNull(leads.deletedAt)];

  if (scope.userId) {
    filters.push(eq(leads.assignedTo, scope.userId));
  }

  if (scope.status) {
    filters.push(eq(leads.leadStatus, scope.status));
  }

  return and(...filters);
}

export function scopedLeadCreated(scope: ReportScope) {
  const filters = [
    scopedLeadBook(scope),
    gte(leads.createdAt, scope.dateFrom),
    lte(leads.createdAt, scope.dateTo),
  ];

  if (scope.adLeadsOnly) {
    filters.push(adLeadsOnlyFilter());
  }

  return and(...filters);
}

export function priorPeriod(scope: ReportScope) {
  const duration = scope.dateTo.getTime() - scope.dateFrom.getTime();
  const priorTo = new Date(scope.dateFrom.getTime() - 1);
  const priorFrom = new Date(priorTo.getTime() - duration);
  return { priorFrom, priorTo };
}

export function trendWindow(scope: ReportScope) {
  const mid = new Date(
    scope.dateFrom.getTime() + (scope.dateTo.getTime() - scope.dateFrom.getTime()) / 2,
  );
  return {
    recentFrom: mid,
    recentTo: scope.dateTo,
    priorFrom: scope.dateFrom,
    priorTo: new Date(mid.getTime() - 1),
  };
}
