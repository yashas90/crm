import {
  agentCallingData,
  agentDailyLimits,
  auditLogs,
  contactCallLogs,
  contactPool,
  dncPhones,
  leadActivities,
  leads,
  users,
} from "@propninja/db";
import { getIstDateKey, getIstDayBounds } from "@propninja/types/ist";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import {
  type CallOutcome,
  type PipelineStage,
  decideCallOutcome,
  pipelineStageToLeadStatus,
} from "../lib/contactPool/outcomeRules.js";
import { phoneHash, sanitizeText, splitPersonName } from "../lib/contactPool/sanitize.js";
import { sqlRows, toCsv } from "../lib/contactPool/sql.js";
import type { Database } from "../lib/db.js";
import { getDb } from "../lib/db.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { formatLeadCode, isLeadCodeUniqueViolation } from "../lib/leadCode.js";
import { sqlTimestamptz } from "../lib/sqlTimestamp.js";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function listCallingData(input: {
  agentId: string;
  search?: string;
  asAdmin?: boolean;
}) {
  const db = getDb();
  const clauses = [
    sql`ac.org_id = ${SINGLE_TENANT_ORG_ID}::uuid`,
    sql`ac.deleted_at IS NULL`,
    sql`ac.agent_id = ${input.agentId}::uuid`,
  ];
  if (input.search) {
    const term = `%${input.search}%`;
    clauses.push(sql`(ac.name ILIKE ${term} OR ac.phone ILIKE ${term} OR ac.city ILIKE ${term})`);
  }
  const { start, end } = getIstDayBounds(0);
  const rows = sqlRows(
    await db.execute(sql`
      SELECT ac.*
      FROM agent_calling_data ac
      WHERE ${sql.join(clauses, sql` AND `)}
      ORDER BY
        CASE
          WHEN ac.status = 'callback' AND ac.callback_scheduled_at < ${sqlTimestamptz(start)} THEN 0
          WHEN ac.status = 'callback' AND ac.callback_scheduled_at <= ${sqlTimestamptz(end)} THEN 1
          WHEN ac.status = 'callback' THEN 2
          WHEN ac.status = 'pending' THEN 3
          WHEN ac.status = 'retry' THEN 4
          ELSE 5
        END,
        ac.callback_scheduled_at ASC NULLS LAST,
        ac.assigned_at ASC
    `),
  );
  return rows.map(mapCallingRow);
}

export async function callingStats(agentId: string) {
  const db = getDb();
  const dateKey = getIstDateKey();
  const { start } = getIstDayBounds(0);
  const [row] = sqlRows(
    await db.execute(sql`
      SELECT
        COALESCE((
          SELECT contacts_requested_today FROM agent_daily_limits
          WHERE agent_id = ${agentId}::uuid AND date = ${dateKey}::date
        ), 0)::int AS assigned_today,
        COALESCE((
          SELECT count(*) FROM contact_call_logs
          WHERE agent_id = ${agentId}::uuid AND called_at >= ${sqlTimestamptz(start)}
        ), 0)::int AS called_today,
        COALESCE((
          SELECT count(*) FROM agent_calling_data
          WHERE agent_id = ${agentId}::uuid AND deleted_at IS NULL AND status = 'pending'
        ), 0)::int AS pending,
        COALESCE((
          SELECT count(*) FROM agent_calling_data
          WHERE agent_id = ${agentId}::uuid AND deleted_at IS NULL AND status = 'retry'
        ), 0)::int AS retry,
        COALESCE((
          SELECT count(*) FROM agent_calling_data
          WHERE agent_id = ${agentId}::uuid AND deleted_at IS NULL AND status = 'callback'
        ), 0)::int AS callbacks,
        COALESCE((
          SELECT count(*) FROM agent_calling_data
          WHERE agent_id = ${agentId}::uuid AND deleted_at >= ${sqlTimestamptz(start)}
        ), 0)::int AS deleted_today,
        COALESCE((
          SELECT count(*) FROM agent_calling_data
          WHERE agent_id = ${agentId}::uuid
            AND deleted_reason = 'converted_to_lead'
            AND deleted_at >= ${sqlTimestamptz(start)}
        ), 0)::int AS converted_today,
        COALESCE((
          SELECT count(*) FROM agent_calling_data
          WHERE agent_id = ${agentId}::uuid AND deleted_at IS NULL
        ), 0)::int AS remaining
    `),
  );
  return {
    assignedToday: Number(row?.assigned_today ?? 0),
    calledToday: Number(row?.called_today ?? 0),
    pending: Number(row?.pending ?? 0),
    retry: Number(row?.retry ?? 0),
    callbacks: Number(row?.callbacks ?? 0),
    deletedToday: Number(row?.deleted_today ?? 0),
    convertedToday: Number(row?.converted_today ?? 0),
    remaining: Number(row?.remaining ?? 0),
    badge: Number(row?.pending ?? 0) + Number(row?.callbacks ?? 0),
  };
}

