import {
  agentCallingData,
  agentCallingLimits,
  agentDailyLimits,
  agentDataRequests,
  auditLogs,
  contactCallLogs,
  contactPool,
  contactPoolSettings,
  dncPhones,
  uploadBatches,
  uploadInvalidRows,
  users,
} from "@propninja/db";
import { getIstDateKey, getIstDayBounds } from "@propninja/types/ist";
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { clampDailyLimit } from "../lib/contactPool/outcomeRules.js";
import { phoneHash, sanitizeText } from "../lib/contactPool/sanitize.js";
import { sqlRows, toCsv, uuidArray } from "../lib/contactPool/sql.js";
import type { Database } from "../lib/db.js";
import { getDb } from "../lib/db.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { normalizeStoredPhone } from "../lib/leadPhone.js";

export type PoolFilters = {
  city?: string | null;
  minBudget?: number | null;
  maxBudget?: number | null;
  propertyType?: string | null;
  bedrooms?: string | null;
};

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

function resetsAt(now = new Date()): string {
  return getIstDayBounds(1, now).start.toISOString();
}

async function agentMaxLimit(db: Database, agentId: string): Promise<number> {
  const [row] = await db
    .select({ maxDailyLimit: agentCallingLimits.maxDailyLimit })
    .from(agentCallingLimits)
    .where(eq(agentCallingLimits.agentId, agentId))
    .limit(1);
  return clampDailyLimit(row?.maxDailyLimit ?? 100);
}

export async function getDailyStatus(agentId: string) {
  const db = getDb();
  const dateKey = getIstDateKey();
  const maxDailyLimit = await agentMaxLimit(db, agentId);
  const [limit] = await db
    .select()
    .from(agentDailyLimits)
    .where(and(eq(agentDailyLimits.agentId, agentId), eq(agentDailyLimits.date, dateKey)))
    .limit(1);
  const [settings] = await db
    .select({ requestsPaused: contactPoolSettings.requestsPaused })
    .from(contactPoolSettings)
    .where(eq(contactPoolSettings.orgId, SINGLE_TENANT_ORG_ID))
    .limit(1);
  const requested = limit?.contactsRequestedToday ?? 0;
  const cap = limit?.maxDailyLimit ?? maxDailyLimit;
  return {
    date: dateKey,
    contactsRequestedToday: requested,
    contactsCalledToday: limit?.contactsCalledToday ?? 0,
    maxDailyLimit: cap,
    remaining: Math.max(0, cap - requested),
    paused: settings?.requestsPaused ?? false,
    resetsAt: resetsAt(),
  };
}

