import {
  callRecords,
  facebookLeads,
  leadActivities,
  leadImportBatchItems,
  leads,
  projects,
  users,
} from "@propninja/db";
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
import {
  freshNewLeadWhere,
  newLeadFreshnessCutoff,
  pendingLeadWhere,
} from "../lib/ageOutNewLeads.js";
import { applyAdvancedLeadFilters } from "../lib/applyAdvancedLeadFilters.js";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { toCsv } from "../lib/csv.js";
import { db } from "../lib/db.js";
import { notFound } from "../lib/errors.js";
import { coldCutoffDate, daysOverdue, daysSinceContact } from "../lib/followUp.js";
import { inferFollowupType } from "../lib/followupType.js";
import type { LeadAdvancedListQuery } from "../lib/leadAdvancedListQuery.js";
import { normalizeStoredPhone, phoneMatchVariants } from "../lib/leadPhone.js";
import { canonicalizeLeadSource, expandLeadSourceFilter } from "../lib/leadSourceAliases.js";
import { logger } from "../lib/logger.js";
import { promoteNewLeadToContacted } from "../lib/promoteNewLead.js";
import { sqlTimestamptz } from "../lib/sqlTimestamp.js";
import { type CreateLeadBody, createLeadBodySchema } from "../lib/validators/leads.js";
import { recordLeadAssignment } from "./leadAssignmentService.js";
import { recordReEnquiryActivity } from "./leadReEnquiry.js";
import { recalculateLeadScore } from "./leadScoringService.js";

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

/** Status changes that should clear any scheduled follow-up. */
const FOLLOW_UP_CLEARING_STATUSES: LeadStatus[] = ["won", "lost", "not_interested", "dropped"];
type Temperature = "cold" | "warm" | "hot";

export type ListLeadsParams = {
  status?: LeadStatus;
  search?: string;
  page?: number;
  pageSize?: number;
  assignedTo?: string;
  projectId?: string;
  importBatchId?: string;
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
  /** Active Leads stage: open pipeline excluding untouched `new` leads. */
  excludeNew?: boolean;
  deletedOnly?: boolean;
  adLeadsOnly?: boolean;
  /** Return leads whose tags share at least one value with this list. */
  tags?: string[];
} & Partial<LeadAdvancedListQuery>;

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
    nextFollowupAt: string | null;
    estimatedValue: number | null;
    projectName: string;
    projectId: string | null;
    assignedTo: string | null;
    reason: string;
    closeReason: string;
    closeReasonNote: string;
  }>;
}

export interface AssignLeadInput {
  leadId: string;
  userId: string;
  actingUserId: string;
  /**
   * When false, skip recording assignment history (lead assignment row + assignment
   * timeline entry) but still update `assignedTo`.
   */
  assignWithHistory?: boolean;
  /**
   * When true, and the lead is currently in NA status (not_interested/dropped),
   * move it back to active status ("new").
   */
  applyNewStatus?: boolean;
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

  if (params.status === "new") {
    // New bucket = fresh untouched leads only (≤24h). Stale `new` rows are aged to Pending.
    whereClauses.push(freshNewLeadWhere()!);
  } else if (params.status === "contacted") {
    // Pending bucket = contacted + any stale new not yet moved by the age-out job.
    whereClauses.push(pendingLeadWhere()!);
  } else if (params.status) {
    whereClauses.push(eq(leads.leadStatus, params.status));
  }

  if (params.assignedTo && !params.assignWithHistory) {
    whereClauses.push(eq(leads.assignedTo, params.assignedTo));
  } else if (params.unassigned) {
    // Pipeline unassigned only — NA pool lives under naLeadsOnly (often also unassigned).
    whereClauses.push(isNull(leads.assignedTo));
    if (!params.naLeadsOnly) {
      whereClauses.push(sql`${leads.leadStatus} not in ('not_interested', 'dropped')`);
    }
  } else if (params.teamLeadsExcludingUser) {
    whereClauses.push(isNotNull(leads.assignedTo));
    whereClauses.push(ne(leads.assignedTo, params.teamLeadsExcludingUser));
  }

  if (params.naLeadsOnly) {
    whereClauses.push(inArray(leads.leadStatus, NA_STATUSES));
  }

  if (params.activeOnly) {
    whereClauses.push(sql`${leads.leadStatus} not in ('lost', 'won', 'not_interested', 'dropped')`);
  }

  if (params.excludeNew) {
    whereClauses.push(ne(leads.leadStatus, "new"));
  }

  if (params.projectId) {
    whereClauses.push(eq(leads.projectId, params.projectId));
  }

