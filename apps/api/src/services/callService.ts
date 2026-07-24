import { callRecords, leadActivities, leads, users } from "@propninja/db";
import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { createCallFollowUpTask } from "../lib/callFollowUpTask.js";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { notFound } from "../lib/errors.js";
import { promoteNewLeadToContacted } from "../lib/promoteNewLead.js";
import { recalculateLeadScore } from "../services/leadScoringService.js";

type CallDirection = "incoming" | "outgoing";
type CallStatus = "completed" | "missed" | "rejected" | "failed";
type CallSource = "mobile-manual" | "mobile-auto" | "web-manual";

export interface LogCallInput {
  userId: string;
  leadId?: string;
  phoneNumber: string;
  direction: CallDirection;
  status: CallStatus;
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  disposition: string;
  outcome?: string;
  notes?: string;
  source: CallSource;
}

export interface ListCallsParams {
  userId?: string;
  leadId?: string;
  direction?: CallDirection;
  status?: CallStatus;
  outcome?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  pageSize?: number;
}

export interface CallSummaryParams {
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

function buildWhere(
  params: Pick<
    ListCallsParams,
    "userId" | "leadId" | "direction" | "status" | "outcome" | "dateFrom" | "dateTo"
  >,
) {
  const where = [eq(callRecords.orgId, SINGLE_TENANT_ORG_ID)];

  if (params.userId) where.push(eq(callRecords.userId, params.userId));
  if (params.leadId) where.push(eq(callRecords.leadId, params.leadId));
  if (params.direction) where.push(eq(callRecords.direction, params.direction));
  if (params.status) where.push(eq(callRecords.status, params.status));
  if (params.outcome) where.push(eq(callRecords.outcome, params.outcome));
  if (params.dateFrom) where.push(gte(callRecords.startedAt, params.dateFrom));
  if (params.dateTo) where.push(lte(callRecords.startedAt, params.dateTo));

  return and(...where);
}

export const callService = {
  async logCall(input: LogCallInput) {
    const {
      userId,
      leadId,
      phoneNumber,
      direction,
      status,
      startedAt,
      endedAt,
      durationSeconds,
      disposition,
      outcome,
      notes,
      source,
    } = input;

    let resolvedLeadId = leadId ?? null;

    if (resolvedLeadId) {
      const [lead] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(
          and(
            eq(leads.id, resolvedLeadId),
            eq(leads.orgId, SINGLE_TENANT_ORG_ID),
            isNull(leads.deletedAt),
          ),
        )
        .limit(1);

      if (!lead) {
        throw notFound("Lead not found");
      }
    } else {
      const [foundLead] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(
          and(
            eq(leads.orgId, SINGLE_TENANT_ORG_ID),
            isNull(leads.deletedAt),
            or(eq(leads.phone, phoneNumber), eq(leads.secondaryPhone, phoneNumber)),
          ),
        )
        .limit(1);

      if (foundLead) {
        resolvedLeadId = foundLead.id;
      }
    }

    const [record] = await db
      .insert(callRecords)
      .values({
        orgId: SINGLE_TENANT_ORG_ID,
        userId,
        leadId: resolvedLeadId,
        phoneNumber,
        direction,
        status,
        source,
        startedAt,
        endedAt,
        durationSeconds,
        disposition,
        outcome: input.outcome ?? null,
        notes: notes ?? null,
      })
      .returning();

    let followUpTask = null;

    if (resolvedLeadId) {
      await Promise.all([
        db
          .update(leads)
          .set({ lastContactedAt: endedAt, lastActivityAt: endedAt, updatedAt: new Date() })
          .where(and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), eq(leads.id, resolvedLeadId))),

        db.insert(leadActivities).values({
          orgId: SINGLE_TENANT_ORG_ID,
          leadId: resolvedLeadId,
          userId,
          type: "call",
          metadata: {
            callRecordId: record!.id,
            direction,
            status,
            durationSeconds,
            disposition,
            outcome: outcome ?? null,
            source,
            phoneNumber,
          },
        }),
      ]);

      if (outcome) {
        followUpTask = await createCallFollowUpTask({
          userId,
          leadId: resolvedLeadId,
          outcome,
          attemptedAt: endedAt,
        });
      }

      // Called/touched without an explicit status update → Pending (contacted).
      await promoteNewLeadToContacted(resolvedLeadId, {
        userId,
        reason: "call_logged",
        at: endedAt,
      });

      void recalculateLeadScore(resolvedLeadId).catch(() => undefined);
    }

    return { ...record!, followUpTask };
  },

  async listCalls(params: ListCallsParams) {
    const {
      userId,
      leadId,
      direction,
      status,
      outcome,
      dateFrom,
      dateTo,
      page = 1,
      pageSize = 20,
    } = params;

    const whereClause = buildWhere({
      userId,
      leadId,
      direction,
      status,
      outcome,
      dateFrom,
      dateTo,
    });
    const offset = (page - 1) * pageSize;

    const [rows, [{ count }]] = await Promise.all([
      db
        .select({
          call: callRecords,
          user: users,
          lead: leads,
        })
        .from(callRecords)
        .leftJoin(users, eq(callRecords.userId, users.id))
        .leftJoin(leads, eq(callRecords.leadId, leads.id))
        .where(whereClause)
        .orderBy(desc(callRecords.startedAt))
        .limit(pageSize)
        .offset(offset),

      db.select({ count: sql<number>`count(*)::int` }).from(callRecords).where(whereClause),
    ]);

    const items = rows.map((row) => ({
      ...row.call,
      userName: row.user?.name ?? null,
      user: row.user ? { id: row.user.id, name: row.user.name, email: row.user.email } : null,
      lead: row.lead
        ? {
            id: row.lead.id,
            firstName: row.lead.firstName,
            lastName: row.lead.lastName,
            phone: row.lead.phone,
          }
        : null,
    }));

    return {
      items,
      page,
      pageSize,
      total: Number(count),
    };
  },

  async getSummary(params: CallSummaryParams) {
    const { userId, dateFrom, dateTo } = params;

    const whereClause = buildWhere({ userId, dateFrom, dateTo });

    const [agg] = await db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${callRecords.status} = 'completed')::int`,
        missed: sql<number>`count(*) filter (where ${callRecords.status} = 'missed')::int`,
        avgDuration: sql<number | null>`avg(${callRecords.durationSeconds})`,
      })
      .from(callRecords)
      .where(whereClause);

    const byUser = await db
      .select({
        userId: callRecords.userId,
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${callRecords.status} = 'completed')::int`,
        missed: sql<number>`count(*) filter (where ${callRecords.status} = 'missed')::int`,
        avgDuration: sql<number | null>`avg(${callRecords.durationSeconds})`,
      })
      .from(callRecords)
      .where(whereClause)
      .groupBy(callRecords.userId);

    return {
      total_calls: Number(agg?.total ?? 0),
      completed_calls: Number(agg?.completed ?? 0),
      missed_calls: Number(agg?.missed ?? 0),
      average_duration: agg?.avgDuration ? Math.round(Number(agg.avgDuration)) : 0,
      calls_by_user: byUser.map((row) => ({
        user_id: row.userId,
        total: Number(row.total),
        completed: Number(row.completed),
        missed: Number(row.missed),
        average_duration: row.avgDuration ? Math.round(Number(row.avgDuration)) : 0,
      })),
    };
  },
};