export async function requestCallingData(input: {
  agentId: string;
  filters: PoolFilters;
}) {
  const db = getDb();
  const dateKey = getIstDateKey();
  const maxDailyLimit = await agentMaxLimit(db, input.agentId);
  const filters = cleanFilters(input.filters);

  const result = await db.transaction(async (tx) => {
    const [settings] = await tx
      .select({ requestsPaused: contactPoolSettings.requestsPaused })
      .from(contactPoolSettings)
      .where(eq(contactPoolSettings.orgId, SINGLE_TENANT_ORG_ID))
      .limit(1);
    if (settings?.requestsPaused) {
      return finishDenied(tx, input.agentId, filters, "Data requests are paused", 0, maxDailyLimit);
    }

    await tx.execute(sql`
      INSERT INTO agent_daily_limits (
        org_id, agent_id, date, contacts_requested_today, contacts_called_today, max_daily_limit
      ) VALUES (
        ${SINGLE_TENANT_ORG_ID}::uuid, ${input.agentId}::uuid, ${dateKey}::date, 0, 0, ${maxDailyLimit}
      )
      ON CONFLICT (agent_id, date) DO NOTHING
    `);

    const locked = sqlRows(
      await tx.execute(sql`
        SELECT contacts_requested_today, max_daily_limit
        FROM agent_daily_limits
        WHERE agent_id = ${input.agentId}::uuid AND date = ${dateKey}::date
        FOR UPDATE
      `),
    );
    const requestedToday = Number(locked[0]?.contacts_requested_today ?? 0);
    const cap = clampDailyLimit(Number(locked[0]?.max_daily_limit ?? maxDailyLimit));
    const allowed = cap - requestedToday;
    if (allowed <= 0) {
      return finishDenied(tx, input.agentId, filters, "Daily limit reached", 0, 0);
    }

    const ids = await selectFifo(tx, allowed, filters);
    if (ids.length === 0) {
      return finishDenied(
        tx,
        input.agentId,
        filters,
        "No unassigned contacts available",
        allowed,
        allowed,
      );
    }

    const updated = sqlRows(
      await tx.execute(sql`
        UPDATE contact_pool SET
          status = 'assigned',
          assigned_to_agent_id = ${input.agentId}::uuid,
          assigned_at = now()
        WHERE contact_id = ANY(${uuidArray(ids)})
        RETURNING contact_id, name, phone, city, budget_label, budget, property_type, bedrooms
      `),
    );

    const callingValues = updated.map((row) => ({
      orgId: SINGLE_TENANT_ORG_ID,
      contactPoolId: String(row.contact_id),
      agentId: input.agentId,
      name: String(row.name),
      phone: String(row.phone),
      city: row.city ? String(row.city) : null,
      budget: row.budget_label
        ? String(row.budget_label)
        : row.budget != null
          ? String(row.budget)
          : null,
      propertyType: row.property_type ? String(row.property_type) : null,
      bedrooms: row.bedrooms ? String(row.bedrooms) : null,
      status: "pending" as const,
    }));

    const calling = await tx.insert(agentCallingData).values(callingValues).returning({
      recordId: agentCallingData.recordId,
      contactPoolId: agentCallingData.contactPoolId,
      name: agentCallingData.name,
      phone: agentCallingData.phone,
      city: agentCallingData.city,
      budget: agentCallingData.budget,
      propertyType: agentCallingData.propertyType,
      bedrooms: agentCallingData.bedrooms,
      status: agentCallingData.status,
      assignedAt: agentCallingData.assignedAt,
      callAttempts: agentCallingData.callAttempts,
    });

    await tx.execute(sql`
      UPDATE agent_daily_limits SET
        contacts_requested_today = contacts_requested_today + ${calling.length},
        last_request_at = now()
      WHERE agent_id = ${input.agentId}::uuid AND date = ${dateKey}::date
    `);

    const status = calling.length < allowed ? "partial" : "fulfilled";
    const [request] = await tx
      .insert(agentDataRequests)
      .values({
        orgId: SINGLE_TENANT_ORG_ID,
        agentId: input.agentId,
        contactsRequested: allowed,
        contactsAssigned: calling.length,
        status,
        filtersApplied: filters,
      })
      .returning({ requestId: agentDataRequests.requestId });

    return {
      requestId: request?.requestId ?? null,
      status,
      contactsRequested: allowed,
      contactsAssigned: calling.length,
      denialReason: null as string | null,
      remainingToday: cap - requestedToday - calling.length,
      contacts: calling,
    };
  });

  const alreadyLeads = await listAlreadyLeadWarnings(db, filters);
  return { ...result, resetsAt: resetsAt(), alreadyLeads };
}

async function finishDenied(
  tx: Tx,
  agentId: string,
  filters: PoolFilters,
  reason: string,
  requested: number,
  remainingToday: number,
) {
  const [request] = await tx
    .insert(agentDataRequests)
    .values({
      orgId: SINGLE_TENANT_ORG_ID,
      agentId,
      contactsRequested: requested,
      contactsAssigned: 0,
      status: "denied",
      denialReason: reason,
      filtersApplied: filters,
    })
    .returning({ requestId: agentDataRequests.requestId });
  return {
    requestId: request?.requestId ?? null,
    status: "denied" as const,
    contactsRequested: requested,
    contactsAssigned: 0,
    denialReason: reason,
    remainingToday,
    contacts: [],
  };
}

async function selectFifo(tx: Tx, allowed: number, filters: PoolFilters): Promise<string[]> {
  const full = await lockIds(tx, allowed, filters, "full", []);
  let ids = full;
  if (ids.length < allowed && filters.city) {
    ids = ids.concat(await lockIds(tx, allowed - ids.length, filters, "noCity", ids));
  }
  const hasOther = Boolean(
    filters.propertyType ||
      filters.bedrooms ||
      filters.minBudget != null ||
      filters.maxBudget != null,
  );
  if (ids.length < allowed && (filters.city || hasOther)) {
    ids = ids.concat(await lockIds(tx, allowed - ids.length, filters, "any", ids));
  }
  return ids;
}