  if (params.importBatchId) {
    whereClauses.push(
      sql`EXISTS (
        SELECT 1 FROM ${leadImportBatchItems} libi
        WHERE libi.lead_id = ${leads.id}
          AND libi.batch_id = ${params.importBatchId}
          AND libi.outcome IN ('created', 'updated')
      )`,
    );
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
    const lowerVariants = [...new Set(sourceVariants.map((v) => v.toLowerCase()))];
    whereClauses.push(
      sql`lower(${leads.leadSource}) in (${sql.join(
        lowerVariants.map((v) => sql`${v}`),
        sql`, `,
      )})`,
    );
  }

  if (params.dateFrom) {
    whereClauses.push(sql`${leads.createdAt} >= ${sqlTimestamptz(params.dateFrom)}`);
  }

  if (params.dateTo) {
    whereClauses.push(sql`${leads.createdAt} <= ${sqlTimestamptz(params.dateTo)}`);
  }

  if (params.followUpDueBefore) {
    whereClauses.push(isNotNull(leads.nextFollowupAt));
    whereClauses.push(sql`${leads.nextFollowupAt} <= ${sqlTimestamptz(params.followUpDueBefore)}`);
    // Untouched New leads keep auto/task follow-ups off the Overdue chip.
    whereClauses.push(sql`${leads.leadStatus} <> 'new'`);
  }

  if (params.followUpDueAfter) {
    whereClauses.push(isNotNull(leads.nextFollowupAt));
    whereClauses.push(sql`${leads.nextFollowupAt} > ${sqlTimestamptz(params.followUpDueAfter)}`);
    whereClauses.push(sql`${leads.leadStatus} <> 'new'`);
  }

