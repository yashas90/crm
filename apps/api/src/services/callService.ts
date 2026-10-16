import { callRecords, leadActivities, leads, users } from "@propninja/db";
import { classifyCall } from "@propninja/types/call-metrics";
import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { excludeDuplicateCallRecordSql } from "../lib/callTalkTime.js";
import { aggregateCombinedCalls } from "../lib/combinedCallStats.js";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { notFound } from "../lib/errors.js";
import { loadCombinedCallEvents } from "../lib/loadCombinedCallEvents.js";
import { promoteNewLeadToContacted } from "../lib/promoteNewLead.js";
import { recalculateLeadScore } from "../services/leadScoringService.js";

type CallDirection = "incoming" | "outgoing";
type CallStatus = "completed" | "missed" | "rejected" | "failed";
type CallSource = "mobile-manual" | "mobile-auto" | "web-manual" | "mobile-dialpad";

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
  where.push(excludeDuplicateCallRecordSql());

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

    // Do not auto-create "Call back" tasks on no_answer/busy/voicemail.
    // Agents schedule follow-ups explicitly via nextFollowupAt / Tasks.
    const followUpTask = null;

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

    const items = rows.map((row) => {
      const metric = classifyCall({
        direction: row.call.direction,
        durationSeconds: row.call.durationSeconds,
        outcome: row.call.outcome,
        disposition: row.call.disposition,
        status: row.call.status,
      });
      return {
        ...row.call,
        metricStatus: metric.kind,
        talkSeconds: metric.talkSeconds,
        userName: row.user?.name ?? null,
        user: row.user ? { id: row.user.id, name: row.user.name, email: row.user.email } : null,
        lead: row.lead
          ? {
              id: row.lead.id,
              leadCode: row.lead.leadCode,
              firstName: row.lead.firstName,
              lastName: row.lead.lastName,
              phone: row.lead.phone,
            }
          : null,
      };
    });

    return {
      items,
      page,
      pageSize,
      total: Number(count),
    };
  },

  async getSummary(params: CallSummaryParams) {
    const { userId, dateFrom, dateTo } = params;
    const from = dateFrom ?? new Date(0);
    const to = dateTo ?? new Date();
    const userIds = userId
      ? [userId]
      : (
          await db.select({ id: users.id }).from(users).where(eq(users.orgId, SINGLE_TENANT_ORG_ID))
        ).map((row) => row.id);

    const events = await loadCombinedCallEvents(db, {
      from,
      to,
      userIds,
      includeDataCalls: true,
      includeDeviceCalls: true,
    });
    const { byUser, totals } = aggregateCombinedCalls(events);
    const unanswered = totals.incomingMissed + totals.outgoingNotConnected;

    return {
      total_calls: totals.totalCalls,
      completed_calls: totals.connected,
      answered_calls: totals.connected,
      missed_calls: unanswered,
      average_duration: totals.avgTalkTimeSeconds,
      total_talk_time_seconds: totals.totalTalkTimeSeconds,
      calls_by_user: [...byUser.entries()].map(([id, stats]) => ({
        user_id: id,
        total: stats.totalCalls,
        completed: stats.connected,
        answered: stats.connected,
        missed: stats.incomingMissed + stats.outgoingNotConnected,
        average_duration: stats.avgTalkTimeSeconds,
      })),
    };
  },
};