async function lockIds(
  tx: Tx,
  limit: number,
  filters: PoolFilters,
  mode: "full" | "noCity" | "any",
  exclude: string[],
): Promise<string[]> {
  if (limit <= 0) return [];
  const clauses = [
    sql`cp.org_id = ${SINGLE_TENANT_ORG_ID}::uuid`,
    sql`cp.status = 'unassigned'`,
    sql`NOT EXISTS (
      SELECT 1 FROM dnc_phones d WHERE d.org_id = cp.org_id AND d.phone = cp.phone
    )`,
    sql`NOT EXISTS (
      SELECT 1 FROM agent_calling_data ac
      WHERE ac.contact_pool_id = cp.contact_id AND ac.deleted_at IS NULL
    )`,
    sql`NOT EXISTS (
      SELECT 1 FROM leads l
      WHERE l.org_id = cp.org_id AND l.deleted_at IS NULL
        AND right(regexp_replace(coalesce(l.phone, ''), '\\D', '', 'g'), 10)
          = right(regexp_replace(cp.phone, '\\D', '', 'g'), 10)
        AND length(right(regexp_replace(cp.phone, '\\D', '', 'g'), 10)) = 10
    )`,
  ];
  if (exclude.length > 0) {
    clauses.push(sql`NOT (cp.contact_id = ANY(${uuidArray(exclude)}))`);
  }
  if (mode !== "any") {
    if (mode === "full" && filters.city) clauses.push(sql`lower(cp.city) = lower(${filters.city})`);
    if (filters.propertyType) clauses.push(sql`cp.property_type = ${filters.propertyType}`);
    if (filters.bedrooms) clauses.push(sql`cp.bedrooms = ${filters.bedrooms}`);
    if (filters.minBudget != null) clauses.push(sql`cp.budget >= ${filters.minBudget}`);
    if (filters.maxBudget != null) clauses.push(sql`cp.budget <= ${filters.maxBudget}`);
  }
  const result = await tx.execute(sql`
    SELECT cp.contact_id
    FROM contact_pool cp
    LEFT JOIN upload_batches ub ON ub.batch_id = cp.upload_batch_id
    WHERE ${sql.join(clauses, sql` AND `)}
    ORDER BY COALESCE(ub.priority, 0) DESC, cp.created_at ASC
    LIMIT ${limit}
    FOR UPDATE OF cp SKIP LOCKED
  `);
  return sqlRows(result).map((row) => String(row.contact_id));
}

async function listAlreadyLeadWarnings(db: Database, filters: PoolFilters) {
  const clauses = [sql`cp.org_id = ${SINGLE_TENANT_ORG_ID}::uuid`, sql`cp.status = 'unassigned'`];
  if (filters.city) clauses.push(sql`lower(cp.city) = lower(${filters.city})`);
  const result = await db.execute(sql`
    SELECT cp.phone, cp.name, l.lead_code, l.id AS lead_id
    FROM contact_pool cp
    JOIN leads l
      ON l.org_id = cp.org_id
     AND l.deleted_at IS NULL
     AND right(regexp_replace(coalesce(l.phone, ''), '\\D', '', 'g'), 10)
       = right(regexp_replace(cp.phone, '\\D', '', 'g'), 10)
    WHERE ${sql.join(clauses, sql` AND `)}
    LIMIT 15
  `);
  return sqlRows(result).map((row) => ({
    phone: String(row.phone),
    name: String(row.name),
    leadCode: String(row.lead_code),
    leadId: String(row.lead_id),
    message: `This number is already a lead (${String(row.lead_code)}). Skip or view lead?`,
  }));
}

function cleanFilters(filters: PoolFilters): PoolFilters {
  return {
    city: sanitizeText(filters.city, 80) || null,
    minBudget: filters.minBudget ?? null,
    maxBudget: filters.maxBudget ?? null,
    propertyType: filters.propertyType ?? null,
    bedrooms: filters.bedrooms ?? null,
  };
}

