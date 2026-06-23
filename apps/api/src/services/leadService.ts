import { callRecords, leadActivities, leads, projects, users } from "@propninja/db";
import { getIstDayBounds } from "@propninja/types/ist";
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
  lt,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { adLeadsOnlyFilter } from "../lib/adLeadFilters.js";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { notFound } from "../lib/errors.js";
import { coldCutoffDate, daysOverdue, daysSinceContact } from "../lib/followUp.js";
import { inferFollowupType } from "../lib/followupType.js";
import { normalizeStoredPhone, phoneMatchVariants } from "../lib/leadPhone.js";
import { expandLeadSourceFilter } from "../lib/leadSourceAliases.js";
import { type CreateLeadBody, createLeadBodySchema } from "../lib/validators/leads.js";
import { recordLeadAssignment } from "./leadAssignmentService.js";

type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "negotiation"
  | "won"
  | "lost"
  | "not_interested"
  | "dropped";

const NA_STATUSES: LeadStatus[] = ["not_interested", "dropped"];
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
  teamLeadsExcludingUser?: string;
  duplicatesOnly?: boolean;
  excludeDuplicates?: boolean;
  reEnquiredOnly?: boolean;
  naLeadsOnly?: boolean;
  activeOnly?: boolean;
  deletedOnly?: boolean;
  adLeadsOnly?: boolean;
  /** Return leads whose tags share at least one value with this list. */
  tags?: string[];
}

/** Last 10 digits — treats +91… and local 10-digit numbers as the same phone. */
const leadPhoneKeySql = sql`RIGHT(regexp_replace(COALESCE(${leads.phone}, ''), '[^0-9]', '', 'g'), 10)`;

function leadHasValidPhoneKey() {
  return sql`LENGTH(${leadPhoneKeySql}) >= 10`;
}

/** Another lead in the org shares this phone key (same deleted/active bucket). */
function duplicatePhoneExistsSql(deletedOnly: boolean) {
  const peerDeletedClause = deletedOnly
    ? sql`l2.deleted_at IS NOT NULL`
    : sql`l2.deleted_at IS NULL`;

  return sql`EXISTS (
    SELECT 1 FROM leads l2
    WHERE l2.org_id = ${leads.orgId}
      AND l2.id <> ${leads.id}
      AND ${peerDeletedClause}
      AND LENGTH(RIGHT(regexp_replace(COALESCE(l2.phone, ''), '[^0-9]', '', 'g'), 10)) >= 10
      AND RIGHT(regexp_replace(COALESCE(l2.phone, ''), '[^0-9]', '', 'g'), 10) = ${leadPhoneKeySql}
  )`;
}

/** Keep the oldest lead per phone key; hide newer copies from default lists. */
function canonicalLeadOnlySql(deletedOnly: boolean) {
  const peerDeletedClause = deletedOnly
    ? sql`l2.deleted_at IS NOT NULL`
    : sql`l2.deleted_at IS NULL`;

  return sql`NOT EXISTS (
    SELECT 1 FROM leads l2
    WHERE l2.org_id = ${leads.orgId}
      AND l2.id <> ${leads.id}
      AND ${peerDeletedClause}
      AND LENGTH(RIGHT(regexp_replace(COALESCE(l2.phone, ''), '[^0-9]', '', 'g'), 10)) >= 10
      AND RIGHT(regexp_replace(COALESCE(l2.phone, ''), '[^0-9]', '', 'g'), 10) = ${leadPhoneKeySql}
      AND (
        l2.created_at < ${leads.createdAt}
        OR (l2.created_at = ${leads.createdAt} AND l2.id::text < ${leads.id}::text)
      )
  )`;
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
    assignedTo: string;
    reason: string;
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

async function findLeadByPhone(phone: string) {
  const variants = phoneMatchVariants(phone);
  if (variants.length === 0) {
    return null;
  }

  const [row] = await db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.orgId, SINGLE_TENANT_ORG_ID),
        isNull(leads.deletedAt),
        or(...variants.map((variant) => eq(leads.phone, variant)))!,
      ),
    )
    .orderBy(asc(leads.createdAt), asc(leads.id))
    .limit(1);

  return row ?? null;
}

