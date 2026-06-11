import { callRecords, leadActivities, leads, projects, users } from "@propninja/db";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { adLeadsOnlyFilter } from "../lib/adLeadFilters.js";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { notFound } from "../lib/errors.js";
import { inferFollowupType } from "../lib/followupType.js";
import { expandLeadSourceFilter } from "../lib/leadSourceAliases.js";
import type { CreateLeadBody } from "../lib/validators/leads.js";

type LeadStatus = "new" | "contacted" | "qualified" | "negotiation" | "won" | "lost";
type Temperature = "cold" | "warm" | "hot";

export interface ListLeadsParams {
  status?: LeadStatus;
  search?: string;
  page?: number;
  pageSize?: number;
  assignedTo?: string;
  projectId?: string;
  temperature?: Temperature;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
  followUpDueBefore?: string;
  followUpDueAfter?: string;
  orderByFollowUp?: boolean;
  unassigned?: boolean;
  activeOnly?: boolean;
  deletedOnly?: boolean;
  adLeadsOnly?: boolean;
}

export type CreateLeadInput = CreateLeadBody;

export interface UpdateLeadInput {
  leadId: string;
  actingUserId: string;
  payload: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    secondaryPhone: string;
    city: string;
    state: string;
    leadSource: string;
    leadStatus: LeadStatus;
    temperature: Temperature;
    notes: string;
    tags: string[];
    nextFollowupAt: string;
    estimatedValue: number | null;
    projectName: string;
    projectId: string | null;
  }>;
}

export interface AssignLeadInput {
  leadId: string;
  userId: string;
  actingUserId: string;
}

export class LeadDuplicatePhoneError extends Error {
  code = "LEAD_DUPLICATE_PHONE";

  constructor() {
    super("Lead with this phone already exists");
    this.name = "LeadDuplicatePhoneError";
  }
}

async function resolveProjectFields(input: {
  projectId?: string | null;
  projectName?: string;
}) {
  if (input.projectId) {
    const [project] = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(
        and(
          eq(projects.id, input.projectId),
          eq(projects.orgId, SINGLE_TENANT_ORG_ID),
          isNull(projects.deletedAt),
        ),
      )
      .limit(1);

    if (!project) {
      throw notFound("Project not found");
    }

    return { projectId: project.id, projectName: project.name };
  }

  if (input.projectId === null) {
    return { projectId: null, projectName: input.projectName ?? null };
  }

  return { projectId: null, projectName: input.projectName ?? null };
}

function buildListWhere(params: ListLeadsParams) {
  const whereClauses = [eq(leads.orgId, SINGLE_TENANT_ORG_ID)];

  if (params.deletedOnly) {
    whereClauses.push(isNotNull(leads.deletedAt));
  } else {
    whereClauses.push(isNull(leads.deletedAt));
  }

  if (params.status) {
    whereClauses.push(eq(leads.leadStatus, params.status));
  }

  if (params.unassigned) {
    whereClauses.push(isNull(leads.assignedTo));
  } else if (params.assignedTo) {
    whereClauses.push(eq(leads.assignedTo, params.assignedTo));
  }

  if (params.activeOnly) {
    whereClauses.push(sql`${leads.leadStatus} not in ('lost', 'won')`);
  }

  if (params.projectId) {
    whereClauses.push(eq(leads.projectId, params.projectId));
  }

  if (params.temperature) {
    whereClauses.push(eq(leads.temperature, params.temperature));
  }

  if (params.adLeadsOnly) {
    whereClauses.push(adLeadsOnlyFilter());
  } else if (params.source) {
    const sourceVariants = expandLeadSourceFilter(params.source);
    whereClauses.push(
      sourceVariants.length === 1
        ? eq(leads.leadSource, sourceVariants[0]!)
        : inArray(leads.leadSource, sourceVariants),
    );
  }

  if (params.dateFrom) {
    whereClauses.push(gte(leads.createdAt, new Date(params.dateFrom)));
  }

  if (params.dateTo) {
    whereClauses.push(lte(leads.createdAt, new Date(params.dateTo)));
  }

  if (params.followUpDueBefore) {
    whereClauses.push(isNotNull(leads.nextFollowupAt));
    whereClauses.push(lte(leads.nextFollowupAt, new Date(params.followUpDueBefore)));
  }

  if (params.followUpDueAfter) {
    whereClauses.push(isNotNull(leads.nextFollowupAt));
    whereClauses.push(gt(leads.nextFollowupAt, new Date(params.followUpDueAfter)));
  }

  if (params.search?.trim()) {
    const term = `%${params.search.trim()}%`;
    whereClauses.push(
      or(
        ilike(leads.firstName, term),
        ilike(leads.lastName, term),
        ilike(leads.email, term),
        ilike(leads.phone, term),
      )!,
    );
  }

  return and(...whereClauses);
}