export async function listBatches() {
  const db = getDb();
  return db
    .select()
    .from(uploadBatches)
    .where(eq(uploadBatches.orgId, SINGLE_TENANT_ORG_ID))
    .orderBy(desc(uploadBatches.uploadedAt));
}

export async function getBatch(batchId: string) {
  const db = getDb();
  const [batch] = await db
    .select()
    .from(uploadBatches)
    .where(and(eq(uploadBatches.batchId, batchId), eq(uploadBatches.orgId, SINGLE_TENANT_ORG_ID)))
    .limit(1);
  if (!batch) throw notFound("Upload batch not found");
  return batch;
}

export async function invalidRowsCsv(batchId: string) {
  await getBatch(batchId);
  const db = getDb();
  const rows = await db
    .select()
    .from(uploadInvalidRows)
    .where(eq(uploadInvalidRows.batchId, batchId))
    .orderBy(asc(uploadInvalidRows.rowNumber));
  return toCsv(
    ["row_number", "reason", "raw"],
    rows.map((row) => [row.rowNumber, row.reason, JSON.stringify(row.raw)]),
  );
}

export async function deleteBatch(batchId: string, adminId: string) {
  const db = getDb();
  await getBatch(batchId);
  const removed = await db
    .delete(contactPool)
    .where(and(eq(contactPool.uploadBatchId, batchId), eq(contactPool.status, "unassigned")))
    .returning({ contactId: contactPool.contactId });
  const [remaining] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contactPool)
    .where(eq(contactPool.uploadBatchId, batchId));
  if ((remaining?.count ?? 0) === 0) {
    await db.delete(uploadBatches).where(eq(uploadBatches.batchId, batchId));
  }
  await db.insert(auditLogs).values({
    userId: adminId,
    action: "CALLING_BATCH_DELETED",
    entityType: "upload_batch",
    entityId: batchId,
    metadata: { removedUnassigned: removed.length },
  });
  return { removedUnassigned: removed.length, batchKept: (remaining?.count ?? 0) > 0 };
}

export async function updateBatch(
  batchId: string,
  input: { batchName?: string; priority?: number },
) {
  await getBatch(batchId);
  const db = getDb();
  const [row] = await db
    .update(uploadBatches)
    .set({
      ...(input.batchName ? { batchName: sanitizeText(input.batchName, 120) } : {}),
      ...(input.priority != null ? { priority: Math.max(0, Math.min(100, input.priority)) } : {}),
    })
    .where(eq(uploadBatches.batchId, batchId))
    .returning();
  return row;
}

export async function listPool(query: {
  status?: string;
  city?: string;
  agentId?: string;
  batchId?: string;
  propertyType?: string;
  from?: string;
  to?: string;
  search?: string;
  page: number;
  pageSize: number;
}) {
  const db = getDb();
  const filters = [eq(contactPool.orgId, SINGLE_TENANT_ORG_ID)];
  if (query.status) filters.push(eq(contactPool.status, query.status));
  if (query.city) filters.push(ilike(contactPool.city, query.city));
  if (query.agentId) filters.push(eq(contactPool.assignedToAgentId, query.agentId));
  if (query.batchId) filters.push(eq(contactPool.uploadBatchId, query.batchId));
  if (query.propertyType) filters.push(eq(contactPool.propertyType, query.propertyType));
  if (query.from) filters.push(gte(contactPool.createdAt, new Date(query.from)));
  if (query.to) filters.push(lte(contactPool.createdAt, new Date(query.to)));
  if (query.search) {
    const term = `%${query.search}%`;
    const search = or(ilike(contactPool.name, term), ilike(contactPool.phone, term));
    if (search) filters.push(search);
  }
  const where = and(...filters);
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contactPool)
    .where(where);
  const items = await db
    .select()
    .from(contactPool)
    .where(where)
    .orderBy(asc(contactPool.createdAt))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  return {
    items: items.map(stripHash),
    page: query.page,
    pageSize: query.pageSize,
    total: countRow?.count ?? 0,
  };
}

function stripHash<T extends { phoneHash?: string }>(row: T) {
  const { phoneHash: _hash, ...rest } = row;
  return rest;
}

