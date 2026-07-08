import { leads, users } from "@propninja/db";
import type { LeadStatus } from "@propninja/types/enums";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";

/** Pipeline stages that remain subject to inactivity SLA. */
export const SLA_ACTIVE_STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "negotiation"];

export const SLA_THRESHOLD_DAYS = [1, 3, 7, 14] as const;
export const SLA_DEFAULT_INACTIVE_DAYS = 3;

export function lastEngagementAtSql() {
  return sql<Date>`coalesce(${leads.lastActivityAt}, ${leads.lastContactedAt}, ${leads.createdAt})`;
}

/** Cast a JS Date to a bound timestamptz so postgres.js can serialize it in raw SQL. */
function tstz(date: Date) {
  return sql`${date.toISOString()}::timestamptz`;
}

function activeStatusSql() {
  return inArray(leads.leadStatus, SLA_ACTIVE_STATUSES);
}

export type SlaListParams = {
  inactiveDays?: number;
  status?: string;
  assignedTo?: string;
  agentOnlyUserId?: string;
  page?: number;
  pageSize?: number;
};

function buildBreachConditions(params: SlaListParams) {
  const inactiveDays = params.inactiveDays ?? SLA_DEFAULT_INACTIVE_DAYS;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - inactiveDays);

  const conditions = [
    eq(leads.orgId, SINGLE_TENANT_ORG_ID),
    isNull(leads.deletedAt),
    activeStatusSql(),
    sql`${lastEngagementAtSql()} < ${tstz(cutoff)}`,
  ];

  if (params.status) {
    conditions.push(eq(leads.leadStatus, params.status));
  }

  if (params.agentOnlyUserId) {
    conditions.push(eq(leads.assignedTo, params.agentOnlyUserId));
  } else if (params.assignedTo) {
    conditions.push(eq(leads.assignedTo, params.assignedTo));
  }

  return { conditions, inactiveDays, cutoff };
}

export const slaService = {
  async listBreached(params: SlaListParams) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const { conditions, inactiveDays } = buildBreachConditions(params);
    const offset = (page - 1) * pageSize;
    const lastEngagement = lastEngagementAtSql();

    const rows = await db
      .select({
        id: leads.id,
        firstName: leads.firstName,
        lastName: leads.lastName,
        phone: leads.phone,
        leadStatus: leads.leadStatus,
        assignedTo: leads.assignedTo,
        lastActivityAt: leads.lastActivityAt,
        lastContactedAt: leads.lastContactedAt,
        slaBreachedAt: leads.slaBreachedAt,
        createdAt: leads.createdAt,
        inactiveSince: sql<string>`${lastEngagement}`,
        daysSinceActivity: sql<number>`
          extract(day from now() - ${lastEngagement})::int
        `,
        assigneeName: users.name,
        assigneeId: users.id,
      })
      .from(leads)
      .leftJoin(users, eq(leads.assignedTo, users.id))
      .where(and(...conditions))
      .orderBy(sql`${lastEngagement} asc`)
      .limit(pageSize)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(...conditions));

    return {
      items: rows.map((row) => ({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        phone: row.phone,
        leadStatus: row.leadStatus,
        assignedTo: row.assignedTo,
        lastActivityAt: row.lastActivityAt,
        lastContactedAt: row.lastContactedAt,
        slaBreachedAt: row.slaBreachedAt,
        createdAt: row.createdAt,
        inactiveSince: row.inactiveSince,
        daysSinceActivity: row.daysSinceActivity,
        assignedUser: row.assigneeId
          ? { id: row.assigneeId, name: row.assigneeName ?? "Unknown" }
          : null,
      })),
      total,
      page,
      pageSize,
      inactiveDays,
    };
  },

  async getSummary(options?: { agentOnlyUserId?: string }) {
    const baseConditions = [
      eq(leads.orgId, SINGLE_TENANT_ORG_ID),
      isNull(leads.deletedAt),
      activeStatusSql(),
    ];

    if (options?.agentOnlyUserId) {
      baseConditions.push(eq(leads.assignedTo, options.agentOnlyUserId));
    }

    const lastEngagement = lastEngagementAtSql();
    const result: Record<string, number> = {};

    for (const days of SLA_THRESHOLD_DAYS) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(and(...baseConditions, sql`${lastEngagement} < ${tstz(cutoff)}`));
      result[`inactive_${days}d`] = count;
    }

    const defaultCutoff = new Date();
    defaultCutoff.setDate(defaultCutoff.getDate() - SLA_DEFAULT_INACTIVE_DAYS);
    const [{ breachedFlagged }] = await db
      .select({ breachedFlagged: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(...baseConditions, sql`${leads.slaBreachedAt} is not null`));

    return {
      ...result,
      flagged: breachedFlagged,
      defaultInactiveDays: SLA_DEFAULT_INACTIVE_DAYS,
      thresholds: [...SLA_THRESHOLD_DAYS],
    };
  },

  /** Stamp or clear sla_breached_at based on default inactivity threshold. */
  async syncBreachedFlags() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - SLA_DEFAULT_INACTIVE_DAYS);
    const lastEngagement = lastEngagementAtSql();
    const now = new Date();

    const flagged = await db
      .update(leads)
      .set({ slaBreachedAt: now, updatedAt: now })
      .where(
        and(
          eq(leads.orgId, SINGLE_TENANT_ORG_ID),
          isNull(leads.deletedAt),
          activeStatusSql(),
          isNull(leads.slaBreachedAt),
          sql`${lastEngagement} < ${tstz(cutoff)}`,
        ),
      )
      .returning({ id: leads.id });

    const cleared = await db
      .update(leads)
      .set({ slaBreachedAt: null, updatedAt: now })
      .where(
        and(
          eq(leads.orgId, SINGLE_TENANT_ORG_ID),
          isNull(leads.deletedAt),
          sql`${leads.slaBreachedAt} is not null`,
          sql`(${lastEngagement} >= ${tstz(cutoff)} or not (${activeStatusSql()}))`,
        ),
      )
      .returning({ id: leads.id });

    return { flagged: flagged.length, cleared: cleared.length };
  },
};