export async function logOutcome(input: {
  agentId: string;
  recordId: string;
  outcome: CallOutcome;
  notes?: string | null;
  callbackTime?: string | null;
  durationSeconds?: number;
}) {
  const db = getDb();
  const notes = sanitizeText(input.notes, 2000) || null;
  const callbackAt = input.callbackTime ? new Date(input.callbackTime) : null;
  if (input.outcome === "callback" && (!callbackAt || Number.isNaN(callbackAt.getTime()))) {
    throw badRequest("Callback time is required");
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.transaction(async (tx) =>
        applyOutcome(tx, input, notes, callbackAt, attempt),
      );
    } catch (error) {
      lastError = error;
      if (!isLeadCodeUniqueViolation(error)) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : badRequest("Could not save the outcome");
}

async function applyOutcome(
  tx: Tx,
  input: {
    agentId: string;
    recordId: string;
    outcome: CallOutcome;
    durationSeconds?: number;
  },
  notes: string | null,
  callbackAt: Date | null,
  codeOffset: number,
) {
  const locked = sqlRows(
    await tx.execute(sql`
      SELECT *
      FROM agent_calling_data
      WHERE record_id = ${input.recordId}::uuid
      FOR UPDATE
    `),
  );
  const row = locked[0];
  if (!row || row.deleted_at) throw notFound("Calling contact not found");
  if (String(row.agent_id) !== input.agentId) {
    throw forbidden("You can only update your own calling data");
  }

  const plan = decideCallOutcome(input.outcome, Number(row.call_attempts ?? 0));
  const now = new Date();
  let leadId: string | null = null;
  let leadCode: string | null = null;

  if (plan.createLead) {
    const existing = await findOpenLead(tx, String(row.phone));
    if (existing) {
      throw badRequest(
        `This number is already a lead (${existing.leadCode}). Skip or view lead?`,
        { leadId: existing.id, leadCode: existing.leadCode },
        "ALREADY_A_LEAD",
      );
    }
  }

  // Soft-delete calling data before inserting the lead so the phone is never in both buckets.
  await tx
    .update(agentCallingData)
    .set({
      status: plan.callingStatus,
      callAttempts: plan.nextAttempts,
      lastCalledAt: now,
      callbackScheduledAt:
        input.outcome === "callback"
          ? callbackAt
          : row.callback_scheduled_at
            ? new Date(String(row.callback_scheduled_at))
            : null,
      callbackNotifiedAt: input.outcome === "callback" ? null : undefined,
      callNotes: notes,
      deletedAt: plan.softDelete ? now : null,
      deletedReason: plan.deletedReason,
    })
    .where(eq(agentCallingData.recordId, input.recordId));

  await tx
    .update(contactPool)
    .set({
      status: plan.poolStatus,
      calledAt: now,
      callOutcome: plan.poolCallOutcome,
    })
    .where(eq(contactPool.contactId, String(row.contact_pool_id)));

  if (plan.createLead) {
    const created = await insertQualifiedLead(tx, row, input.agentId, codeOffset);
    leadId = created.id;
    leadCode = created.leadCode;
  }

  if (input.outcome === "dnc" || input.outcome === "invalid") {
    await tx
      .insert(dncPhones)
      .values({
        orgId: SINGLE_TENANT_ORG_ID,
        phone: String(row.phone),
        phoneHash: phoneHash(String(row.phone)),
        reason: input.outcome === "dnc" ? "Agent marked DNC" : "Invalid number",
        createdBy: input.agentId,
      })
      .onConflictDoNothing({ target: [dncPhones.orgId, dncPhones.phone] });
  }

  const dateKey = getIstDateKey(now);
  const { start } = getIstDayBounds(0, now);
  const prior = sqlRows(
    await tx.execute(sql`
      SELECT 1 FROM contact_call_logs
      WHERE contact_id = ${String(row.contact_pool_id)}::uuid
        AND agent_id = ${input.agentId}::uuid
        AND called_at >= ${sqlTimestamptz(start)}
      LIMIT 1
    `),
  );
  await tx.insert(contactCallLogs).values({
    orgId: SINGLE_TENANT_ORG_ID,
    contactId: String(row.contact_pool_id),
    agentId: input.agentId,
    recordId: input.recordId,
    calledAt: now,
    durationSeconds: input.durationSeconds ?? 0,
    outcome: input.outcome,
    callbackScheduledAt: input.outcome === "callback" ? callbackAt : null,
    notes,
    leadCreated: Boolean(leadId),
    leadId,
  });
  if (prior.length === 0) {
    await tx.execute(sql`
      UPDATE agent_daily_limits
      SET contacts_called_today = contacts_called_today + 1
      WHERE agent_id = ${input.agentId}::uuid AND date = ${dateKey}::date
    `);
  }

  if (plan.softDelete && plan.deletedReason) {
    await tx.insert(auditLogs).values({
      userId: input.agentId,
      action: "CALLING_DATA_DELETED",
      entityType: "agent_calling_data",
      entityId: input.recordId,
      entityName: String(row.name),
      metadata: { reason: plan.deletedReason, outcome: input.outcome, leadId, leadCode },
    });
  }

  const message = leadCode ? `Lead ${leadCode} created` : plan.message;
  return {
    removed: plan.softDelete,
    keepVisible: plan.keepVisible,
    callingStatus: plan.callingStatus,
    deletedReason: plan.deletedReason,
    callAttempts: plan.nextAttempts,
    leadId,
    leadCode,
    message,
    bucketsAfter: plan.bucketsAfter,
  };
}

async function findOpenLead(tx: Tx, phone: string) {
  const rows = sqlRows(
    await tx.execute(sql`
      SELECT id, lead_code
      FROM leads
      WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid
        AND deleted_at IS NULL
        AND right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10)
          = right(regexp_replace(${phone}, '\\D', '', 'g'), 10)
      LIMIT 1
    `),
  );
  const row = rows[0];
  if (!row) return null;
  return { id: String(row.id), leadCode: String(row.lead_code) };
}

async function insertQualifiedLead(
  tx: Tx,
  row: Record<string, unknown>,
  agentId: string,
  codeOffset: number,
) {
  const codeRows = sqlRows(
    await tx.execute(sql`
      SELECT COALESCE(MAX(
        CASE WHEN lead_code ~ '^PROP-[0-9]+$'
          THEN cast(substring(lead_code from 6) as integer)
          ELSE NULL END
      ), 0)::int AS max_seq
      FROM leads
      WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid
    `),
  );
  const leadCode = formatLeadCode(Number(codeRows[0]?.max_seq ?? 0) + 1 + codeOffset);
  const { firstName, lastName } = splitPersonName(String(row.name ?? ""));
  const pool = sqlRows(
    await tx.execute(sql`
      SELECT email, locality, notes, budget, source
      FROM contact_pool
      WHERE contact_id = ${String(row.contact_pool_id)}::uuid
    `),
  );
  const source = pool[0] ?? {};
  const now = new Date();
  const [created] = await tx
    .insert(leads)
    .values({
      orgId: SINGLE_TENANT_ORG_ID,
      leadCode,
      assignedTo: agentId,
      firstName,
      lastName,
      email: source.email ? String(source.email) : null,
      phone: String(row.phone),
      city: row.city ? String(row.city) : null,
      locality: source.locality ? String(source.locality) : null,
      propertyType: row.property_type ? String(row.property_type) : null,
      bhk: row.bedrooms ? String(row.bedrooms) : null,
      minBudget: source.budget != null ? String(source.budget) : null,
      maxBudget: source.budget != null ? String(source.budget) : null,
      leadSource: "calling_data",
      notes: source.notes ? String(source.notes) : null,
      leadStatus: "new",
      pipelineStage: "new",
      temperature: "hot",
      qualifiedAt: now,
      sourceContactPoolId: String(row.contact_pool_id),
      sourceAgentId: agentId,
      lastActivityAt: now,
    })
    .returning({ id: leads.id, leadCode: leads.leadCode });
  if (!created) throw badRequest("Could not create lead");
  await tx.insert(leadActivities).values({
    leadId: created.id,
    orgId: SINGLE_TENANT_ORG_ID,
    userId: agentId,
    type: "status_change",
    metadata: {
      from: null,
      to: "new",
      pipelineStage: "new",
      source: "calling_data",
      message: "Qualified from calling data",
    },
  });
  return created;
}

function mapCallingRow(row: Record<string, unknown>) {
  return {
    recordId: String(row.record_id),
    contactPoolId: String(row.contact_pool_id),
    agentId: String(row.agent_id),
    name: String(row.name),
    phone: String(row.phone),
    city: row.city ? String(row.city) : null,
    budget: row.budget ? String(row.budget) : null,
    propertyType: row.property_type ? String(row.property_type) : null,
    bedrooms: row.bedrooms ? String(row.bedrooms) : null,
    status: String(row.status),
    callAttempts: Number(row.call_attempts ?? 0),
    lastCalledAt: row.last_called_at ? new Date(String(row.last_called_at)).toISOString() : null,
    callbackScheduledAt: row.callback_scheduled_at
      ? new Date(String(row.callback_scheduled_at)).toISOString()
      : null,
    callNotes: row.call_notes ? String(row.call_notes) : null,
    assignedAt: new Date(String(row.assigned_at)).toISOString(),
  };
}

const CALLING_LEAD = sql`${leads.leadSource} = 'calling_data' OR ${leads.sourceContactPoolId} IS NOT NULL`;

export async function listAgentLeads(input: {
  agentId: string;
  stage?: string;
  priority?: string;
  search?: string;
  anyAgent?: boolean;
}) {
  const db = getDb();
  const filters = [
    eq(leads.orgId, SINGLE_TENANT_ORG_ID),
    sql`${leads.deletedAt} IS NULL`,
    CALLING_LEAD,
  ];
  if (!input.anyAgent) filters.push(eq(leads.assignedTo, input.agentId));
  else if (input.agentId) filters.push(eq(leads.assignedTo, input.agentId));
  if (input.stage) filters.push(eq(leads.pipelineStage, input.stage));
  if (input.priority) filters.push(eq(leads.temperature, input.priority));
  if (input.search) {
    const term = `%${input.search}%`;
    const search = or(
      ilike(leads.firstName, term),
      ilike(leads.lastName, term),
      ilike(leads.phone, term),
      ilike(leads.leadCode, term),
    );
    if (search) filters.push(search);
  }
  const rows = await db
    .select({ lead: leads, agentName: users.name })
    .from(leads)
    .leftJoin(users, eq(leads.assignedTo, users.id))
    .where(and(...filters))
    .orderBy(desc(leads.qualifiedAt));
  return rows.map((row) => ({ ...mapLead(row.lead), agentName: row.agentName }));
}

export async function getAgentLead(agentId: string, leadId: string, asAdmin = false) {
  const db = getDb();
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.orgId, SINGLE_TENANT_ORG_ID)))
    .limit(1);
  if (!lead || lead.deletedAt) throw notFound("Lead not found");
  if (!asAdmin && lead.assignedTo !== agentId) throw forbidden("You can only open your own leads");
  const activity = await db
    .select()
    .from(leadActivities)
    .where(eq(leadActivities.leadId, leadId))
    .orderBy(desc(leadActivities.createdAt));
  return {
    ...mapLead(lead),
    notes: lead.notes,
    email: lead.email,
    locality: lead.locality,
    activities: activity.map((item) => ({
      id: item.id,
      type: item.type,
      metadata: item.metadata ?? {},
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

export async function updateLeadStage(input: {
  agentId: string;
  leadId: string;
  stage: PipelineStage;
  priority?: "hot" | "warm" | "cold";
  asAdmin?: boolean;
}) {
  const db = getDb();
  const lead = await assertLeadAccess(input.agentId, input.leadId, input.asAdmin ?? false);
  const leadStatus = pipelineStageToLeadStatus(input.stage);
  const [updated] = await db
    .update(leads)
    .set({
      pipelineStage: input.stage,
      leadStatus,
      temperature: input.priority ?? lead.temperature,
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    })
    .where(eq(leads.id, input.leadId))
    .returning();
  await db.insert(leadActivities).values({
    leadId: input.leadId,
    orgId: SINGLE_TENANT_ORG_ID,
    userId: input.agentId,
    type: "status_change",
    metadata: { from: lead.pipelineStage, to: input.stage, leadStatus },
  });
  return mapLead(updated!);
}

export async function addLeadActivity(input: {
  agentId: string;
  leadId: string;
  type: "call" | "note" | "meeting" | "site_visit" | "follow_up";
  notes?: string;
  asAdmin?: boolean;
}) {
  const db = getDb();
  await assertLeadAccess(input.agentId, input.leadId, input.asAdmin ?? false);
  const [row] = await db
    .insert(leadActivities)
    .values({
      leadId: input.leadId,
      orgId: SINGLE_TENANT_ORG_ID,
      userId: input.agentId,
      type: input.type,
      metadata: { notes: sanitizeText(input.notes, 2000) },
    })
    .returning();
  await db
    .update(leads)
    .set({ lastActivityAt: new Date(), updatedAt: new Date() })
    .where(eq(leads.id, input.leadId));
  return {
    id: row!.id,
    type: row!.type,
    metadata: row!.metadata ?? {},
    createdAt: row!.createdAt.toISOString(),
  };
}

async function assertLeadAccess(agentId: string, leadId: string, asAdmin: boolean) {
  const db = getDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead || lead.deletedAt) throw notFound("Lead not found");
  if (!asAdmin && lead.assignedTo !== agentId)
    throw forbidden("You can only update your own leads");
  return lead;
}

export async function agentLeadStats(agentId: string) {
  const db = getDb();
  const rows = sqlRows(
    await db.execute(sql`
      SELECT pipeline_stage, temperature, count(*)::int AS count
      FROM leads
      WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid
        AND deleted_at IS NULL
        AND assigned_to = ${agentId}::uuid
        AND (lead_source = 'calling_data' OR source_contact_pool_id IS NOT NULL)
      GROUP BY pipeline_stage, temperature
    `),
  );
  let total = 0;
  let hot = 0;
  const byStage: Record<string, number> = {};
  for (const row of rows) {
    const count = Number(row.count);
    total += count;
    if (row.temperature === "hot") hot += count;
    const stage = String(row.pipeline_stage ?? "new");
    byStage[stage] = (byStage[stage] ?? 0) + count;
  }
  return { total, hot, byStage };
}

const DELETION_REASON_LABELS: { reason: string; label: string }[] = [
  { reason: "not_interested", label: "Not interested" },
  { reason: "invalid_number", label: "Invalid" },
  { reason: "dnc", label: "DNC" },
  { reason: "max_attempts_reached", label: "Max attempts reached" },
  { reason: "converted_to_lead", label: "Converted to lead" },
];

function countOf(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function adminCallingOverview() {
  const db = getDb();
  const callingLead = sql.raw(
    "(lead_source = 'calling_data' OR source_contact_pool_id IS NOT NULL)",
  );
  const agents = sqlRows(
    await db.execute(sql`
      SELECT u.id AS agent_id, u.name AS agent_name,
        COALESCE(ac.active, 0)::int AS active,
        COALESCE(ac.pending, 0)::int AS pending,
        COALESCE(ac.callbacks, 0)::int AS callbacks,
        COALESCE(ac.removed, 0)::int AS removed,
        COALESCE(calls.attempts, 0)::int AS attempts,
        COALESCE(calls.called_contacts, 0)::int AS called_contacts,
        COALESCE(calls.interested, 0)::int AS interested,
        COALESCE(q.qualified, 0)::int AS qualified
      FROM users u
      LEFT JOIN (
        SELECT agent_id,
          count(*) FILTER (WHERE deleted_at IS NULL)::int AS active,
          count(*) FILTER (WHERE deleted_at IS NULL AND status = 'pending')::int AS pending,
          count(*) FILTER (WHERE deleted_at IS NULL AND status = 'callback')::int AS callbacks,
          count(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS removed
        FROM agent_calling_data
        WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid
        GROUP BY agent_id
      ) ac ON ac.agent_id = u.id
      LEFT JOIN (
        SELECT agent_id,
          count(*)::int AS attempts,
          count(DISTINCT contact_id)::int AS called_contacts,
          count(*) FILTER (WHERE outcome = 'interested')::int AS interested
        FROM contact_call_logs
        WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid
        GROUP BY agent_id
      ) calls ON calls.agent_id = u.id
      LEFT JOIN (
        SELECT assigned_to AS agent_id, count(*)::int AS qualified
        FROM leads
        WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid
          AND deleted_at IS NULL
          AND ${callingLead}
        GROUP BY assigned_to
      ) q ON q.agent_id = u.id
      WHERE u.org_id = ${SINGLE_TENANT_ORG_ID}::uuid AND u.role = 'agent' AND u.is_active = true
      ORDER BY u.name
    `),
  );
  const [totals] = sqlRows(
    await db.execute(sql`
      SELECT
        COALESCE((SELECT count(*) FROM contact_call_logs WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid), 0)::int AS attempts,
        COALESCE((SELECT count(DISTINCT contact_id) FROM contact_call_logs WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid), 0)::int AS called_contacts,
        COALESCE((SELECT count(*) FROM agent_calling_data WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid AND deleted_at IS NULL AND status = 'pending'), 0)::int AS pending,
        COALESCE((SELECT count(*) FROM agent_calling_data WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid AND deleted_at IS NULL AND status = 'callback'), 0)::int AS callbacks,
        COALESCE((SELECT count(*) FROM agent_calling_data WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid AND deleted_at IS NULL), 0)::int AS active,
        COALESCE((SELECT count(*) FROM agent_calling_data WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid AND deleted_at IS NOT NULL), 0)::int AS removed,
        COALESCE((SELECT count(*) FROM contact_call_logs WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid AND outcome = 'interested'), 0)::int AS interested,
        COALESCE((
          SELECT count(*) FROM leads
          WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid AND deleted_at IS NULL AND ${callingLead}
        ), 0)::int AS qualified,
        COALESCE((SELECT count(*) FROM contact_call_logs WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid AND outcome = 'not_interested'), 0)::int AS not_interested,
        COALESCE((SELECT count(*) FROM contact_call_logs WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid AND outcome = 'callback'), 0)::int AS outcome_callback,
        COALESCE((SELECT count(*) FROM contact_call_logs WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid AND outcome = 'no_answer'), 0)::int AS no_answer,
        COALESCE((SELECT count(*) FROM contact_call_logs WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid AND outcome = 'busy'), 0)::int AS busy,
        COALESCE((SELECT count(*) FROM contact_call_logs WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid AND outcome = 'invalid'), 0)::int AS invalid,
        COALESCE((SELECT count(*) FROM contact_call_logs WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid AND outcome = 'dnc'), 0)::int AS dnc
    `),
  );
  const reasonRows = sqlRows(
    await db.execute(sql`
      SELECT COALESCE(deleted_reason, 'unknown') AS reason, count(*)::int AS count
      FROM agent_calling_data
      WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid AND deleted_at IS NOT NULL
      GROUP BY deleted_reason
    `),
  );
  const reasonCounts = new Map(reasonRows.map((row) => [String(row.reason), countOf(row.count)]));
  const deletionReasons = DELETION_REASON_LABELS.map((item) => ({
    reason: item.reason,
    label: item.label,
    count: reasonCounts.get(item.reason) ?? 0,
  }));
  for (const [reason, count] of reasonCounts) {
    if (!DELETION_REASON_LABELS.some((item) => item.reason === reason)) {
      deletionReasons.push({ reason, label: reason, count });
    }
  }
  const row = totals ?? {};
  return {
    totals: {
      attempts: countOf(row.attempts),
      calledContacts: countOf(row.called_contacts),
      pending: countOf(row.pending),
      callbacks: countOf(row.callbacks),
      active: countOf(row.active),
      removed: countOf(row.removed),
      interested: countOf(row.interested),
      qualified: countOf(row.qualified),
      outcomes: {
        interested: countOf(row.interested),
        not_interested: countOf(row.not_interested),
        callback: countOf(row.outcome_callback),
        no_answer: countOf(row.no_answer),
        busy: countOf(row.busy),
        invalid: countOf(row.invalid),
        dnc: countOf(row.dnc),
      },
    },
    agents: agents.map((agent) => ({
      agentId: String(agent.agent_id),
      agentName: String(agent.agent_name),
      active: countOf(agent.active),
      pending: countOf(agent.pending),
      callbacks: countOf(agent.callbacks),
      removed: countOf(agent.removed),
      attempts: countOf(agent.attempts),
      calledContacts: countOf(agent.called_contacts),
      interested: countOf(agent.interested),
      qualified: countOf(agent.qualified),
    })),
    deletionReasons,
  };
}

export async function adminLeadsOverview() {
  const db = getDb();
  const stages = sqlRows(
    await db.execute(sql`
      SELECT COALESCE(pipeline_stage, 'new') AS stage, count(*)::int AS count
      FROM leads
      WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid
        AND deleted_at IS NULL
        AND (lead_source = 'calling_data' OR source_contact_pool_id IS NOT NULL)
      GROUP BY pipeline_stage
    `),
  );
  const [hot] = sqlRows(
    await db.execute(sql`
      SELECT count(*)::int AS count
      FROM leads
      WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid
        AND deleted_at IS NULL
        AND temperature = 'hot'
        AND (lead_source = 'calling_data' OR source_contact_pool_id IS NOT NULL)
    `),
  );
  const [assigned] = sqlRows(
    await db.execute(sql`
      SELECT count(*)::int AS count FROM contact_pool
      WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid AND status <> 'unassigned'
    `),
  );
  const items = sqlRows(
    await db.execute(sql`
      SELECT l.lead_code, l.first_name, l.last_name, l.phone, l.qualified_at, u.name AS agent_name
      FROM leads l
      LEFT JOIN users u ON u.id = l.assigned_to
      WHERE l.org_id = ${SINGLE_TENANT_ORG_ID}::uuid
        AND l.deleted_at IS NULL
        AND (l.lead_source = 'calling_data' OR l.source_contact_pool_id IS NOT NULL)
      ORDER BY l.qualified_at DESC NULLS LAST, l.created_at DESC
      LIMIT 100
    `),
  );
  const leadCount = stages.reduce((sum, row) => sum + Number(row.count), 0);
  const assignedCount = Number(assigned?.count ?? 0);
  return {
    stages,
    hot: Number(hot?.count ?? 0),
    leads: leadCount,
    assignedContacts: assignedCount,
    conversionPercent:
      assignedCount === 0 ? 0 : Math.round((1000 * leadCount) / assignedCount) / 10,
    items: items.map((row) => ({
      leadCode: String(row.lead_code),
      name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Unknown",
      phone: row.phone ? String(row.phone) : null,
      agentName: row.agent_name ? String(row.agent_name) : null,
      qualifiedAt: row.qualified_at ? new Date(String(row.qualified_at)).toISOString() : null,
    })),
  };
}

export async function reassignLead(adminId: string, leadId: string, agentId: string) {
  const db = getDb();
  const [agent] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, agentId), eq(users.role, "agent")))
    .limit(1);
  if (!agent) throw notFound("Agent not found");
  const [lead] = await db
    .update(leads)
    .set({ assignedTo: agentId, updatedAt: new Date() })
    .where(and(eq(leads.id, leadId), eq(leads.orgId, SINGLE_TENANT_ORG_ID)))
    .returning();
  if (!lead) throw notFound("Lead not found");
  await db.insert(leadActivities).values({
    leadId,
    orgId: SINGLE_TENANT_ORG_ID,
    userId: adminId,
    type: "assignment_change",
    metadata: { assignedTo: agentId },
  });
  await db.insert(auditLogs).values({
    userId: adminId,
    action: "LEAD_ASSIGNED",
    entityType: "lead",
    entityId: leadId,
    entityName: lead.leadCode,
    metadata: { agentId },
  });
  return mapLead(lead);
}

export async function exportLeadsCsv(agentId?: string) {
  const rows = await listAgentLeads({
    agentId: agentId ?? "",
    anyAgent: !agentId,
  });
  return toCsv(
    ["lead_code", "name", "phone", "city", "stage", "priority", "budget", "qualified_at"],
    rows.map((row) => [
      row.leadCode,
      row.name,
      row.phone,
      row.city,
      row.pipelineStage,
      row.priority,
      row.budget,
      row.qualifiedAt,
    ]),
  );
}

function mapLead(lead: typeof leads.$inferSelect) {
  const qualifiedAt = lead.qualifiedAt?.toISOString() ?? null;
  const days = lead.qualifiedAt
    ? Math.max(0, Math.floor((Date.now() - lead.qualifiedAt.getTime()) / 86_400_000))
    : null;
  return {
    id: lead.id,
    leadCode: lead.leadCode,
    name: `${lead.firstName} ${lead.lastName}`.trim(),
    firstName: lead.firstName,
    lastName: lead.lastName,
    phone: lead.phone,
    city: lead.city,
    budget: lead.maxBudget ?? lead.minBudget,
    propertyType: lead.propertyType,
    bedrooms: lead.bhk,
    pipelineStage: lead.pipelineStage ?? "new",
    leadStatus: lead.leadStatus,
    priority: lead.temperature ?? "hot",
    qualifiedAt,
    qualifiedDaysAgo: days,
    assignedTo: lead.assignedTo,
    sourceContactPoolId: lead.sourceContactPoolId,
  };
}

export async function listCallbacks(agentId: string) {
  const items = await listCallingData({ agentId });
  return items.filter((item) => item.status === "callback");
}