export async function poolStats() {
  const db = getDb();
  const rows = sqlRows(
    await db.execute(sql`
      SELECT status, count(*)::int AS count
      FROM contact_pool
      WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid
      GROUP BY status
    `),
  );
  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    byStatus[String(row.status)] = Number(row.count);
    total += Number(row.count);
  }
  const unassigned = byStatus.unassigned ?? 0;
  const cities = sqlRows(
    await db.execute(sql`
      SELECT DISTINCT city FROM contact_pool
      WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid AND city IS NOT NULL AND city <> ''
      ORDER BY city
      LIMIT 100
    `),
  ).map((row) => String(row.city));
  return {
    total,
    unassigned,
    assigned: byStatus.assigned ?? 0,
    called: byStatus.called ?? 0,
    interested: byStatus.interested ?? 0,
    notInterested: byStatus.not_interested ?? 0,
    callback: byStatus.callback ?? 0,
    dnc: byStatus.dnc ?? 0,
    invalid: byStatus.invalid ?? 0,
    dncOrInvalid: (byStatus.dnc ?? 0) + (byStatus.invalid ?? 0),
    consumed: total - unassigned,
    cities,
  };
}

export async function agentPerformance() {
  const db = getDb();
  const dateKey = getIstDateKey();
  const { start } = getIstDayBounds(0);
  return sqlRows(
    await db.execute(sql`
      SELECT
        u.id AS agent_id,
        u.name AS agent_name,
        COALESCE(d.contacts_requested_today, 0)::int AS contacts_assigned_today,
        COALESCE(d.contacts_called_today, 0)::int AS contacts_called_today,
        COALESCE(inter.n, 0)::int AS interested_today,
        COALESCE(all_assigned.n, 0)::int AS total_assigned,
        COALESCE(all_called.n, 0)::int AS total_called,
        CASE WHEN COALESCE(all_called.n, 0) = 0 THEN 0
          ELSE round(100.0 * COALESCE(all_interested.n, 0) / all_called.n, 1)
        END AS conversion_rate,
        act.last_active
      FROM users u
      LEFT JOIN agent_daily_limits d
        ON d.agent_id = u.id AND d.date = ${dateKey}::date
      LEFT JOIN LATERAL (
        SELECT count(*) AS n FROM contact_call_logs c
        WHERE c.agent_id = u.id AND c.called_at >= ${start} AND c.outcome = 'interested'
      ) inter ON true
      LEFT JOIN LATERAL (
        SELECT count(*) AS n FROM contact_pool p WHERE p.assigned_to_agent_id = u.id
      ) all_assigned ON true
      LEFT JOIN LATERAL (
        SELECT count(DISTINCT contact_id) AS n FROM contact_call_logs c WHERE c.agent_id = u.id
      ) all_called ON true
      LEFT JOIN LATERAL (
        SELECT count(DISTINCT contact_id) AS n FROM contact_call_logs c
        WHERE c.agent_id = u.id AND c.outcome = 'interested'
      ) all_interested ON true
      LEFT JOIN LATERAL (
        SELECT MAX(called_at) AS last_active FROM contact_call_logs c WHERE c.agent_id = u.id
      ) act ON true
      WHERE u.org_id = ${SINGLE_TENANT_ORG_ID}::uuid
        AND u.role = 'agent'
        AND u.is_active = true
      ORDER BY u.name
    `),
  );
}

export async function setAgentLimit(agentId: string, maxDailyLimit: number) {
  const cap = clampDailyLimit(maxDailyLimit);
  const db = getDb();
  const [agent] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, agentId), eq(users.role, "agent")))
    .limit(1);
  if (!agent) throw notFound("Agent not found");
  await db
    .insert(agentCallingLimits)
    .values({ agentId, orgId: SINGLE_TENANT_ORG_ID, maxDailyLimit: cap })
    .onConflictDoUpdate({
      target: agentCallingLimits.agentId,
      set: { maxDailyLimit: cap, updatedAt: new Date() },
    });
  const dateKey = getIstDateKey();
  await db
    .update(agentDailyLimits)
    .set({ maxDailyLimit: cap })
    .where(and(eq(agentDailyLimits.agentId, agentId), eq(agentDailyLimits.date, dateKey)));
  return { agentId, maxDailyLimit: cap };
}