/** Lead returned after prior engagement: reopened from won/lost, repeat ad inquiry, or bulk import re-entry. */
function reEnquiredLeadSql() {
  return sql`(
    EXISTS (
      SELECT 1 FROM ${leadActivities} la
      WHERE la.lead_id = ${leads.id}
        AND la.org_id = ${leads.orgId}
        AND (
          (
            la.type = 'status_change'
            AND la.metadata->>'from' IN ('lost', 'won')
            AND la.metadata->>'to' IN ('new', 'contacted', 'qualified', 'negotiation')
          )
          OR la.metadata->>'kind' = 're_enquiry'
        )
    )
    OR (
      SELECT COUNT(*)::int FROM ${leadActivities} la2
      WHERE la2.lead_id = ${leads.id}
        AND la2.org_id = ${leads.orgId}
        AND la2.metadata->>'kind' = 'ad_lead'
    ) >= 2
    OR EXISTS (
      SELECT 1 FROM ${leadActivities} la3
      WHERE la3.lead_id = ${leads.id}
        AND la3.org_id = ${leads.orgId}
        AND la3.metadata->>'kind' = 'ad_lead'
        AND la3.created_at > ${leads.createdAt} + interval '1 day'
    )
  )`;
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
  } else if (params.teamLeadsExcludingUser) {
    whereClauses.push(isNotNull(leads.assignedTo));
    whereClauses.push(ne(leads.assignedTo, params.teamLeadsExcludingUser));
  } else if (params.assignedTo) {
    whereClauses.push(eq(leads.assignedTo, params.assignedTo));
  }

  if (params.naLeadsOnly) {
    whereClauses.push(inArray(leads.leadStatus, NA_STATUSES));
  }

  if (params.activeOnly) {
    whereClauses.push(sql`${leads.leadStatus} not in ('lost', 'won', 'not_interested', 'dropped')`);
  }

  if (params.projectId) {
    whereClauses.push(eq(leads.projectId, params.projectId));
  }

  if (params.temperature) {
    whereClauses.push(eq(leads.temperature, params.temperature));
  }

  if (params.tags?.length) {
    whereClauses.push(
      or(...params.tags.map((tag) => sql`${tag} = ANY(COALESCE(${leads.tags}, ARRAY[]::text[]))`))!,
    );
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

  const deletedBucket = Boolean(params.deletedOnly);
  if (params.duplicatesOnly) {
    whereClauses.push(leadHasValidPhoneKey());
    whereClauses.push(duplicatePhoneExistsSql(deletedBucket));
  } else if (params.excludeDuplicates) {
    whereClauses.push(
      or(sql`NOT (${leadHasValidPhoneKey()})`, canonicalLeadOnlySql(deletedBucket))!,
    );
  }

  if (params.reEnquiredOnly) {
    whereClauses.push(reEnquiredLeadSql());
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
    const deduped = {
      ...baseParams,
      excludeDuplicates: baseParams.duplicatesOnly ? false : (baseParams.excludeDuplicates ?? true),
    };

    const [active, newLeads, pending, scheduled, overdue, eoi] = await Promise.all([
      countLeadsWhere({ ...deduped, activeOnly: true }),
      countLeadsWhere({ ...deduped, status: "new" }),
      countLeadsWhere({ ...deduped, status: "contacted" }),
      countLeadsWhere({
        ...deduped,
        followUpDueAfter: now,
        activeOnly: true,
      }),
      countLeadsWhere({
        ...deduped,
        followUpDueBefore: now,
        activeOnly: true,
      }),
      countLeadsWhere({ ...deduped, status: "qualified" }),
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

    const deduped = { excludeDuplicates: true as const };

    const [all, my, teams, unassigned, deleted, duplicate, reEnquired, naLeads] = await Promise.all(
      [
        countLeadsWhere({ ...baseParams, ...agentBook, ...deduped }),
        userId
          ? countLeadsWhere({ ...baseParams, assignedTo: userId, ...deduped })
          : Promise.resolve(0),
        userId && !isAgent
          ? countLeadsWhere({ ...baseParams, teamLeadsExcludingUser: userId, ...deduped })
          : Promise.resolve(0),
        isAgent
          ? Promise.resolve(0)
          : countLeadsWhere({ ...baseParams, unassigned: true, ...deduped }),
        countLeadsWhere({
          ...baseParams,
          deletedOnly: true,
          excludeDuplicates: true,
          ...(isAgent && userId ? { assignedTo: userId } : {}),
        }),
        countLeadsWhere({ ...baseParams, ...agentBook, duplicatesOnly: true }),
        countLeadsWhere({ ...baseParams, ...agentBook, reEnquiredOnly: true, ...deduped }),
        isAgent
          ? Promise.resolve(0)
          : countLeadsWhere({ ...baseParams, naLeadsOnly: true, ...deduped }),
      ],
    );

    return {
      all,
      my,
      teams,
      unassigned,
      deleted,
      duplicate,
      "re-enquired": reEnquired,
      naleads: naLeads,
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
    const storedPhone = normalizeStoredPhone(phone);

    const existing = await findLeadByPhone(storedPhone);
    if (existing) {
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
        phone: storedPhone,
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

  async bulkCreateLeads(input: {
    rows: Record<string, unknown>[];
    skipDuplicates: boolean;
    assignedToAgents: string[];
    actingUserId: string;
    batchId?: string;
  }) {
    const created: { row: number; id: string; phone: string }[] = [];
    const updated: { row: number; id: string; phone: string }[] = [];
    const skipped: { row: number; phone: string; reason: string }[] = [];
    const failed: { row: number; message: string }[] = [];
    const batchItems: {
      rowNumber: number;
      outcome: "created" | "updated" | "skipped" | "failed";
      leadId?: string | null;
      phone?: string | null;
      message?: string | null;
    }[] = [];

    for (let index = 0; index < input.rows.length; index++) {
      const rowNumber = index + 1;
      const parsed = createLeadBodySchema.safeParse(input.rows[index]);

      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        const message = firstIssue?.message ?? "Invalid row";
        failed.push({
          row: rowNumber,
          message,
        });
        const rawPhone = input.rows[index]?.phone;
        batchItems.push({
          rowNumber,
          outcome: "failed",
          phone: typeof rawPhone === "string" ? rawPhone : null,
          message,
        });
        continue;
      }

      const storedPhone = normalizeStoredPhone(parsed.data.phone);
      const existing = await findLeadByPhone(storedPhone);

      const assignedTo = input.assignedToAgents[index % input.assignedToAgents.length]!;

      if (existing) {
        if (input.skipDuplicates) {
          const merged = await this.mergeImportRow({
            leadId: existing.id,
            data: parsed.data,
            storedPhone,
            assignedTo,
            actingUserId: input.actingUserId,
          });

          if (merged) {
            updated.push({ row: rowNumber, id: merged.id, phone: merged.phone ?? storedPhone });
            batchItems.push({
              rowNumber,
              outcome: "updated",
              leadId: merged.id,
              phone: merged.phone ?? storedPhone,
            });
          } else {
            skipped.push({
              row: rowNumber,
              phone: parsed.data.phone,
              reason: "duplicate_phone",
            });
            batchItems.push({
              rowNumber,
              outcome: "skipped",
              phone: parsed.data.phone,
              message: "duplicate_phone",
            });
          }
        } else {
          const message = "Phone number already exists for this org";
          failed.push({ row: rowNumber, message });
          batchItems.push({
            rowNumber,
            outcome: "failed",
            phone: parsed.data.phone,
            message,
          });
        }
        continue;
      }

      try {
        const lead = await this.createLead(parsed.data, { assignedTo });
        created.push({ row: rowNumber, id: lead.id, phone: lead.phone ?? "" });
        batchItems.push({
          rowNumber,
          outcome: "created",
          leadId: lead.id,
          phone: lead.phone ?? storedPhone,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Import failed";
        failed.push({
          row: rowNumber,
          message,
        });
        batchItems.push({
          rowNumber,
          outcome: "failed",
          phone: parsed.data.phone,
          message,
        });
      }
    }

    if (input.batchId && batchItems.length > 0) {
      const { leadImportService } = await import("./leadImportService.js");
      await leadImportService.insertBatchItems(input.batchId, batchItems);
    }

    return {
      createdCount: created.length,
      updatedCount: updated.length,
      skippedCount: skipped.length,
      failedCount: failed.length,
      created,
      updated,
      skipped,
      failed,
    };
  },

  async mergeImportRow(input: {
    leadId: string;
    data: CreateLeadInput;
    storedPhone: string;
    assignedTo?: string;
    actingUserId: string;
  }) {
    const [existing] = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.orgId, SINGLE_TENANT_ORG_ID),
          eq(leads.id, input.leadId),
          isNull(leads.deletedAt),
        ),
      )
      .limit(1);

    if (!existing) {
      return null;
    }

    const resolvedProject = await resolveProjectFields({
      projectId: input.data.projectId,
      projectName: input.data.projectName,
    });

    const update: Record<string, unknown> = {
      updatedAt: new Date(),
      firstName: input.data.firstName,
      lastName: input.data.lastName ?? "",
      phone: input.storedPhone,
    };

    if (input.data.email !== undefined) update.email = input.data.email ?? null;
    if (input.data.city !== undefined) update.city = input.data.city ?? null;
    if (input.data.state !== undefined) update.state = input.data.state ?? null;
    if (input.data.leadSource !== undefined) update.leadSource = input.data.leadSource ?? null;
    if (input.data.temperature !== undefined) update.temperature = input.data.temperature ?? null;
    if (input.data.notes !== undefined) update.notes = input.data.notes ?? null;
    if (input.data.tags !== undefined) update.tags = input.data.tags ?? null;
    if (input.data.leadStatus !== undefined) {
      update.leadStatus = input.data.leadStatus;
    } else if (existing.leadStatus === "lost" || existing.leadStatus === "won") {
      update.leadStatus = "new";
    }

    if (input.data.projectId !== undefined || input.data.projectName !== undefined) {
      update.projectName = resolvedProject.projectName;
      update.projectId = resolvedProject.projectId;
    }

    const previousAssignee = existing.assignedTo;
    if (input.assignedTo) {
      update.assignedTo = input.assignedTo;
    }

    const [merged] = await db
      .update(leads)
      .set(update)
      .where(
        and(
          eq(leads.orgId, SINGLE_TENANT_ORG_ID),
          eq(leads.id, input.leadId),
          isNull(leads.deletedAt),
        ),
      )
      .returning();

    if (!merged) {
      return null;
    }

    if (input.assignedTo && input.assignedTo !== previousAssignee) {
      await db.insert(leadActivities).values({
        orgId: SINGLE_TENANT_ORG_ID,
        leadId: input.leadId,
        userId: input.actingUserId,
        type: "status_change",
        metadata: {
          kind: "assignment",
          assignedTo: input.assignedTo,
          source: "bulk_import",
        },
      });
    }

    const reopenedFromTerminal =
      (existing.leadStatus === "lost" || existing.leadStatus === "won") &&
      merged.leadStatus !== existing.leadStatus &&
      merged.leadStatus !== "lost" &&
      merged.leadStatus !== "won";

    if (reopenedFromTerminal) {
      await db.insert(leadActivities).values({
        orgId: SINGLE_TENANT_ORG_ID,
        leadId: input.leadId,
        userId: input.actingUserId,
        type: "status_change",
        metadata: {
          kind: "re_enquiry",
          from: existing.leadStatus,
          to: merged.leadStatus,
          source: "bulk_import",
        },
      });
    }

    return merged;
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
    if (payload.assignedTo !== undefined) {
      update.assignedTo = payload.assignedTo;
    }

    // Auto-unassign when status changes to not_interested or dropped
    const becomingNaLead =
      payload.leadStatus !== undefined &&
      payload.leadStatus !== existing.leadStatus &&
      (NA_STATUSES as string[]).includes(payload.leadStatus) &&
      payload.assignedTo === undefined;
    if (becomingNaLead) {
      update.assignedTo = null;
    }

    const assignmentChanged =
      payload.assignedTo !== undefined
        ? payload.assignedTo !== existing.assignedTo
        : becomingNaLead && existing.assignedTo !== null;

    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(leads)
        .set(update)
        .where(
          and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), eq(leads.id, leadId), isNull(leads.deletedAt)),
        )
        .returning();

      if (row && assignmentChanged && payload.assignedTo) {
        await recordLeadAssignment(tx, {
          leadId,
          fromAgentId: existing.assignedTo,
          toAgentId: payload.assignedTo,
          assignedBy: actingUserId,
          reason: payload.reason,
        });
      }

      return [row];
    });

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

    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(leads)
        .set({ assignedTo: userId, updatedAt: new Date() })
        .where(
          and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), eq(leads.id, leadId), isNull(leads.deletedAt)),
        )
        .returning();

      if (row) {
        await recordLeadAssignment(tx, {
          leadId,
          fromAgentId: existing.assignedTo,
          toAgentId: userId,
          assignedBy: actingUserId,
        });
      }

      return [row];
    });

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
    const { start: todayStart } = getIstDayBounds(0);
    const horizonEnd = getIstDayBounds(days).end;

    const filters = [
      eq(leads.orgId, SINGLE_TENANT_ORG_ID),
      isNull(leads.deletedAt),
      isNotNull(leads.nextFollowupAt),
      gte(leads.nextFollowupAt, todayStart),
      lte(leads.nextFollowupAt, horizonEnd),
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

  async getRecentActivities(limit = 10, options?: { assignedTo?: string }) {
    const filters = [eq(leadActivities.orgId, SINGLE_TENANT_ORG_ID)];
    if (options?.assignedTo) {
      filters.push(eq(leads.assignedTo, options.assignedTo));
    }

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
      .where(and(...filters))
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

  async listOverdueLeads(assignedTo?: string) {
    const now = new Date();
    const filters = [
      eq(leads.orgId, SINGLE_TENANT_ORG_ID),
      isNull(leads.deletedAt),
      isNotNull(leads.nextFollowupAt),
      lt(leads.nextFollowupAt, now),
    ];
    if (assignedTo) {
      filters.push(eq(leads.assignedTo, assignedTo));
    }

    const rows = await db
      .select({
        lead: leads,
        userName: users.name,
        userId: users.id,
        userEmail: users.email,
      })
      .from(leads)
      .leftJoin(users, eq(leads.assignedTo, users.id))
      .where(and(...filters))
      .orderBy(asc(leads.nextFollowupAt))
      .limit(100);

    return rows.map(({ lead, userName, userId, userEmail }) => ({
      ...lead,
      assignedUser: userId ? { id: userId, name: userName ?? "", email: userEmail ?? "" } : null,
      daysOverdue: daysOverdue(lead.nextFollowupAt!.toISOString(), now),
      daysSinceContact: daysSinceContact(lead.lastContactedAt, lead.createdAt, now),
      followUpCount: lead.followUpCount ?? 0,
    }));
  },

  async listColdLeads(assignedTo?: string) {
    const cutoff = coldCutoffDate();
    const filters = [
      eq(leads.orgId, SINGLE_TENANT_ORG_ID),
      isNull(leads.deletedAt),
      sql`${leads.leadStatus} not in ('won', 'lost')`,
      lte(sql`COALESCE(${leads.lastContactedAt}, ${leads.createdAt})`, cutoff),
    ];
    if (assignedTo) {
      filters.push(eq(leads.assignedTo, assignedTo));
    }

    const now = new Date();
    const rows = await db
      .select({
        lead: leads,
        userName: users.name,
        userId: users.id,
        userEmail: users.email,
      })
      .from(leads)
      .leftJoin(users, eq(leads.assignedTo, users.id))
      .where(and(...filters))
      .orderBy(asc(sql`COALESCE(${leads.lastContactedAt}, ${leads.createdAt})`))
      .limit(100);

    return rows.map(({ lead, userName, userId, userEmail }) => ({
      ...lead,
      assignedUser: userId ? { id: userId, name: userName ?? "", email: userEmail ?? "" } : null,
      daysSinceContact: daysSinceContact(lead.lastContactedAt, lead.createdAt, now),
      daysOverdue: lead.nextFollowupAt ? daysOverdue(lead.nextFollowupAt.toISOString(), now) : 0,
      followUpCount: lead.followUpCount ?? 0,
    }));
  },

  async markColdLeads(now = new Date()) {
    const cutoff = coldCutoffDate(now);

    const coldFilter = and(
      eq(leads.orgId, SINGLE_TENANT_ORG_ID),
      isNull(leads.deletedAt),
      sql`${leads.leadStatus} not in ('won', 'lost')`,
      lte(sql`COALESCE(${leads.lastContactedAt}, ${leads.createdAt})`, cutoff),
    );

    const [totalRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(coldFilter);

    const markedRows = await db
      .update(leads)
      .set({ coldSince: now, updatedAt: now })
      .where(and(coldFilter, isNull(leads.coldSince)))
      .returning({ id: leads.id });

    return { marked: markedRows.length, totalCold: totalRow?.count ?? 0 };
  },

  async updateFollowUp(input: {
    leadId: string;
    actingUserId: string;
    nextFollowupAt: string;
    markComplete?: boolean;
  }) {
    const [existing] = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.orgId, SINGLE_TENANT_ORG_ID),
          eq(leads.id, input.leadId),
          isNull(leads.deletedAt),
        ),
      )
      .limit(1);

    if (!existing) {
      return null;
    }

    const nextFollowupAt = new Date(input.nextFollowupAt);
    const update: Record<string, unknown> = {
      nextFollowupAt,
      updatedAt: new Date(),
    };

    if (input.markComplete) {
      update.followUpCount = (existing.followUpCount ?? 0) + 1;
    }

    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(leads)
        .set(update)
        .where(eq(leads.id, input.leadId))
        .returning();

      if (row && input.markComplete) {
        await tx.insert(leadActivities).values({
          orgId: SINGLE_TENANT_ORG_ID,
          leadId: input.leadId,
          userId: input.actingUserId,
          type: "follow_up",
          metadata: {
            nextFollowupAt: nextFollowupAt.toISOString(),
            completedAt: new Date().toISOString(),
          },
        });
      }

      return [row];
    });

    return updated ?? null;
  },

  async getAgentDigestCounts(agentId: string, now = new Date()) {
    const { start, end } = getIstDayBounds(0, now);
    const cutoff = coldCutoffDate(now);

    const agentFilter = eq(leads.assignedTo, agentId);
    const base = and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), isNull(leads.deletedAt), agentFilter);

    const [[followUpsDueToday], [overdueFollowUps], [coldLeads]] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(
          and(
            base,
            isNotNull(leads.nextFollowupAt),
            gte(leads.nextFollowupAt, start),
            lte(leads.nextFollowupAt, end),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(and(base, isNotNull(leads.nextFollowupAt), lt(leads.nextFollowupAt, now))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(
          and(
            base,
            sql`${leads.leadStatus} not in ('won', 'lost')`,
            lte(sql`COALESCE(${leads.lastContactedAt}, ${leads.createdAt})`, cutoff),
          ),
        ),
    ]);

    return {
      followUpsDueToday: followUpsDueToday?.count ?? 0,
      overdueFollowUps: overdueFollowUps?.count ?? 0,
      coldLeads: coldLeads?.count ?? 0,
    };
  },
};