  if (params.search?.trim()) {
    const trimmed = params.search.trim();
    const term = `%${trimmed}%`;
    const phoneTerms = new Set<string>([term]);
    for (const variant of phoneMatchVariants(trimmed)) {
      phoneTerms.add(`%${variant}%`);
    }

    const phoneClauses = [...phoneTerms].map((phoneTerm) => ilike(leads.phone, phoneTerm));
    whereClauses.push(
      or(
        ilike(leads.firstName, term),
        ilike(leads.lastName, term),
        ilike(leads.email, term),
        ...phoneClauses,
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

  applyAdvancedLeadFilters(params, whereClauses);

  return and(...whereClauses);
}

const EMPTY_STAGE_COUNTS = {
  active: 0,
  new: 0,
  pending: 0,
  scheduled: 0,
  overdue: 0,
  eoi: 0,
};

const EMPTY_SCOPE_COUNTS = {
  all: 0,
  my: 0,
  teams: 0,
  unassigned: 0,
  deleted: 0,
  duplicate: 0,
  "re-enquired": 0,
  naleads: 0,
};

function asCount(value: number | null | undefined): number {
  return value ?? 0;
}

/** Shared list filters without assignment / stage / duplicate-bucket flags. */
function stripBucketOverrides(params: ListLeadsParams): ListLeadsParams {
  return {
    ...params,
    assignedTo: undefined,
    unassigned: undefined,
    teamLeadsExcludingUser: undefined,
    duplicatesOnly: undefined,
    excludeDuplicates: undefined,
    reEnquiredOnly: undefined,
    naLeadsOnly: undefined,
    status: undefined,
    activeOnly: undefined,
    excludeNew: undefined,
    followUpDueBefore: undefined,
    followUpDueAfter: undefined,
    deletedOnly: false,
  };
}

function activePipelineLeadSql() {
  return sql`${leads.leadStatus} not in ('lost', 'won', 'not_interested', 'dropped')`;
}

/** Worked open leads — Active Leads chip (excludes untouched New). */
function activeWorkedLeadSql() {
  return sql`${leads.leadStatus} not in ('new', 'lost', 'won', 'not_interested', 'dropped')`;
}

export const leadService = {
  async getStageCounts(baseParams: ListLeadsParams) {
    const sharedBase: ListLeadsParams = {
      ...baseParams,
      // Badge counts skip phone-dedupe EXISTS — list queries still dedupe.
      excludeDuplicates: false,
      status: undefined,
      activeOnly: undefined,
      excludeNew: undefined,
      followUpDueBefore: undefined,
      followUpDueAfter: undefined,
      deletedOnly: false,
    };

    const whereClause = buildListWhere(sharedBase);
    const now = new Date();
    const nowIso = now.toISOString();
    const freshCutoff = newLeadFreshnessCutoff(now);

    try {
      const [row] = await db
        .select({
          active: sql<number>`count(*) filter (where ${
            baseParams.unassigned ? activePipelineLeadSql() : activeWorkedLeadSql()
          })::int`,
          new: sql<number>`count(*) filter (
            where ${leads.leadStatus} = 'new'
              and ${leads.createdAt} >= ${sqlTimestamptz(freshCutoff)}
          )::int`,
          pending: sql<number>`count(*) filter (
            where ${leads.nextFollowupAt} is null
              and (
                ${leads.leadStatus} = 'contacted'
                or (
                  ${leads.leadStatus} = 'new'
                  and ${leads.createdAt} < ${sqlTimestamptz(freshCutoff)}
                )
              )
          )::int`,
          scheduled: sql<number>`count(*) filter (
            where ${activePipelineLeadSql()}
              and ${leads.leadStatus} <> 'new'
              and ${leads.nextFollowupAt} is not null
              and ${leads.nextFollowupAt} > ${nowIso}::timestamptz
          )::int`,
          overdue: sql<number>`count(*) filter (
            where ${activePipelineLeadSql()}
              and ${leads.leadStatus} <> 'new'
              and ${leads.nextFollowupAt} is not null
              and ${leads.nextFollowupAt} <= ${nowIso}::timestamptz
          )::int`,
          eoi: sql<number>`count(*) filter (where ${leads.leadStatus} = 'qualified')::int`,
        })
        .from(leads)
        .where(whereClause);

      return {
        active: asCount(row?.active),
        new: asCount(row?.new),
        pending: asCount(row?.pending),
        scheduled: asCount(row?.scheduled),
        overdue: asCount(row?.overdue),
        eoi: asCount(row?.eoi),
      };
    } catch (err) {
      logger.error("Lead stage count query failed", {
        message: err instanceof Error ? err.message : String(err),
      });
      return { ...EMPTY_STAGE_COUNTS };
    }
  },

  async getTabCounts(
    scopeParams: ListLeadsParams,
    stageParams: ListLeadsParams,
    options?: { userId?: string; isAgent?: boolean; isAdmin?: boolean },
  ) {
    const [rawScope, stage] = await Promise.all([
      this.getScopeCounts(scopeParams, options),
      this.getStageCounts(stageParams),
    ]);
    const scope = options?.isAdmin ? rawScope : { ...rawScope, naleads: undefined };
    return { scope, stage };
  },

  async getScopeCounts(
    baseParams: ListLeadsParams,
    options?: { userId?: string; isAgent?: boolean },
  ) {
    const isAgent = options?.isAgent ?? false;
    const userId = options?.userId;
    const agentBookSql = isAgent && userId ? sql`${leads.assignedTo} = ${userId}` : sql`true`;
    const mySql = userId ? sql`${leads.assignedTo} = ${userId}` : sql`false`;
    const teamsSql =
      userId && !isAgent
        ? sql`${leads.assignedTo} is not null and ${leads.assignedTo} <> ${userId}`
        : sql`false`;
    const unassignedSql = isAgent
      ? sql`false`
      : sql`${leads.assignedTo} is null and ${leads.leadStatus} not in ('not_interested', 'dropped')`;
    const naSql = isAgent ? sql`false` : sql`${leads.leadStatus} in ('not_interested', 'dropped')`;

    const base = stripBucketOverrides(baseParams);
    // Fast path: no correlated phone-dedupe / re-enquiry EXISTS in FILTER clauses.
    const activeWhere = buildListWhere({ ...base, excludeDuplicates: false });
    const deletedWhere = buildListWhere({
      ...base,
      deletedOnly: true,
      excludeDuplicates: false,
      ...(isAgent && userId ? { assignedTo: userId } : {}),
    });

    try {
      const heavyFallback = [{ count: 0 }];
      const withTimeout = async <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([
            promise,
            new Promise<T>((resolve) => {
              timer = setTimeout(() => resolve(fallback), ms);
            }),
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }
      };

      const [[activeRow], [deletedRow], [duplicateRow], [reEnquiredRow]] = await Promise.all([
        db
          .select({
            all: sql<number>`count(*) filter (where ${agentBookSql})::int`,
            my: sql<number>`count(*) filter (where ${mySql})::int`,
            teams: sql<number>`count(*) filter (where ${teamsSql})::int`,
            unassigned: sql<number>`count(*) filter (where ${unassignedSql})::int`,
            naleads: sql<number>`count(*) filter (where ${naSql})::int`,
          })
          .from(leads)
          .where(activeWhere),
        db.select({ count: sql<number>`count(*)::int` }).from(leads).where(deletedWhere),
        // Heavy EXISTS queries — short timeout so tab badges stay snappy.
        withTimeout(
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(leads)
            .where(
              buildListWhere({
                ...base,
                duplicatesOnly: true,
                excludeDuplicates: false,
                ...(isAgent && userId ? { assignedTo: userId } : {}),
              }),
            ),
          800,
          heavyFallback,
        ),
        withTimeout(
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(leads)
            .where(
              buildListWhere({
                ...base,
                reEnquiredOnly: true,
                excludeDuplicates: false,
                ...(isAgent && userId ? { assignedTo: userId } : {}),
              }),
            ),
          800,
          heavyFallback,
        ),
      ]);

      return {
        all: asCount(activeRow?.all),
        my: asCount(activeRow?.my),
        teams: asCount(activeRow?.teams),
        unassigned: asCount(activeRow?.unassigned),
        deleted: asCount(deletedRow?.count),
        duplicate: asCount(duplicateRow?.count),
        "re-enquired": asCount(reEnquiredRow?.count),
        naleads: asCount(activeRow?.naleads),
      };
    } catch (err) {
      logger.error("Lead scope count query failed", {
        message: err instanceof Error ? err.message : String(err),
      });
      return { ...EMPTY_SCOPE_COUNTS };
    }
  },

  async listLeads(params: ListLeadsParams) {
    const { page = 1, pageSize = 20 } = params;
    const offset = (page - 1) * pageSize;

    // Phone-dedupe via window function (one pass) instead of correlated NOT EXISTS per row.
    if (params.excludeDuplicates && !params.duplicatesOnly) {
      const baseWhere = buildListWhere({ ...params, excludeDuplicates: false });
      const orderExpr = params.orderByFollowUp
        ? sql`next_followup_at ASC NULLS LAST, created_at DESC`
        : sql`created_at DESC`;

      const [idRows, countRows] = await Promise.all([
        db.execute<{ id: string }>(sql`
          WITH filtered AS (
            SELECT
              ${leads.id} AS id,
              ${leads.createdAt} AS created_at,
              ${leads.nextFollowupAt} AS next_followup_at,
              CASE
                WHEN LENGTH(${leadPhoneKeySql}) >= 10 THEN ${leadPhoneKeySql}
                ELSE ${leads.id}::text
              END AS dedupe_key,
              ROW_NUMBER() OVER (
                PARTITION BY CASE
                  WHEN LENGTH(${leadPhoneKeySql}) >= 10 THEN ${leadPhoneKeySql}
                  ELSE ${leads.id}::text
                END
                ORDER BY ${leads.createdAt} ASC, ${leads.id} ASC
              ) AS rn
            FROM ${leads}
            WHERE ${baseWhere}
          )
          SELECT id FROM filtered
          WHERE rn = 1
          ORDER BY ${orderExpr}
          LIMIT ${pageSize} OFFSET ${offset}
        `),
        db.execute<{ count: number }>(sql`
          WITH filtered AS (
            SELECT
              ${leads.id} AS id,
              ROW_NUMBER() OVER (
                PARTITION BY CASE
                  WHEN LENGTH(${leadPhoneKeySql}) >= 10 THEN ${leadPhoneKeySql}
                  ELSE ${leads.id}::text
                END
                ORDER BY ${leads.createdAt} ASC, ${leads.id} ASC
              ) AS rn
            FROM ${leads}
            WHERE ${baseWhere}
          )
          SELECT COUNT(*)::int AS count FROM filtered WHERE rn = 1
        `),
      ]);

      const ids = idRows.map((row) => row.id);
      const total = Number(countRows[0]?.count ?? 0);

      if (ids.length === 0) {
        return { items: [], page, pageSize, total };
      }

      const rows = await db
        .select()
        .from(leads)
        .leftJoin(users, eq(leads.assignedTo, users.id))
        .where(inArray(leads.id, ids));

      const byId = new Map(
        rows.map((row) => [
          row.leads.id,
          {
            ...row.leads,
            assignedUser: row.users
              ? { id: row.users.id, name: row.users.name, email: row.users.email }
              : null,
          },
        ]),
      );

      return {
        items: ids.map((id) => byId.get(id)!).filter(Boolean),
        page,
        pageSize,
        total,
      };
    }

    const whereClause = buildListWhere(params);

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

    const resolvedStatus = leadStatus ?? "new";
    const now = new Date();
    const isNaStatus = (NA_STATUSES as string[]).includes(resolvedStatus);

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
        leadSource: canonicalizeLeadSource(leadSource) ?? null,
        leadStatus: resolvedStatus,
        temperature: temperature ?? null,
        notes: notes ?? null,
        tags: tags ?? null,
        nextFollowupAt: nextFollowupAt ? new Date(nextFollowupAt) : null,
        estimatedValue: estimatedValue != null ? String(estimatedValue) : null,
        projectName: resolvedProject.projectName,
        projectId: resolvedProject.projectId,
        naSinceAt: isNaStatus ? now : null,
      })
      .returning();

    return created!;
  },

  async bulkCreateLeads(input: {
    rows: Record<string, unknown>[];
    skipDuplicates: boolean;
    /** keep_assignee (default) or reassign duplicates to assignedToAgents. */
    onDuplicate?: "keep_assignee" | "reassign";
    /** Record assignment history when reassigning (default true). */
    assignWithHistory?: boolean;
    /** Move dropped/not_interested duplicates to new (default false). */
    applyNewStatus?: boolean;
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

    const assignmentCounts: Record<string, number> = {};
    const assignWithHistory = input.assignWithHistory ?? true;
    const applyNewStatus = input.applyNewStatus ?? false;

    const trackAssignment = (assigneeId: string | null | undefined) => {
      if (!assigneeId || assigneeId === input.actingUserId) return;
      assignmentCounts[assigneeId] = (assignmentCounts[assigneeId] ?? 0) + 1;
    };

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
        const previousAssignee = existing.assignedTo;
        const merged = await this.mergeImportRow({
          leadId: existing.id,
          data: parsed.data,
          storedPhone,
          assignedTo,
          onDuplicate: input.onDuplicate ?? "keep_assignee",
          assignWithHistory,
          applyNewStatus,
          actingUserId: input.actingUserId,
          source: "bulk_import",
        });

        if (merged) {
          if (
            (input.onDuplicate ?? "keep_assignee") === "reassign" &&
            assignedTo &&
            assignedTo !== previousAssignee
          ) {
            trackAssignment(assignedTo);
          }
          updated.push({ row: rowNumber, id: merged.id, phone: merged.phone ?? storedPhone });
          batchItems.push({
            rowNumber,
            outcome: "updated",
            leadId: merged.id,
            phone: merged.phone ?? storedPhone,
          });
        } else if (input.skipDuplicates) {
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
        trackAssignment(assignedTo);
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
      assignmentCounts,
    };
  },

  async mergeImportRow(input: {
    leadId: string;
    data: CreateLeadInput;
    storedPhone: string;
    assignedTo?: string;
    /** Default keep_assignee — only bulk import passes reassign. */
    onDuplicate?: "keep_assignee" | "reassign";
    assignWithHistory?: boolean;
    applyNewStatus?: boolean;
    actingUserId: string;
    source?: string;
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

    const assignWithHistory = input.assignWithHistory ?? true;
    const applyNewStatus = input.applyNewStatus ?? false;

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
    if (input.data.leadSource !== undefined) {
      update.leadSource = canonicalizeLeadSource(input.data.leadSource) ?? null;
    }
    if (input.data.temperature !== undefined) update.temperature = input.data.temperature ?? null;
    if (input.data.notes !== undefined) update.notes = input.data.notes ?? null;
    if (input.data.tags !== undefined) update.tags = input.data.tags ?? null;

    const shouldApplyNewStatus =
      applyNewStatus && (NA_STATUSES as string[]).includes(existing.leadStatus);

    if (input.data.leadStatus !== undefined) {
      update.leadStatus = input.data.leadStatus;
    } else if (shouldApplyNewStatus) {
      update.leadStatus = "new";
      update.naSinceAt = null;
      update.nextFollowupAt = null;
    } else if (existing.leadStatus === "lost" || existing.leadStatus === "won") {
      update.leadStatus = "new";
    }

    if (input.data.projectId !== undefined || input.data.projectName !== undefined) {
      update.projectName = resolvedProject.projectName;
      update.projectId = resolvedProject.projectId;
    }

    const shouldReassign =
      input.onDuplicate === "reassign" &&
      Boolean(input.assignedTo) &&
      input.assignedTo !== existing.assignedTo;

    if (shouldReassign) {
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

    if (shouldReassign && input.assignedTo && assignWithHistory) {
      await recordLeadAssignment(db, {
        leadId: input.leadId,
        fromAgentId: existing.assignedTo,
        toAgentId: input.assignedTo,
        assignedBy: input.actingUserId,
        reason: "bulk_import_reassign",
      });

      await db.insert(leadActivities).values({
        orgId: SINGLE_TENANT_ORG_ID,
        leadId: input.leadId,
        userId: input.actingUserId,
        type: "status_change",
        metadata: {
          kind: "assignment",
          assignedTo: input.assignedTo,
          source: input.source ?? "bulk_import",
        },
      });
    }

    if (shouldApplyNewStatus && existing.leadStatus !== "new") {
      await db.insert(leadActivities).values({
        orgId: SINGLE_TENANT_ORG_ID,
        leadId: input.leadId,
        userId: input.actingUserId,
        type: "status_change",
        metadata: { from: existing.leadStatus, to: "new", source: input.source ?? "bulk_import" },
      });
    }

    const reopenedFromTerminal =
      (existing.leadStatus === "lost" || existing.leadStatus === "won") &&
      merged.leadStatus !== existing.leadStatus &&
      merged.leadStatus !== "lost" &&
      merged.leadStatus !== "won";

    await recordReEnquiryActivity({
      leadId: input.leadId,
      actingUserId: input.actingUserId,
      source: input.source ?? "bulk_import",
      ...(reopenedFromTerminal
        ? { fromStatus: existing.leadStatus, toStatus: merged.leadStatus }
        : {}),
    });

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

    const [adRow] = await db
      .select({
        campaignName: facebookLeads.campaignName,
        adsetName: facebookLeads.adsetName,
        adName: facebookLeads.adName,
        formName: facebookLeads.formName,
        pageName: facebookLeads.pageName,
      })
      .from(facebookLeads)
      .where(eq(facebookLeads.leadId, leadId))
      .limit(1);

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
      adAttribution: adRow ?? null,
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
    if (payload.leadSource !== undefined) {
      update.leadSource = canonicalizeLeadSource(payload.leadSource) ?? null;
    }
    if (payload.leadStatus !== undefined) update.leadStatus = payload.leadStatus;
    if (payload.leadStatus !== undefined && payload.leadStatus !== existing.leadStatus) {
      if ((NA_STATUSES as string[]).includes(payload.leadStatus)) {
        update.naSinceAt = new Date();
      } else if ((NA_STATUSES as string[]).includes(existing.leadStatus)) {
        update.naSinceAt = null;
      }
    }
    if (payload.temperature !== undefined) update.temperature = payload.temperature;
    if (payload.notes !== undefined) update.notes = payload.notes;
    if (payload.tags !== undefined) update.tags = payload.tags;
    if (payload.nextFollowupAt !== undefined) {
      update.nextFollowupAt =
        payload.nextFollowupAt == null ? null : new Date(payload.nextFollowupAt);
      // Agent-scheduled follow-up leaves New → Pending path (contacted), then Callback bucket.
      if (
        payload.nextFollowupAt != null &&
        existing.leadStatus === "new" &&
        payload.leadStatus === undefined
      ) {
        update.leadStatus = "contacted";
      }
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
    if (payload.closeReason !== undefined) update.closeReason = payload.closeReason;
    if (payload.closeReasonNote !== undefined) update.closeReasonNote = payload.closeReasonNote;

    // Track last activity time on every update
    update.lastActivityAt = new Date();

    const statusClearsFollowUp =
      payload.leadStatus !== undefined &&
      payload.leadStatus !== existing.leadStatus &&
      FOLLOW_UP_CLEARING_STATUSES.includes(payload.leadStatus);
    if (statusClearsFollowUp && existing.nextFollowupAt) {
      update.nextFollowupAt = null;
    }

    const assignmentChanged =
      payload.assignedTo !== undefined && payload.assignedTo !== existing.assignedTo;

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

      void import("./metaConversionService.js")
        .then(({ enqueueConversionForLeadStatusChange }) =>
          enqueueConversionForLeadStatusChange(leadId, payload.leadStatus!),
        )
        .catch(() => undefined);
    } else if (
      updated &&
      existing.leadStatus === "new" &&
      payload.leadStatus === undefined &&
      (payload.nextFollowupAt !== undefined || payload.notes !== undefined)
    ) {
      // Touched (follow-up / note) without status change → Pending.
      await promoteNewLeadToContacted(leadId, {
        userId: actingUserId,
        reason: "follow_up_set",
      });
    }

    if (updated) {
      void Promise.resolve(recalculateLeadScore(leadId)).catch(() => undefined);
    }

    return updated ?? null;
  },

  /** Unassign a lead that has been in NA status past the grace window. */
  async releaseLeadToNaPool(leadId: string): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(leads)
      .where(
        and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), eq(leads.id, leadId), isNull(leads.deletedAt)),
      )
      .limit(1);

    if (!existing?.assignedTo) return false;
    if (!(NA_STATUSES as string[]).includes(existing.leadStatus)) return false;

    const fromAgentId = existing.assignedTo;

    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(leads)
        .set({ assignedTo: null, updatedAt: new Date() })
        .where(
          and(
            eq(leads.orgId, SINGLE_TENANT_ORG_ID),
            eq(leads.id, leadId),
            isNotNull(leads.assignedTo),
          ),
        )
        .returning();

      if (row) {
        await tx.insert(leadActivities).values({
          orgId: SINGLE_TENANT_ORG_ID,
          leadId,
          userId: fromAgentId,
          type: "assignment_change",
          metadata: { kind: "na_pool_release", fromAgentId },
        });
      }

      return [row];
    });