export async function setPause(adminId: string, paused: boolean) {
  const db = getDb();
  await db
    .insert(contactPoolSettings)
    .values({
      orgId: SINGLE_TENANT_ORG_ID,
      requestsPaused: paused,
      pausedAt: paused ? new Date() : null,
      pausedBy: paused ? adminId : null,
    })
    .onConflictDoUpdate({
      target: contactPoolSettings.orgId,
      set: {
        requestsPaused: paused,
        pausedAt: paused ? new Date() : null,
        pausedBy: paused ? adminId : null,
        updatedAt: new Date(),
      },
    });
  return { paused };
}

export async function updatePoolSettings(input: {
  costPerContact?: number | null;
  lowPoolThreshold?: number;
}) {
  const db = getDb();
  await db
    .insert(contactPoolSettings)
    .values({
      orgId: SINGLE_TENANT_ORG_ID,
      costPerContact: input.costPerContact != null ? String(input.costPerContact) : null,
      lowPoolThreshold: input.lowPoolThreshold ?? 500,
    })
    .onConflictDoUpdate({
      target: contactPoolSettings.orgId,
      set: {
        ...(input.costPerContact !== undefined
          ? {
              costPerContact: input.costPerContact != null ? String(input.costPerContact) : null,
            }
          : {}),
        ...(input.lowPoolThreshold != null ? { lowPoolThreshold: input.lowPoolThreshold } : {}),
        updatedAt: new Date(),
      },
    });
  return getPoolSettings();
}

export async function getPoolSettings() {
  const db = getDb();
  const [row] = await db
    .select()
    .from(contactPoolSettings)
    .where(eq(contactPoolSettings.orgId, SINGLE_TENANT_ORG_ID))
    .limit(1);
  return (
    row ?? {
      orgId: SINGLE_TENANT_ORG_ID,
      requestsPaused: false,
      lowPoolThreshold: 500,
      costPerContact: null,
    }
  );
}

export async function reclaimContacts(adminId: string, agentId: string) {
  const db = getDb();
  const activity = sqlRows(
    await db.execute(sql`
      SELECT GREATEST(
        (SELECT MAX(called_at) FROM contact_call_logs WHERE agent_id = ${agentId}::uuid),
        (SELECT MAX(requested_at) FROM agent_data_requests WHERE agent_id = ${agentId}::uuid)
      ) AS last_active
    `),
  );
  const lastActive = activity[0]?.last_active ? new Date(String(activity[0].last_active)) : null;
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  if (lastActive && lastActive.getTime() > cutoff) {
    throw forbidden("Agent was active in the last 7 days");
  }

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        recordId: agentCallingData.recordId,
        contactPoolId: agentCallingData.contactPoolId,
        name: agentCallingData.name,
      })
      .from(agentCallingData)
      .where(
        and(
          eq(agentCallingData.agentId, agentId),
          sql`${agentCallingData.deletedAt} IS NULL`,
          inArray(agentCallingData.status, ["pending", "retry"]),
        ),
      );
    if (rows.length === 0) return { reclaimed: 0 };
    const recordIds = rows.map((row) => row.recordId);
    const contactIds = rows.map((row) => row.contactPoolId);
    const now = new Date();
    await tx
      .update(agentCallingData)
      .set({ deletedAt: now, deletedReason: "reclaimed_inactive", status: "not_interested" })
      .where(inArray(agentCallingData.recordId, recordIds));
    await tx
      .update(contactPool)
      .set({
        status: "unassigned",
        assignedToAgentId: null,
        assignedAt: null,
        callOutcome: null,
      })
      .where(and(inArray(contactPool.contactId, contactIds), eq(contactPool.status, "assigned")));
    await tx.insert(auditLogs).values(
      rows.map((row) => ({
        userId: adminId,
        action: "CALLING_DATA_DELETED",
        entityType: "agent_calling_data",
        entityId: row.recordId,
        entityName: row.name,
        metadata: { reason: "reclaimed_inactive", agentId },
      })),
    );
    return { reclaimed: rows.length };
  });
}

