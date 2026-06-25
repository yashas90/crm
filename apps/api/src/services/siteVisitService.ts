import { leads, projects, siteVisits, users } from "@propninja/db";
import { getIstDateKey } from "@propninja/types/ist";
import { and, asc, count, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { boundPageSize } from "../lib/pagination.js";
import {
  SiteVisitOverlapError,
  SiteVisitProjectRequiredError,
  type SiteVisitStatus,
  normalizeVisitTime,
  siteVisitRangesOverlap,
  siteVisitTimeRange,
} from "../lib/siteVisitTime.js";

export type { SiteVisitStatus };
export { SiteVisitProjectRequiredError } from "../lib/siteVisitTime.js";

export interface CreateSiteVisitInput {
  leadId: string;
  projectId?: string | null;
  agentId: string;
  visitDate: string;
  visitTime: string;
  duration?: number;
  notes?: string | null;
  propertyAddress?: string | null;
}

export interface UpdateSiteVisitInput {
  projectId?: string | null;
  agentId?: string;
  visitDate?: string;
  visitTime?: string;
  duration?: number;
  status?: SiteVisitStatus;
  notes?: string | null;
  propertyAddress?: string | null;
  outcome?: string | null;
  outcomeNote?: string | null;
}

export interface ListSiteVisitsParams {
  agentId?: string;
  leadId?: string;
  projectId?: string;
  status?: SiteVisitStatus;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

const visitSelectFields = {
  id: siteVisits.id,
  leadId: siteVisits.leadId,
  projectId: siteVisits.projectId,
  agentId: siteVisits.agentId,
  visitDate: siteVisits.visitDate,
  visitTime: siteVisits.visitTime,
  duration: siteVisits.duration,
  status: siteVisits.status,
  notes: siteVisits.notes,
  propertyAddress: siteVisits.propertyAddress,
  outcome: siteVisits.outcome,
  outcomeNote: siteVisits.outcomeNote,
  reminderSent: siteVisits.reminderSent,
  createdAt: siteVisits.createdAt,
  updatedAt: siteVisits.updatedAt,
  lead: {
    id: leads.id,
    firstName: leads.firstName,
    lastName: leads.lastName,
    phone: leads.phone,
  },
  project: {
    id: projects.id,
    name: projects.name,
  },
  agent: {
    id: users.id,
    name: users.name,
  },
};

function mapVisitRow(row: {
  id: string;
  leadId: string;
  projectId: string | null;
  agentId: string;
  visitDate: string;
  visitTime: string;
  duration: number;
  status: string;
  notes: string | null;
  propertyAddress: string | null;
  outcome: string | null;
  outcomeNote: string | null;
  reminderSent: boolean;
  createdAt: Date;
  updatedAt: Date;
  lead: { id: string; firstName: string; lastName: string; phone: string | null } | null;
  project: { id: string; name: string } | null;
  agent: { id: string; name: string } | null;
}) {
  const property =
    row.propertyAddress?.trim() || (row.project?.name ? `${row.project.name}` : null);

  return {
    id: row.id,
    leadId: row.leadId,
    projectId: row.projectId,
    agentId: row.agentId,
    visitDate: row.visitDate,
    visitTime: row.visitTime,
    duration: row.duration,
    status: row.status as SiteVisitStatus,
    notes: row.notes,
    propertyAddress: row.propertyAddress,
    propertyLabel: property,
    outcome: row.outcome,
    outcomeNote: row.outcomeNote,
    reminderSent: row.reminderSent,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lead: row.lead,
    project: row.project,
    agent: row.agent,
  };
}

function buildListConditions(params: ListSiteVisitsParams) {
  const conditions = [eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID)];

  if (params.agentId) conditions.push(eq(siteVisits.agentId, params.agentId));
  if (params.leadId) conditions.push(eq(siteVisits.leadId, params.leadId));
  if (params.projectId) conditions.push(eq(siteVisits.projectId, params.projectId));
  if (params.status) conditions.push(eq(siteVisits.status, params.status));
  if (params.date) conditions.push(eq(siteVisits.visitDate, params.date));
  if (params.dateFrom) conditions.push(gte(siteVisits.visitDate, params.dateFrom));
  if (params.dateTo) conditions.push(lte(siteVisits.visitDate, params.dateTo));

  return and(...conditions);
}

async function assertNoOverlap(
  agentId: string,
  visitDate: string,
  visitTime: string,
  duration: number,
  excludeId?: string,
) {
  const normalizedTime = normalizeVisitTime(visitTime);
  const sameDay = await db
    .select({
      id: siteVisits.id,
      visitDate: siteVisits.visitDate,
      visitTime: siteVisits.visitTime,
      duration: siteVisits.duration,
      status: siteVisits.status,
    })
    .from(siteVisits)
    .where(
      and(
        eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID),
        eq(siteVisits.agentId, agentId),
        eq(siteVisits.visitDate, visitDate),
        ne(siteVisits.status, "cancelled"),
        excludeId ? ne(siteVisits.id, excludeId) : undefined,
      ),
    );

  for (const existing of sameDay) {
    if (
      siteVisitRangesOverlap(
        visitDate,
        normalizedTime,
        duration,
        existing.visitDate,
        existing.visitTime,
        existing.duration,
      )
    ) {
      throw new SiteVisitOverlapError();
    }
  }
}