async function countLeadsWhere(params: ListLeadsParams) {
  const whereClause = buildListWhere(params);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(whereClause);
  return count ?? 0;
}

export const leadService = {
  async getStageCounts(baseParams: ListLeadsParams) {
    const now = new Date().toISOString();

    const [active, newLeads, pending, scheduled, overdue, eoi] = await Promise.all([
      countLeadsWhere({ ...baseParams, activeOnly: true }),
      countLeadsWhere({ ...baseParams, status: "new" }),
      countLeadsWhere({ ...baseParams, status: "contacted" }),
      countLeadsWhere({
        ...baseParams,
        followUpDueAfter: now,
        activeOnly: true,
      }),
      countLeadsWhere({
        ...baseParams,
        followUpDueBefore: now,
        activeOnly: true,
      }),
      countLeadsWhere({ ...baseParams, status: "qualified" }),
    ]);

    return {
      active,
      new: newLeads,
      pending,
      scheduled,
      overdue,
      eoi,
    };
  },

  async getScopeCounts(
    baseParams: ListLeadsParams,
    options?: { userId?: string; isAgent?: boolean },
  ) {
    const isAgent = options?.isAgent ?? false;
    const userId = options?.userId;
    const agentBook = isAgent && userId ? { assignedTo: userId } : {};

    const [all, my, teams, unassigned, deleted, duplicate, reEnquired] = await Promise.all([
      countLeadsWhere({ ...baseParams, ...agentBook }),
      userId ? countLeadsWhere({ ...baseParams, assignedTo: userId }) : Promise.resolve(0),
      countLeadsWhere({ ...baseParams, ...agentBook }),
      isAgent ? Promise.resolve(0) : countLeadsWhere({ ...baseParams, unassigned: true }),
      countLeadsWhere({
        ...baseParams,
        deletedOnly: true,
        ...(isAgent && userId ? { assignedTo: userId } : {}),
      }),
      countLeadsWhere({ ...baseParams, ...agentBook }),
      countLeadsWhere({ ...baseParams, ...agentBook }),
    ]);

    return {
      all,
      my,
      teams,
      unassigned,
      deleted,
      duplicate,
      "re-enquired": reEnquired,
    };
  },

  async listLeads(params: ListLeadsParams) {
    const { page = 1, pageSize = 20 } = params;

    const whereClause = buildListWhere(params);
    const offset = (page - 1) * pageSize;

    const [rows, [{ count }]] = await Promise.all([
      db
        .select()
        .from(leads)
        .leftJoin(users, eq(leads.assignedTo, users.id))
        .where(whereClause)
        .orderBy(params.orderByFollowUp ? asc(leads.nextFollowupAt) : desc(leads.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(leads).where(whereClause),
    ]);

    return {
      items: rows.map((row) => ({
        ...row.leads,
        assignedUser: row.users
          ? { id: row.users.id, name: row.users.name, email: row.users.email }
          : null,
      })),
      page,
      pageSize,
      total: Number(count),
    };
  },

  async createLead(input: CreateLeadInput, options?: { assignedTo?: string }) {
    const {
      firstName,
      lastName,
      email,
      phone,
      secondaryPhone,
      city,
      state,
      leadSource,
      leadStatus,
      temperature,
      notes,
      tags,
      nextFollowupAt,
      estimatedValue,
      projectName,
      projectId,
    } = input;

    const resolvedProject = await resolveProjectFields({ projectId, projectName });

    const existing = await db
      .select({ id: leads.id })
      .from(leads)
      .where(
        and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), eq(leads.phone, phone), isNull(leads.deletedAt)),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new LeadDuplicatePhoneError();
    }

    const [created] = await db
      .insert(leads)
      .values({
        orgId: SINGLE_TENANT_ORG_ID,
        assignedTo: options?.assignedTo ?? null,
        firstName,
        lastName: lastName ?? "",
        email: email ?? null,
        phone,
        secondaryPhone: secondaryPhone ?? null,
        city: city ?? null,
        state: state ?? null,
        leadSource: leadSource ?? null,
        leadStatus: leadStatus ?? "new",
        temperature: temperature ?? null,
        notes: notes ?? null,
        tags: tags ?? null,
        nextFollowupAt: nextFollowupAt ? new Date(nextFollowupAt) : null,
        estimatedValue: estimatedValue != null ? String(estimatedValue) : null,
        projectName: resolvedProject.projectName,
        projectId: resolvedProject.projectId,
      })
      .returning();

    return created!;
  },

  async getLeadById(leadId: string) {
    const [leadRow] = await db
      .select()
      .from(leads)
      .leftJoin(users, eq(leads.assignedTo, users.id))
      .where(
        and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), eq(leads.id, leadId), isNull(leads.deletedAt)),
      )
      .limit(1);

    if (!leadRow) {
      return null;
    }

    const lead = leadRow.leads;

    const activityRows = await db
      .select({
        activity: leadActivities,
        userName: users.name,
      })
      .from(leadActivities)
      .leftJoin(users, eq(leadActivities.userId, users.id))
      .where(and(eq(leadActivities.orgId, SINGLE_TENANT_ORG_ID), eq(leadActivities.leadId, leadId)))
      .orderBy(desc(leadActivities.createdAt))
      .limit(50);

    const [callAgg] = await db
      .select({
        totalCalls: sql<number>`count(*)::int`,
        completedCalls: sql<number>`count(*) filter (where ${callRecords.status} = 'completed')::int`,
        missedCalls: sql<number>`count(*) filter (where ${callRecords.status} = 'missed')::int`,
        firstCallAt: sql<Date | null>`min(${callRecords.startedAt})`,
      })
      .from(callRecords)
      .where(and(eq(callRecords.orgId, SINGLE_TENANT_ORG_ID), eq(callRecords.leadId, leadId)));

    const firstCallAt = callAgg?.firstCallAt ?? null;
    const daysToFirstCall =
      firstCallAt && lead.createdAt
        ? Math.max(
            0,
            Math.floor(
              (new Date(firstCallAt).getTime() - new Date(lead.createdAt).getTime()) / 86_400_000,
            ),
          )
        : undefined;

    return {
      ...lead,
      assignedUser: leadRow.users
        ? { id: leadRow.users.id, name: leadRow.users.name, email: leadRow.users.email }
        : null,
      activities: activityRows.map((row) => ({
        ...row.activity,
        userName: row.userName ?? null,
      })),
      leadSummary: {
        firstSeenAt: lead.createdAt,
        firstCallAt,
        totalCalls: callAgg?.totalCalls ?? 0,
        completedCalls: callAgg?.completedCalls ?? 0,
        missedCalls: callAgg?.missedCalls ?? 0,
        daysToFirstCall,
        currentStage: lead.leadStatus,
      },
    };
  },

  async updateLead(input: UpdateLeadInput) {
    const { leadId, payload, actingUserId } = input;

    const [existing] = await db
      .select()
      .from(leads)
      .where(
        and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), eq(leads.id, leadId), isNull(leads.deletedAt)),
      )
      .limit(1);

    if (!existing) {
      return null;
    }

    if (payload.phone && payload.phone !== existing.phone) {
      const duplicate = await db
        .select({ id: leads.id })
        .from(leads)
        .where(
          and(
            eq(leads.orgId, SINGLE_TENANT_ORG_ID),
            eq(leads.phone, payload.phone),
            isNull(leads.deletedAt),
            ne(leads.id, leadId),
          ),
        )
        .limit(1);

      if (duplicate.length > 0) {
        throw new LeadDuplicatePhoneError();
      }
    }

    const update: Record<string, unknown> = { updatedAt: new Date() };

    if (payload.firstName !== undefined) update.firstName = payload.firstName;
    if (payload.lastName !== undefined) update.lastName = payload.lastName;
    if (payload.email !== undefined) update.email = payload.email;
    if (payload.phone !== undefined) update.phone = payload.phone;
    if (payload.secondaryPhone !== undefined) update.secondaryPhone = payload.secondaryPhone;
    if (payload.city !== undefined) update.city = payload.city;
    if (payload.state !== undefined) update.state = payload.state;
    if (payload.leadSource !== undefined) update.leadSource = payload.leadSource;
    if (payload.leadStatus !== undefined) update.leadStatus = payload.leadStatus;
    if (payload.temperature !== undefined) update.temperature = payload.temperature;
    if (payload.notes !== undefined) update.notes = payload.notes;
    if (payload.tags !== undefined) update.tags = payload.tags;
    if (payload.nextFollowupAt !== undefined) {
      update.nextFollowupAt = new Date(payload.nextFollowupAt);
    }
    if (payload.estimatedValue !== undefined) {
      update.estimatedValue =
        payload.estimatedValue == null ? null : String(payload.estimatedValue);
    }
    if (payload.projectId !== undefined) {
      const resolvedProject = await resolveProjectFields({
        projectId: payload.projectId,
        projectName: payload.projectName,
      });
      update.projectName = resolvedProject.projectName;
      update.projectId = resolvedProject.projectId;
    } else if (payload.projectName !== undefined) {
      update.projectName = payload.projectName;
      update.projectId = null;
    }

    const [updated] = await db
      .update(leads)
      .set(update)
      .where(
        and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), eq(leads.id, leadId), isNull(leads.deletedAt)),
      )
      .returning();

    if (updated && payload.leadStatus !== undefined && payload.leadStatus !== existing.leadStatus) {
      await db.insert(leadActivities).values({
        orgId: SINGLE_TENANT_ORG_ID,
        leadId,
        userId: actingUserId,
        type: "status_change",
        metadata: { from: existing.leadStatus, to: payload.leadStatus },
      });
    }

    return updated ?? null;
  },

  async assignLead(input: AssignLeadInput) {
    const { leadId, userId, actingUserId } = input;

    const [assignee] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(eq(users.id, userId), eq(users.orgId, SINGLE_TENANT_ORG_ID), eq(users.isActive, true)),
      )
      .limit(1);

    if (!assignee) {
      return null;
    }

    const [updated] = await db
      .update(leads)
      .set({ assignedTo: userId, updatedAt: new Date() })
      .where(
        and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), eq(leads.id, leadId), isNull(leads.deletedAt)),
      )
      .returning();

    if (!updated) {
      return null;
    }

    await db.insert(leadActivities).values({
      orgId: SINGLE_TENANT_ORG_ID,
      leadId,
      userId: actingUserId,
      type: "status_change",
      metadata: {
        kind: "assignment",
        assignedTo: userId,
      },
    });

    return updated;
  },

  async addNote(input: { leadId: string; userId: string; text: string }) {
    const { leadId, userId, text } = input;

    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(
        and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), eq(leads.id, leadId), isNull(leads.deletedAt)),
      )
      .limit(1);

    if (!lead) {
      return null;
    }

    const [activity] = await db
      .insert(leadActivities)
      .values({
        orgId: SINGLE_TENANT_ORG_ID,
        leadId,
        userId,
        type: "note",
        metadata: { text },
      })
      .returning();

    return activity ?? null;
  },

  async softDeleteLead(leadId: string) {
    const [deleted] = await db
      .update(leads)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), eq(leads.id, leadId), isNull(leads.deletedAt)),
      )
      .returning();

    return deleted ?? null;
  },

  async getUpcomingFollowups(days: number, assignedTo?: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const rangeEnd = new Date(todayStart);
    rangeEnd.setDate(rangeEnd.getDate() + days);
    rangeEnd.setHours(23, 59, 59, 999);

    const filters = [
      eq(leads.orgId, SINGLE_TENANT_ORG_ID),
      isNull(leads.deletedAt),
      isNotNull(leads.nextFollowupAt),
      gte(leads.nextFollowupAt, todayStart),
      lte(leads.nextFollowupAt, rangeEnd),
    ];

    if (assignedTo) {
      filters.push(eq(leads.assignedTo, assignedTo));
    }

    const rows = await db
      .select({
        id: leads.id,
        firstName: leads.firstName,
        lastName: leads.lastName,
        leadStatus: leads.leadStatus,
        nextFollowupAt: leads.nextFollowupAt,
        tags: leads.tags,
        customFields: leads.customFields,
      })
      .from(leads)
      .where(and(...filters))
      .orderBy(asc(leads.nextFollowupAt));

    return rows.map((row) => ({
      id: row.id,
      leadName: `${row.firstName} ${row.lastName}`.trim(),
      nextFollowupAt: row.nextFollowupAt!.toISOString(),
      type: inferFollowupType({ tags: row.tags, customFields: row.customFields }),
      status: row.leadStatus,
    }));
  },

  async getRecentActivities(limit = 10) {
    const rows = await db
      .select({
        activity: leadActivities,
        userName: users.name,
        leadFirstName: leads.firstName,
        leadLastName: leads.lastName,
        leadId: leads.id,
      })
      .from(leadActivities)
      .innerJoin(leads, eq(leadActivities.leadId, leads.id))
      .leftJoin(users, eq(leadActivities.userId, users.id))
      .where(eq(leadActivities.orgId, SINGLE_TENANT_ORG_ID))
      .orderBy(desc(leadActivities.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.activity.id,
      type: row.activity.type,
      metadata: row.activity.metadata,
      createdAt: row.activity.createdAt,
      userName: row.userName ?? null,
      leadId: row.leadId,
      leadName: `${row.leadFirstName} ${row.leadLastName}`.trim(),
    }));
  },
};
