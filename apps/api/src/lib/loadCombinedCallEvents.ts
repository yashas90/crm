import { users } from "@propninja/db";
import { type SQL, and, eq, inArray, or, sql } from "drizzle-orm";
import {
  type CombinedCallEvent,
  type CombinedCallStats,
  type DataCallForStats,
  type DeviceCallForStats,
  type LeadCallForStats,
  aggregateCombinedCalls,
  classifyDataCall,
  classifyDeviceCall,
  classifyLeadCall,
} from "./combinedCallStats.js";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";
import { sqlRows, uuidArray } from "./contactPool/sql.js";
import type { Database } from "./db.js";
import { leadSourceLowerVariants } from "./leadSourceAliases.js";
import { sqlTimestamptz } from "./sqlTimestamp.js";

export type LoadCombinedCallEventsInput = {
  from: Date;
  to: Date;
  userIds: string[];
  includeDataCalls: boolean;
  includeDeviceCalls: boolean;
  /** Extra predicate on `call_records`, such as a lead-source exists filter. */
  leadCallFilter?: SQL;
};

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type CombinedCallInputs = {
  lead: LeadCallForStats[];
  data: DataCallForStats[];
  device: DeviceCallForStats[];
};

export async function loadCombinedCallInputs(
  database: Database,
  input: LoadCombinedCallEventsInput,
): Promise<CombinedCallInputs> {
  if (input.userIds.length === 0) return { lead: [], data: [], device: [] };

  const from = sqlTimestamptz(input.from);
  const to = sqlTimestamptz(input.to);
  const userIdList = uuidArray(input.userIds);

  const [leadRows, dataRows, deviceRows] = await Promise.all([
    database.execute(sql`
      select
        user_id,
        phone_number,
        started_at,
        direction,
        status,
        outcome,
        disposition,
        duration_seconds,
        (lead_id is not null) as has_lead
      from call_records
      where org_id = ${SINGLE_TENANT_ORG_ID}::uuid
        and started_at >= ${from}
        and started_at <= ${to}
        and user_id = any(${userIdList})
        and ${input.leadCallFilter ?? sql`true`}
    `),
    input.includeDataCalls
      ? database.execute(sql`
          select
            c.agent_id,
            p.phone,
            c.called_at,
            c.outcome,
            c.duration_seconds
          from contact_call_logs c
          inner join contact_pool p on p.contact_id = c.contact_id
          where c.org_id = ${SINGLE_TENANT_ORG_ID}::uuid
            and c.called_at >= ${from}
            and c.called_at <= ${to}
            and c.agent_id = any(${userIdList})
        `)
      : Promise.resolve([]),
    input.includeDeviceCalls
      ? database.execute(sql`
          select
            user_id,
            phone_number,
            call_type,
            call_start_time,
            duration_seconds,
            call_log_id
          from agent_call_logs
          where call_start_time >= ${from}
            and call_start_time <= ${to}
            and user_id = any(${userIdList})
        `)
      : Promise.resolve([]),
  ]);

  const lead: LeadCallForStats[] = sqlRows(leadRows).map((row) => ({
    userId: String(row.user_id),
    phone: row.phone_number == null ? null : String(row.phone_number),
    startedAt: asDate(row.started_at as Date | string),
    direction: String(row.direction ?? "outgoing"),
    status: String(row.status ?? ""),
    outcome: row.outcome == null ? null : String(row.outcome),
    disposition: row.disposition == null ? null : String(row.disposition),
    durationSeconds: asNumber(row.duration_seconds),
    hasLead: row.has_lead === true || row.has_lead === "t" || row.has_lead === "true",
  }));

  const data: DataCallForStats[] = sqlRows(dataRows).map((row) => ({
    userId: String(row.agent_id),
    phone: row.phone == null ? null : String(row.phone),
    calledAt: asDate(row.called_at as Date | string),
    outcome: String(row.outcome ?? ""),
    durationSeconds: asNumber(row.duration_seconds),
  }));

  const device: DeviceCallForStats[] = sqlRows(deviceRows).map((row) => ({
    userId: String(row.user_id),
    phone: row.phone_number == null ? null : String(row.phone_number),
    callType: String(row.call_type ?? ""),
    startedAt: asDate(row.call_start_time as Date | string),
    durationSeconds: row.duration_seconds == null ? null : asNumber(row.duration_seconds),
    callLogId: row.call_log_id == null ? null : String(row.call_log_id),
  }));

  return { lead, data, device };
}

export async function loadCombinedCallEvents(
  database: Database,
  input: LoadCombinedCallEventsInput,
): Promise<CombinedCallEvent[]> {
  const inputs = await loadCombinedCallInputs(database, input);
  return [
    ...inputs.lead.map(classifyLeadCall),
    ...inputs.data.map(classifyDataCall),
    ...inputs.device.map(classifyDeviceCall),
  ];
}

export type AgentTalktimeStats = CombinedCallStats & {
  userId: string;
  name: string;
};

function leadSourceExists(source: string | undefined): SQL | undefined {
  const trimmed = source?.trim();
  if (!trimmed) return undefined;
  const variants = leadSourceLowerVariants(trimmed);
  if (variants.length === 0) return undefined;
  return sql`exists (
    select 1 from leads src
    where src.id = call_records.lead_id
      and src.org_id = ${SINGLE_TENANT_ORG_ID}::uuid
      and src.deleted_at is null
      and src.is_primary_phone = true
      and lower(coalesce(src.lead_source, '')) in (${sql.join(
        variants.map((variant) => sql`${variant}`),
        sql`, `,
      )})
  )`;
}

/** Overview Agent Talktime. Same combined calls as the leads call report. */
export async function loadAgentTalktime(
  database: Database,
  input: {
    from: Date;
    to: Date;
    userIds: string[] | null;
    source?: string;
  },
): Promise<AgentTalktimeStats[]> {
  if (input.userIds && input.userIds.length === 0) return [];

  const filters = [
    eq(users.orgId, SINGLE_TENANT_ORG_ID),
    eq(users.isActive, true),
    or(eq(users.role, "agent"), eq(users.role, "manager")),
  ];
  if (input.userIds) filters.push(inArray(users.id, input.userIds));

  const people = await database
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(...filters));

  if (people.length === 0) return [];

  const sourceFilter = leadSourceExists(input.source);
  const events = await loadCombinedCallEvents(database, {
    from: input.from,
    to: input.to,
    userIds: people.map((person) => person.id),
    includeDataCalls: !sourceFilter,
    includeDeviceCalls: !sourceFilter,
    leadCallFilter: sourceFilter,
  });
  const { byUser } = aggregateCombinedCalls(events);

  return people
    .map((person) => {
      const stats = byUser.get(person.id);
      if (!stats || stats.totalCalls <= 0) return null;
      return {
        userId: person.id,
        name: person.name?.trim() || "Agent",
        ...stats,
      };
    })
    .filter((row): row is AgentTalktimeStats => row != null)
    .sort((a, b) => b.totalCalls - a.totalCalls || a.name.localeCompare(b.name))
    .slice(0, 80);
}
