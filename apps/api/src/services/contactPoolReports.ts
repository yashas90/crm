import { contactPoolSettings } from "@propninja/db";
import { getIstDayBounds, getIstMonthBounds, getIstWeekBounds } from "@propninja/types/ist";
import { eq, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { sqlRows } from "../lib/contactPool/sql.js";
import { getDb } from "../lib/db.js";

export async function poolReport() {
  const db = getDb();
  const batches = sqlRows(
    await db.execute(sql`
      SELECT b.batch_id, b.batch_name, b.uploaded_at, b.valid_records, b.total_records,
        count(*) FILTER (WHERE p.status = 'interested')::int AS interested,
        count(*)::int AS contacts
      FROM upload_batches b
      LEFT JOIN contact_pool p ON p.upload_batch_id = b.batch_id
      WHERE b.org_id = ${SINGLE_TENANT_ORG_ID}::uuid
      GROUP BY b.batch_id
      ORDER BY b.uploaded_at DESC
      LIMIT 50
    `),
  );
  const { start } = getIstDayBounds(-6);
  const pace = sqlRows(
    await db.execute(sql`
      SELECT count(*)::int AS assigned
      FROM contact_pool
      WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid
        AND assigned_at >= ${start}
        AND status <> 'unassigned'
    `),
  );
  const [unassigned] = sqlRows(
    await db.execute(sql`
      SELECT count(*)::int AS count FROM contact_pool
      WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid AND status = 'unassigned'
    `),
  );
  const assigned7d = Number(pace[0]?.assigned ?? 0);
  const perDay = assigned7d / 7;
  const left = Number(unassigned?.count ?? 0);
  return {
    batches: batches.map((row) => ({
      ...row,
      interestRate:
        Number(row.contacts) === 0
          ? 0
          : Math.round((1000 * Number(row.interested)) / Number(row.contacts)) / 10,
    })),
    assignedLast7Days: assigned7d,
    unassigned: left,
    daysUntilEmpty: perDay <= 0 ? null : Math.round((10 * left) / perDay) / 10,
  };
}

export async function overallReport(range: "day" | "week" | "month" = "day") {
  const db = getDb();
  const bounds =
    range === "month"
      ? getIstMonthBounds()
      : range === "week"
        ? getIstWeekBounds()
        : getIstDayBounds(0);
  const [totals] = sqlRows(
    await db.execute(sql`
      SELECT
        count(*)::int AS calls,
        count(*) FILTER (WHERE outcome = 'interested')::int AS interested,
        COALESCE(avg(duration_seconds), 0)::int AS avg_duration
      FROM contact_call_logs
      WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid AND called_at >= ${bounds.start}
    `),
  );
  const hours = sqlRows(
    await db.execute(sql`
      SELECT extract(hour FROM called_at AT TIME ZONE 'Asia/Kolkata')::int AS hour,
        count(*)::int AS calls,
        count(*) FILTER (WHERE outcome IN ('interested', 'callback'))::int AS positive
      FROM contact_call_logs
      WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid AND called_at >= ${bounds.start}
      GROUP BY 1
      ORDER BY 1
    `),
  );
  const [settings] = await db
    .select({ cost: contactPoolSettings.costPerContact })
    .from(contactPoolSettings)
    .where(eq(contactPoolSettings.orgId, SINGLE_TENANT_ORG_ID))
    .limit(1);
  const calls = Number(totals?.calls ?? 0);
  const interested = Number(totals?.interested ?? 0);
  const cost = settings?.cost != null ? Number(settings.cost) : null;
  return {
    range,
    totalCalls: calls,
    totalInterested: interested,
    averageDurationSeconds: Number(totals?.avg_duration ?? 0),
    costPerLead: cost == null || interested === 0 ? null : Math.round((cost * calls) / interested),
    hours,
    bestHour: hours.reduce<{ hour: number; rate: number } | null>((best, row) => {
      const callCount = Number(row.calls);
      if (callCount < 3) return best;
      const rate = Number(row.positive) / callCount;
      if (!best || rate > best.rate) return { hour: Number(row.hour), rate };
      return best;
    }, null),
  };
}

export async function agentRangeReport(agentId: string, range: "day" | "week" | "month" = "day") {
  const db = getDb();
  const bounds =
    range === "month"
      ? getIstMonthBounds()
      : range === "week"
        ? getIstWeekBounds()
        : getIstDayBounds(0);
  const [row] = sqlRows(
    await db.execute(sql`
      SELECT
        count(*)::int AS called,
        count(*) FILTER (WHERE outcome = 'interested')::int AS interested,
        count(*) FILTER (WHERE outcome = 'not_interested')::int AS not_interested,
        count(*) FILTER (WHERE outcome = 'callback')::int AS callbacks,
        count(*) FILTER (WHERE outcome = 'no_answer')::int AS no_answer,
        count(*) FILTER (WHERE outcome = 'busy')::int AS busy,
        count(*) FILTER (WHERE outcome = 'invalid')::int AS invalid,
        count(*) FILTER (WHERE outcome = 'dnc')::int AS dnc,
        count(*) FILTER (WHERE lead_created)::int AS leads_created,
        COALESCE(avg(duration_seconds), 0)::int AS avg_duration
      FROM contact_call_logs
      WHERE agent_id = ${agentId}::uuid AND called_at >= ${bounds.start}
    `),
  );
  const called = Number(row?.called ?? 0);
  const interested = Number(row?.interested ?? 0);
  const [requested] = sqlRows(
    await db.execute(sql`
      SELECT COALESCE(sum(contacts_assigned), 0)::int AS requested
      FROM agent_data_requests
      WHERE agent_id = ${agentId}::uuid AND requested_at >= ${bounds.start}
    `),
  );
  return {
    range,
    contactsRequested: Number(requested?.requested ?? 0),
    contactsCalled: called,
    outcomes: row ?? {},
    leadsCreated: Number(row?.leads_created ?? 0),
    averageDurationSeconds: Number(row?.avg_duration ?? 0),
    conversionRate: called === 0 ? 0 : Math.round((1000 * interested) / called) / 10,
  };
}