export const siteVisitService = {
  async list(params: ListSiteVisitsParams) {
    const page = params.page ?? 1;
    const pageSize = boundPageSize(params.pageSize);
    const offset = (page - 1) * pageSize;
    const where = buildListConditions(params);

    const [rows, totalRow] = await Promise.all([
      db
        .select(visitSelectFields)
        .from(siteVisits)
        .leftJoin(leads, eq(siteVisits.leadId, leads.id))
        .leftJoin(projects, eq(siteVisits.projectId, projects.id))
        .leftJoin(users, eq(siteVisits.agentId, users.id))
        .where(where)
        .orderBy(asc(siteVisits.visitDate), asc(siteVisits.visitTime))
        .limit(pageSize)
        .offset(offset),
      db.select({ total: count() }).from(siteVisits).where(where),
    ]);

    return {
      items: rows.map((row) => mapVisitRow(row)),
      page,
      pageSize,
      total: Number(totalRow[0]?.total ?? 0),
    };
  },

  async getById(id: string) {
    const [row] = await db
      .select(visitSelectFields)
      .from(siteVisits)
      .leftJoin(leads, eq(siteVisits.leadId, leads.id))
      .leftJoin(projects, eq(siteVisits.projectId, projects.id))
      .leftJoin(users, eq(siteVisits.agentId, users.id))
      .where(and(eq(siteVisits.id, id), eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID)))
      .limit(1);

    return row ? mapVisitRow(row) : null;
  },

  async listToday(agentId: string) {
    const today = getIstDateKey();
    return this.list({
      agentId,
      date: today,
      pageSize: 100,
    });
  },

  async calendar(params: { dateFrom: string; dateTo: string; agentId?: string }) {
    const result = await this.list({
      agentId: params.agentId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      pageSize: 500,
    });

    const grouped: Record<string, ReturnType<typeof mapVisitRow>[]> = {};
    for (const visit of result.items) {
      const key = visit.visitDate;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(visit);
    }

    return { dates: grouped, total: result.total };
  },

  async create(input: CreateSiteVisitInput) {
    const visitTime = normalizeVisitTime(input.visitTime);
    const duration = input.duration ?? 60;

    await assertNoOverlap(input.agentId, input.visitDate, visitTime, duration);

    const [row] = await db
      .insert(siteVisits)
      .values({
        orgId: SINGLE_TENANT_ORG_ID,
        leadId: input.leadId,
        projectId: input.projectId ?? null,
        agentId: input.agentId,
        visitDate: input.visitDate,
        visitTime,
        duration,
        notes: input.notes ?? null,
        propertyAddress: input.propertyAddress ?? null,
        status: "scheduled",
      })
      .returning();

    if (!row) throw new Error("Failed to create site visit");
    return this.getById(row.id);
  },

  async update(id: string, input: UpdateSiteVisitInput) {
    const existing = await this.getById(id);
    if (!existing) return null;

    const agentId = input.agentId ?? existing.agentId;
    const visitDate = input.visitDate ?? existing.visitDate;
    const visitTime = normalizeVisitTime(input.visitTime ?? existing.visitTime);
    const duration = input.duration ?? existing.duration;

    if (
      agentId !== existing.agentId ||
      visitDate !== existing.visitDate ||
      visitTime !== existing.visitTime ||
      duration !== existing.duration
    ) {
      await assertNoOverlap(agentId, visitDate, visitTime, duration, id);
    }

    const nextStatus = input.status ?? existing.status;
    const nextProjectId = input.projectId !== undefined ? input.projectId : existing.projectId;

    if (nextStatus === "completed" && !nextProjectId) {
      throw new SiteVisitProjectRequiredError();
    }

    const resetReminder =
      visitDate !== existing.visitDate ||
      visitTime !== existing.visitTime ||
      nextStatus !== existing.status;

    await db
      .update(siteVisits)
      .set({
        projectId: nextProjectId,
        agentId,
        visitDate,
        visitTime,
        duration,
        status: nextStatus,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        propertyAddress:
          input.propertyAddress !== undefined ? input.propertyAddress : existing.propertyAddress,
        outcome: input.outcome !== undefined ? input.outcome : existing.outcome,
        outcomeNote: input.outcomeNote !== undefined ? input.outcomeNote : existing.outcomeNote,
        reminderSent: resetReminder ? false : existing.reminderSent,
        updatedAt: new Date(),
      })
      .where(eq(siteVisits.id, id));

    return this.getById(id);
  },

  async cancel(id: string) {
    return this.update(id, { status: "cancelled" });
  },

  async countToday(agentId?: string) {
    const today = getIstDateKey();
    const conditions = [
      eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID),
      eq(siteVisits.visitDate, today),
      ne(siteVisits.status, "cancelled"),
    ];
    if (agentId) conditions.push(eq(siteVisits.agentId, agentId));

    const [row] = await db
      .select({ total: count() })
      .from(siteVisits)
      .where(and(...conditions));

    return Number(row?.total ?? 0);
  },

  async findDueForReminder(now = new Date()) {
    const windowStart = new Date(now.getTime() + 25 * 60_000);
    const windowEnd = new Date(now.getTime() + 35 * 60_000);

    const candidates = await db
      .select(visitSelectFields)
      .from(siteVisits)
      .leftJoin(leads, eq(siteVisits.leadId, leads.id))
      .leftJoin(projects, eq(siteVisits.projectId, projects.id))
      .leftJoin(users, eq(siteVisits.agentId, users.id))
      .where(
        and(
          eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID),
          eq(siteVisits.status, "scheduled"),
          eq(siteVisits.reminderSent, false),
          gte(siteVisits.visitDate, sql`CURRENT_DATE`),
          lte(siteVisits.visitDate, sql`CURRENT_DATE`),
        ),
      );

    return candidates
      .map((row) => mapVisitRow(row))
      .filter((visit) => {
        const { start } = siteVisitTimeRange(visit.visitDate, visit.visitTime, visit.duration);
        return start >= windowStart && start <= windowEnd;
      });
  },

  async markReminderSent(id: string) {
    await db
      .update(siteVisits)
      .set({ reminderSent: true, updatedAt: new Date() })
      .where(eq(siteVisits.id, id));
  },
};