export async function blacklistPhone(adminId: string, phoneRaw: string, reason?: string) {
  const phone = normalizeStoredPhone(sanitizeText(phoneRaw, 32));
  const db = getDb();
  await db
    .insert(dncPhones)
    .values({
      orgId: SINGLE_TENANT_ORG_ID,
      phone,
      phoneHash: phoneHash(phone),
      reason: sanitizeText(reason, 200) || "Blacklisted by admin",
      createdBy: adminId,
    })
    .onConflictDoNothing({ target: [dncPhones.orgId, dncPhones.phone] });
  await db
    .update(contactPool)
    .set({ status: "dnc", callOutcome: "dnc" })
    .where(and(eq(contactPool.orgId, SINGLE_TENANT_ORG_ID), eq(contactPool.phone, phone)));
  const now = new Date();
  const hidden = await db
    .update(agentCallingData)
    .set({ deletedAt: now, deletedReason: "dnc", status: "dnc" })
    .where(
      and(
        eq(agentCallingData.orgId, SINGLE_TENANT_ORG_ID),
        eq(agentCallingData.phone, phone),
        sql`${agentCallingData.deletedAt} IS NULL`,
      ),
    )
    .returning({ recordId: agentCallingData.recordId, name: agentCallingData.name });
  if (hidden.length > 0) {
    await db.insert(auditLogs).values(
      hidden.map((row) => ({
        userId: adminId,
        action: "CALLING_DATA_DELETED",
        entityType: "agent_calling_data",
        entityId: row.recordId,
        entityName: row.name,
        metadata: { reason: "dnc" },
      })),
    );
  }
  return { phone, hidden: hidden.length };
}

export async function bulkPoolAction(
  adminId: string,
  input: { action: "reassign" | "dnc" | "delete"; contactIds: string[]; agentId?: string },
) {
  if (input.contactIds.length === 0) throw badRequest("Select at least one contact");
  if (input.contactIds.length > 500) throw badRequest("Bulk actions are limited to 500 contacts");
  const db = getDb();
  if (input.action === "delete") {
    const removed = await db
      .delete(contactPool)
      .where(
        and(
          eq(contactPool.orgId, SINGLE_TENANT_ORG_ID),
          eq(contactPool.status, "unassigned"),
          inArray(contactPool.contactId, input.contactIds),
        ),
      )
      .returning({ contactId: contactPool.contactId });
    return { affected: removed.length };
  }
  if (input.action === "dnc") {
    const rows = await db
      .select({ phone: contactPool.phone, contactId: contactPool.contactId })
      .from(contactPool)
      .where(
        and(
          eq(contactPool.orgId, SINGLE_TENANT_ORG_ID),
          inArray(contactPool.contactId, input.contactIds),
        ),
      );
    for (const row of rows) {
      await blacklistPhone(adminId, row.phone, "Bulk DNC");
    }
    return { affected: rows.length };
  }
  if (!input.agentId) throw badRequest("agentId is required to reassign");
  await db
    .update(contactPool)
    .set({ assignedToAgentId: input.agentId, assignedAt: new Date(), status: "assigned" })
    .where(
      and(
        eq(contactPool.orgId, SINGLE_TENANT_ORG_ID),
        inArray(contactPool.contactId, input.contactIds),
        sql`${contactPool.status} in ('assigned', 'callback', 'called')`,
      ),
    );
  const moved = await db
    .update(agentCallingData)
    .set({ agentId: input.agentId })
    .where(
      and(
        inArray(agentCallingData.contactPoolId, input.contactIds),
        sql`${agentCallingData.deletedAt} IS NULL`,
      ),
    )
    .returning({ recordId: agentCallingData.recordId });
  return { affected: moved.length };
}

export async function exportContactsCsv(query: {
  status?: string;
  city?: string;
  agentId?: string;
  batchId?: string;
}) {
  const listed = await listPool({ ...query, page: 1, pageSize: 20_000 });
  const headers = [
    "contact_id",
    "name",
    "phone",
    "city",
    "locality",
    "budget",
    "property_type",
    "bedrooms",
    "status",
    "assigned_to_agent_id",
    "batch_id",
    "created_at",
  ];
  return toCsv(
    headers,
    listed.items.map((row) => [
      row.contactId,
      row.name,
      row.phone,
      row.city,
      row.locality,
      row.budgetLabel ?? row.budget,
      row.propertyType,
      row.bedrooms,
      row.status,
      row.assignedToAgentId,
      row.uploadBatchId,
      row.createdAt.toISOString(),
    ]),
  );
}