    return Boolean(updated);
  },

  async assignLead(input: AssignLeadInput) {
    const { leadId, userId, actingUserId } = input;
    const assignWithHistory = input.assignWithHistory ?? true;
    const applyNewStatus = input.applyNewStatus ?? false;

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
      const nextLeadStatus: typeof existing.leadStatus | null =
        applyNewStatus && NA_STATUSES.includes(existing.leadStatus) ? "new" : null;

      const [row] = await tx
        .update(leads)
        .set({
          assignedTo: userId,
          ...(nextLeadStatus
            ? { leadStatus: nextLeadStatus, naSinceAt: null, nextFollowupAt: null }
            : {}),
          updatedAt: new Date(),
        })
        .where(
          and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), eq(leads.id, leadId), isNull(leads.deletedAt)),
        )
        .returning();

      if (row && assignWithHistory) {
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

    if (assignWithHistory) {
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
    }

    // If we moved NA → "new", record a normal status change activity (regardless of assignment-history flag).
    if (
      applyNewStatus &&
      NA_STATUSES.includes(existing.leadStatus) &&
      existing.leadStatus !== "new"
    ) {
      await db.insert(leadActivities).values({
        orgId: SINGLE_TENANT_ORG_ID,
        leadId,
        userId: actingUserId,
        type: "status_change",
        metadata: { from: existing.leadStatus, to: "new" },
      });
    }

    return updated;
  },

  async bulkAssignLeads(input: {
    leadIds: string[];
    userIds: string[];
    actingUserId: string;
    assignWithHistory?: boolean;
    applyNewStatus?: boolean;
  }) {
    const assignWithHistory = input.assignWithHistory ?? true;
    const applyNewStatus = input.applyNewStatus ?? false;
    const succeeded: string[] = [];
    const failed: { id: string; message: string }[] = [];
    const assignmentCounts: Record<string, number> = {};

    for (let index = 0; index < input.leadIds.length; index++) {
      const leadId = input.leadIds[index]!;
      const userId = input.userIds[index % input.userIds.length]!;

      try {
        const updated = await this.assignLead({
          leadId,
          userId,
          actingUserId: input.actingUserId,
          assignWithHistory,
          applyNewStatus,
        });

        if (!updated) {
          failed.push({ id: leadId, message: "Lead or assignee not found" });
          continue;
        }

        succeeded.push(leadId);
        if (userId !== input.actingUserId) {
          assignmentCounts[userId] = (assignmentCounts[userId] ?? 0) + 1;
        }
      } catch (err) {
        failed.push({
          id: leadId,
          message: err instanceof Error ? err.message : "Assign failed",
        });
      }
    }

    return { succeeded, failed, assignmentCounts };
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

    if (activity) {
      await db
        .update(leads)
        .set({ lastActivityAt: new Date(), updatedAt: new Date() })
        .where(and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), eq(leads.id, leadId)));
      void recalculateLeadScore(leadId).catch(() => undefined);
    }

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
        id: leads.id,
        firstName: leads.firstName,
        lastName: leads.lastName,
        phone: leads.phone,
        email: leads.email,
        leadStatus: leads.leadStatus,
        temperature: leads.temperature,
        assignedTo: leads.assignedTo,
        nextFollowupAt: leads.nextFollowupAt,
        lastContactedAt: leads.lastContactedAt,
        createdAt: leads.createdAt,
        followUpCount: leads.followUpCount,
        userName: users.name,
        userId: users.id,
        userEmail: users.email,
      })
      .from(leads)
      .leftJoin(users, eq(leads.assignedTo, users.id))
      .where(and(...filters))
      .orderBy(asc(leads.nextFollowupAt))
      .limit(100);

    return rows.map((row) => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      email: row.email,
      leadStatus: row.leadStatus,
      temperature: row.temperature,
      assignedTo: row.assignedTo,
      nextFollowupAt: row.nextFollowupAt,
      lastContactedAt: row.lastContactedAt,
      createdAt: row.createdAt,
      assignedUser: row.userId
        ? { id: row.userId, name: row.userName ?? "", email: row.userEmail ?? "" }
        : null,
      daysOverdue: daysOverdue(row.nextFollowupAt!.toISOString(), now),
      daysSinceContact: daysSinceContact(row.lastContactedAt, row.createdAt, now),
      followUpCount: row.followUpCount ?? 0,
    }));
  },

  async listColdLeads(assignedTo?: string) {
    const cutoff = coldCutoffDate();
    const filters = [
      eq(leads.orgId, SINGLE_TENANT_ORG_ID),
      isNull(leads.deletedAt),
      sql`${leads.leadStatus} not in ('won', 'lost')`,
      lte(sql`COALESCE(${leads.lastContactedAt}, ${leads.createdAt})`, cutoff.toISOString()),
    ];
    if (assignedTo) {
      filters.push(eq(leads.assignedTo, assignedTo));
    }

    const now = new Date();
    const rows = await db
      .select({
        id: leads.id,
        firstName: leads.firstName,
        lastName: leads.lastName,
        phone: leads.phone,
        email: leads.email,
        leadStatus: leads.leadStatus,
        temperature: leads.temperature,
        assignedTo: leads.assignedTo,
        nextFollowupAt: leads.nextFollowupAt,
        lastContactedAt: leads.lastContactedAt,
        createdAt: leads.createdAt,
        followUpCount: leads.followUpCount,
        userName: users.name,
        userId: users.id,
        userEmail: users.email,
      })
      .from(leads)
      .leftJoin(users, eq(leads.assignedTo, users.id))
      .where(and(...filters))
      .orderBy(asc(sql`COALESCE(${leads.lastContactedAt}, ${leads.createdAt})`))
      .limit(100);

    return rows.map((row) => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      email: row.email,
      leadStatus: row.leadStatus,
      temperature: row.temperature,
      assignedTo: row.assignedTo,
      nextFollowupAt: row.nextFollowupAt,
      lastContactedAt: row.lastContactedAt,
      createdAt: row.createdAt,
      assignedUser: row.userId
        ? { id: row.userId, name: row.userName ?? "", email: row.userEmail ?? "" }
        : null,
      daysSinceContact: daysSinceContact(row.lastContactedAt, row.createdAt, now),
      daysOverdue: row.nextFollowupAt ? daysOverdue(row.nextFollowupAt.toISOString(), now) : 0,
      followUpCount: row.followUpCount ?? 0,
    }));
  },

  async markColdLeads(now = new Date()) {
    const cutoff = coldCutoffDate(now);

    const coldFilter = and(
      eq(leads.orgId, SINGLE_TENANT_ORG_ID),
      isNull(leads.deletedAt),
      sql`${leads.leadStatus} not in ('won', 'lost')`,
      lte(sql`COALESCE(${leads.lastContactedAt}, ${leads.createdAt})`, cutoff.toISOString()),
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
            lte(sql`COALESCE(${leads.lastContactedAt}, ${leads.createdAt})`, cutoff.toISOString()),
          ),
        ),
    ]);

    return {
      followUpsDueToday: followUpsDueToday?.count ?? 0,
      overdueFollowUps: overdueFollowUps?.count ?? 0,
      coldLeads: coldLeads?.count ?? 0,
    };
  },

  async exportCsv(params: ListLeadsParams & { maxRows?: number }) {
    const whereClause = buildListWhere({
      ...params,
      excludeDuplicates: params.excludeDuplicates ?? true,
    });
    const limit = params.maxRows ?? 10_000;
    const rows = await db
      .select({
        id: leads.id,
        firstName: leads.firstName,
        lastName: leads.lastName,
        phone: leads.phone,
        email: leads.email,
        leadStatus: leads.leadStatus,
        temperature: leads.temperature,
        leadSource: leads.leadSource,
        city: leads.city,
        assignedTo: leads.assignedTo,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .where(whereClause)
      .orderBy(desc(leads.createdAt))
      .limit(limit);

    const csv = toCsv(
      [
        "ID",
        "First Name",
        "Last Name",
        "Phone",
        "Email",
        "Status",
        "Temperature",
        "Source",
        "City",
        "Assigned To",
        "Created At",
      ],
      rows.map((row) => [
        row.id,
        row.firstName,
        row.lastName ?? "",
        row.phone,
        row.email ?? "",
        row.leadStatus,
        row.temperature ?? "",
        row.leadSource ?? "",
        row.city ?? "",
        row.assignedTo ?? "",
        row.createdAt.toISOString(),
      ]),
    );

    return { csv, rowCount: rows.length };
  },
};
