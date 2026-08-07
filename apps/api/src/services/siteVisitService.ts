import { leads, organizations, projectUnits, projects, siteVisits, users } from "@propninja/db";
import { getIstDateKey } from "@propninja/types/ist";
import { and, asc, count, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { LIST_PAGE_SIZE_MAX, boundPageSize } from "../lib/pagination.js";
import { generateSiteVisitPublicToken } from "../lib/siteVisitPublicToken.js";
import {
  DAY_OF_8AM_TIER,
  type SiteVisitReminderTier,
  appendReminderTier,
  hasReminderTierSent,
  parseSiteVisitReminderMinutes,
} from "../lib/siteVisitReminders.js";
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

/** Normalize postgres `date` / ISO strings to YYYY-MM-DD for API responses. */
function normalizeVisitDate(value: string | Date): string {
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match?.[1] ?? value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

export interface CreateSiteVisitInput {
  leadId: string;
  projectId?: string | null;
  unitId?: string | null;
  tower?: string | null;
  agentId: string;
  visitDate: string;
  visitTime: string;
  duration?: number;
  notes?: string | null;
  propertyAddress?: string | null;
  meetingLocation?: string | null;
  mapsLink?: string | null;
  customerEmail?: string | null;
}

export interface UpdateSiteVisitInput {
  projectId?: string | null;
  unitId?: string | null;
  tower?: string | null;
  agentId?: string;
  visitDate?: string;
  visitTime?: string;
  duration?: number;
  status?: SiteVisitStatus;
  notes?: string | null;
  propertyAddress?: string | null;
  meetingLocation?: string | null;
  mapsLink?: string | null;
  customerEmail?: string | null;
  outcome?: string | null;
  outcomeNote?: string | null;
  confirmedByClient?: boolean;
  confirmedByClientAt?: Date | null;
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
  unitId: siteVisits.unitId,
  tower: siteVisits.tower,
  agentId: siteVisits.agentId,
  visitDate: siteVisits.visitDate,
  visitTime: siteVisits.visitTime,
  duration: siteVisits.duration,
  status: siteVisits.status,
  notes: siteVisits.notes,
  propertyAddress: siteVisits.propertyAddress,
  meetingLocation: siteVisits.meetingLocation,
  mapsLink: siteVisits.mapsLink,
  customerEmail: siteVisits.customerEmail,
  publicToken: siteVisits.publicToken,
  googleCalendarEventId: siteVisits.googleCalendarEventId,
  outcome: siteVisits.outcome,
  outcomeNote: siteVisits.outcomeNote,
  reminderSent: siteVisits.reminderSent,
  remindersSent: siteVisits.remindersSent,
  confirmedByClient: siteVisits.confirmedByClient,
  confirmedByClientAt: siteVisits.confirmedByClientAt,
  createdAt: siteVisits.createdAt,
  updatedAt: siteVisits.updatedAt,
  lead: {
    id: leads.id,
    firstName: leads.firstName,
    lastName: leads.lastName,
    phone: leads.phone,
    email: leads.email,
    assignedTo: leads.assignedTo,
  },
  project: {
    id: projects.id,
    name: projects.name,
    gallery: projects.gallery,
  },
  unit: {
    id: projectUnits.id,
    unitNumber: projectUnits.unitNumber,
  },
  agent: {
    id: users.id,
    name: users.name,
    phone: users.phone,
  },
};

function mapVisitRow(row: {
  id: string;
  leadId: string;
  projectId: string | null;
  unitId: string | null;
  tower: string | null;
  agentId: string;
  visitDate: string;
  visitTime: string;
  duration: number;
  status: string;
  notes: string | null;
  propertyAddress: string | null;
  meetingLocation: string | null;
  mapsLink: string | null;
  customerEmail: string | null;
  publicToken: string;
  googleCalendarEventId: string | null;
  outcome: string | null;
  outcomeNote: string | null;
  reminderSent: boolean;
  remindersSent: SiteVisitReminderTier[];
  confirmedByClient: boolean;
  confirmedByClientAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
    assignedTo?: string | null;
  } | null;
  project: {
    id: string;
    name: string;
    gallery: {
      items: Array<{
        id: string;
        name: string;
        url?: string;
        fileKey?: string;
        mimeType?: string;
        placeholder?: boolean;
      }>;
    } | null;
  } | null;
  unit: { id: string; unitNumber: string } | null;
  agent: { id: string; name: string; phone: string | null } | null;
}) {
  const property =
    row.meetingLocation?.trim() ||
    row.propertyAddress?.trim() ||
    (row.project?.name ? `${row.project.name}` : null);

  return {
    id: row.id,
    leadId: row.leadId,
    projectId: row.projectId,
    unitId: row.unitId,
    tower: row.tower,
    agentId: row.agentId,
    visitDate: normalizeVisitDate(row.visitDate),
    visitTime: row.visitTime,
    duration: row.duration,
    status: row.status as SiteVisitStatus,
    notes: row.notes,
    propertyAddress: row.propertyAddress,
    meetingLocation: row.meetingLocation,
    mapsLink: row.mapsLink,
    customerEmail: row.customerEmail,
    publicToken: row.publicToken,
    googleCalendarEventId: row.googleCalendarEventId,
    propertyLabel: property,
    outcome: row.outcome,
    outcomeNote: row.outcomeNote,
    reminderSent: row.reminderSent,
    remindersSent: row.remindersSent ?? [],
    confirmedByClient: row.confirmedByClient ?? false,
    confirmedByClientAt: row.confirmedByClientAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lead: row.lead,
    project: row.project,
    unit: row.unit,
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
        .leftJoin(projectUnits, eq(siteVisits.unitId, projectUnits.id))
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
      .leftJoin(projectUnits, eq(siteVisits.unitId, projectUnits.id))
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
      page: 1,
      pageSize: LIST_PAGE_SIZE_MAX,
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

    let publicToken = generateSiteVisitPublicToken();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const [row] = await db
          .insert(siteVisits)
          .values({
            orgId: SINGLE_TENANT_ORG_ID,
            leadId: input.leadId,
            projectId: input.projectId ?? null,
            unitId: input.unitId ?? null,
            tower: input.tower ?? null,
            agentId: input.agentId,
            visitDate: input.visitDate,
            visitTime,
            duration,
            notes: input.notes ?? null,
            propertyAddress: input.propertyAddress ?? null,
            meetingLocation: input.meetingLocation ?? null,
            mapsLink: input.mapsLink ?? null,
            customerEmail: input.customerEmail ?? null,
            publicToken,
            status: "scheduled",
            remindersSent: [],
          })
          .returning();

        if (!row) throw new Error("Failed to create site visit");
        return this.getById(row.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("site_visits_public_token_idx") && !message.includes("unique")) {
          throw error;
        }
        publicToken = generateSiteVisitPublicToken();
      }
    }

    throw new Error("Failed to allocate public token for site visit");
  },

  async getByPublicToken(publicToken: string) {
    const [row] = await db
      .select(visitSelectFields)
      .from(siteVisits)
      .leftJoin(leads, eq(siteVisits.leadId, leads.id))
      .leftJoin(projects, eq(siteVisits.projectId, projects.id))
      .leftJoin(projectUnits, eq(siteVisits.unitId, projectUnits.id))
      .leftJoin(users, eq(siteVisits.agentId, users.id))
      .where(
        and(eq(siteVisits.publicToken, publicToken), eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID)),
      )
      .limit(1);

    return row ? mapVisitRow(row) : null;
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

    const scheduleChanged =
      visitDate !== existing.visitDate ||
      visitTime !== existing.visitTime ||
      duration !== existing.duration;

    const resetReminder = scheduleChanged || nextStatus !== existing.status;

    await db
      .update(siteVisits)
      .set({
        projectId: nextProjectId,
        unitId: input.unitId !== undefined ? input.unitId : existing.unitId,
        tower: input.tower !== undefined ? input.tower : existing.tower,
        agentId,
        visitDate,
        visitTime,
        duration,
        status: nextStatus,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        propertyAddress:
          input.propertyAddress !== undefined ? input.propertyAddress : existing.propertyAddress,
        meetingLocation:
          input.meetingLocation !== undefined ? input.meetingLocation : existing.meetingLocation,
        mapsLink: input.mapsLink !== undefined ? input.mapsLink : existing.mapsLink,
        customerEmail:
          input.customerEmail !== undefined ? input.customerEmail : existing.customerEmail,
        outcome: input.outcome !== undefined ? input.outcome : existing.outcome,
        outcomeNote: input.outcomeNote !== undefined ? input.outcomeNote : existing.outcomeNote,
        confirmedByClient:
          input.confirmedByClient !== undefined
            ? input.confirmedByClient
            : existing.confirmedByClient,
        confirmedByClientAt:
          input.confirmedByClientAt !== undefined
            ? input.confirmedByClientAt
            : existing.confirmedByClientAt
              ? new Date(existing.confirmedByClientAt)
              : null,
        reminderSent: resetReminder ? false : existing.reminderSent,
        remindersSent: resetReminder ? [] : existing.remindersSent,
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

  async findDueForReminders(now = new Date()) {
    const [org] = await db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, SINGLE_TENANT_ORG_ID))
      .limit(1);

    const tiers = parseSiteVisitReminderMinutes(org?.settings as Record<string, unknown> | null);
    const due: Array<ReturnType<typeof mapVisitRow> & { tierMinutes: number }> = [];

    const candidates = await db
      .select(visitSelectFields)
      .from(siteVisits)
      .leftJoin(leads, eq(siteVisits.leadId, leads.id))
      .leftJoin(projects, eq(siteVisits.projectId, projects.id))
      .leftJoin(projectUnits, eq(siteVisits.unitId, projectUnits.id))
      .leftJoin(users, eq(siteVisits.agentId, users.id))
      .where(
        and(
          eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID),
          eq(siteVisits.status, "scheduled"),
          gte(siteVisits.visitDate, sql`CURRENT_DATE - INTERVAL '1 day'`),
        ),
      );

    for (const row of candidates) {
      const visit = mapVisitRow(row);
      const { start } = siteVisitTimeRange(visit.visitDate, visit.visitTime, visit.duration);
      const minutesUntil = (start.getTime() - now.getTime()) / 60_000;

      for (const tierMinutes of tiers) {
        if (hasReminderTierSent(visit.remindersSent, tierMinutes)) continue;
        const windowStart = tierMinutes - 3;
        const windowEnd = tierMinutes + 3;
        if (minutesUntil >= windowStart && minutesUntil <= windowEnd) {
          due.push({ ...visit, tierMinutes });
          break;
        }
      }
    }

    // 8 AM IST day-of reminder — fires once during the 8:00 hour on the visit day
    for (const row of candidates) {
      const visit = mapVisitRow(row);
      if (visit.visitDate !== getIstDateKey()) continue;
      if (hasReminderTierSent(visit.remindersSent, DAY_OF_8AM_TIER)) continue;
      const nowIst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      if (nowIst.getHours() === 8) {
        due.push({ ...visit, tierMinutes: DAY_OF_8AM_TIER });
      }
    }

    return due;
  },

  async markReminderTierSent(id: string, tierMinutes: number) {
    const existing = await this.getById(id);
    if (!existing) return;

    const remindersSent = appendReminderTier(existing.remindersSent, tierMinutes);
    await db
      .update(siteVisits)
      .set({
        remindersSent,
        reminderSent: true,
        updatedAt: new Date(),
      })
      .where(eq(siteVisits.id, id));
  },

  /** @deprecated Use markReminderTierSent */
  async markReminderSent(id: string) {
    await this.markReminderTierSent(id, 30);
  },

  async dashboardSummary(agentId?: string) {
    const today = getIstDateKey();
    const base = [eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID)];
    if (agentId) base.push(eq(siteVisits.agentId, agentId));

    const [todayRow, upcomingRow, completedRow, cancelledRow, missedRow] = await Promise.all([
      db
        .select({ total: count() })
        .from(siteVisits)
        .where(and(...base, eq(siteVisits.visitDate, today), ne(siteVisits.status, "cancelled"))),
      db
        .select({ total: count() })
        .from(siteVisits)
        .where(and(...base, eq(siteVisits.status, "scheduled"), gte(siteVisits.visitDate, today))),
      db
        .select({ total: count() })
        .from(siteVisits)
        .where(and(...base, eq(siteVisits.status, "completed"))),
      db
        .select({ total: count() })
        .from(siteVisits)
        .where(and(...base, eq(siteVisits.status, "cancelled"))),
      db
        .select({ total: count() })
        .from(siteVisits)
        .where(and(...base, eq(siteVisits.status, "no_show"))),
    ]);

    return {
      today: Number(todayRow[0]?.total ?? 0),
      upcoming: Number(upcomingRow[0]?.total ?? 0),
      completed: Number(completedRow[0]?.total ?? 0),
      cancelled: Number(cancelledRow[0]?.total ?? 0),
      missed: Number(missedRow[0]?.total ?? 0),
    };
  },
};
