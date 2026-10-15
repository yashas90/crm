import { istWallClockToDate } from "@propninja/types/ist";
import { sql } from "drizzle-orm";
import {
  type AdminDashboardPeriod,
  type FunnelCounts,
  buildLeadFunnel,
  changePercent,
  rankLeadSources,
  resolveAdminDashboardWindows,
  sparklineBetween,
  splitReceivedLeads,
  sumAmountBetween,
} from "../lib/adminDashboardPeriod.js";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { uuidArray } from "../lib/contactPool/sql.js";
import type { Database } from "../lib/db.js";
import { canonicalizeLeadSource, leadSourceLowerVariants } from "../lib/leadSourceAliases.js";
import { loadAgentTalktime } from "../lib/loadCombinedCallEvents.js";
import { sqlTimestamptz } from "../lib/sqlTimestamp.js";

export type AdminOverviewScope = {
  period: AdminDashboardPeriod;
  source?: string;
  /** Null is org-wide (admin). A list is the manager's team, including themselves. */
  userIds: string[] | null;
};

type RevenueCard = {
  amount: number;
  changePercent: number;
  sparkline: number[];
};

export type AdminOverview = {
  period: AdminDashboardPeriod;
  label: string;
  scope: "org" | "team";
  source: string | null;
  range: { from: string; to: string };
  revenue: {
    total: RevenueCard;
    today: RevenueCard;
    last7Days: RevenueCard;
    last30Days: RevenueCard;
    lastQuarter: RevenueCard;
  };
  leadsReceived: {
    total: number;
    active: number;
    lost: number;
    byStatus: { status: string; label: string; count: number }[];
  };
  sources: { source: string; count: number; percent: number }[];
  sourceOptions: string[];
  funnel: { key: string; label: string; count: number; percent: number }[];
  topClosers: { userId: string; name: string; netRevenue: number; deals: number }[];
  drivers: {
    newLeads: { count: number; previous: number; changePercent: number };
    siteVisits: { count: number; previous: number; changePercent: number };
    closed: { count: number; previous: number; changePercent: number };
    pending: { count: number; previous: number; changePercent: number };
  };
  reminders: {
    id: string;
    kind: "site_visit" | "follow_up";
    title: string;
    subtitle: string;
    at: string;
  }[];
  agentTalktime: AgentTalktimeRow[];
};

type AgentTalktimeRow = {
  userId: string;
  name: string;
  totalCalls: number;
  connected: number;
  totalDurationSeconds: number;
  incoming: number;
  incomingAnswered: number;
  incomingMissed: number;
  incomingDurationSeconds: number;
  outgoing: number;
  outgoingDurationSeconds: number;
  outgoingAnswered: number;
  outgoingNotAnswered: number;
};

const COLLECTED_DAY = sql`coalesce(
  tc.deal_closure_date::text,
  case
    when btrim(coalesce(tc.form->>'dealClosureDate', '')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      then left(btrim(tc.form->>'dealClosureDate'), 10)
    else null
  end,
  to_char(timezone('Asia/Kolkata', coalesce(tc.reviewed_at, tc.updated_at)), 'YYYY-MM-DD')
)`;

/** Column net revenue, then the TCF form amount when the column was never copied. */
const NET_REVENUE = sql`(
  case
    when tc.net_revenue::float8 > 0 then tc.net_revenue::float8
    when btrim(coalesce(tc.form #>> '{payment,netRevenue}', '')) ~ '^[0-9]+([.][0-9]+)?$'
      then btrim(tc.form #>> '{payment,netRevenue}')::float8
    else 0::float8
  end
)`;

function rowsOf(result: unknown): Record<string, unknown>[] {
  return Array.isArray(result) ? (result as Record<string, unknown>[]) : [];
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function personName(first: unknown, last: unknown): string {
  const name = [text(first), text(last)]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
  return name || "Lead";
}

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(text(value));
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

function userFilter(columnSql: ReturnType<typeof sql>, userIds: string[] | null) {
  if (userIds == null) return sql`true`;
  if (userIds.length === 0) return sql`false`;
  return sql`${columnSql} = any(${uuidArray(userIds)})`;
}

function sourceFilter(source: string | undefined) {
  const trimmed = source?.trim();
  if (!trimmed) return sql`true`;
  const variants = leadSourceLowerVariants(trimmed);
  if (variants.length === 0) return sql`true`;
  return sql`lower(coalesce(l.lead_source, '')) in (${sql.join(
    variants.map((variant) => sql`${variant}`),
    sql`, `,
  )})`;
}

function leadScope(userIds: string[] | null, source: string | undefined) {
  return sql`
    l.org_id = ${SINGLE_TENANT_ORG_ID}::uuid
    and l.deleted_at is null
    and l.is_primary_phone = true
    and ${userFilter(sql`l.assigned_to`, userIds)}
    and ${sourceFilter(source)}
  `;
}

function sourceInList(source: string | undefined, columnSql: ReturnType<typeof sql>) {
  const trimmed = source?.trim();
  if (!trimmed) return sql`true`;
  const variants = leadSourceLowerVariants(trimmed);
  if (variants.length === 0) return sql`true`;
  return sql`lower(coalesce(${columnSql}, '')) in (${sql.join(
    variants.map((variant) => sql`${variant}`),
    sql`, `,
  )})`;
}

/** Collected closures tied to a lead of the selected source. No source means every closure. */
function closureSourceFilter(source: string | undefined) {
  const trimmed = source?.trim();
  if (!trimmed) return sql`true`;
  return sql`exists (
    select 1 from leads src
    where src.org_id = ${SINGLE_TENANT_ORG_ID}::uuid
      and src.deleted_at is null
      and src.is_primary_phone = true
      and src.id::text = nullif(btrim(tc.form #>> '{client,crmLeadId}'), '')
      and ${sourceInList(trimmed, sql`src.lead_source`)}
  )`;
}

function collectedClosure(range: ReturnType<typeof sql>, source: string | undefined) {
  return sql`
    tc.org_id = ${SINGLE_TENANT_ORG_ID}::uuid
    and tc.status = 'approved'
    and (
      tc.invoice_status = 'collected'
      or tc.form #>> '{payment,invoiceStatus}' = 'collected'
    )
    and ${range}
    and ${closureSourceFilter(source)}
  `;
}

function revenueCard(
  amounts: Map<string, number>,
  fromKey: string,
  toKey: string,
  previousFrom: string,
  previousTo: string,
): RevenueCard {
  const amount = sumAmountBetween(amounts, fromKey, toKey);
  const previous = sumAmountBetween(amounts, previousFrom, previousTo);
  return {
    amount,
    changePercent: changePercent(amount, previous),
    sparkline: sparklineBetween(amounts, fromKey, toKey),
  };
}

async function loadRevenueDays(
  db: Database,
  fromKey: string,
  toKey: string,
  userIds: string[] | null,
  source: string | undefined,
): Promise<Map<string, number>> {
  if (userIds && userIds.length === 0) return new Map();

  const range = sql`${COLLECTED_DAY} >= ${fromKey} and ${COLLECTED_DAY} <= ${toKey}`;
  const collected = collectedClosure(range, source);

  const result =
    userIds == null
      ? await db.execute(sql`
          select ${COLLECTED_DAY} as day, coalesce(sum(${NET_REVENUE}), 0)::float8 as amount
          from transaction_closures tc
          where ${collected}
          group by 1
        `)
      : await db.execute(sql`
          select day, coalesce(sum(amount), 0)::float8 as amount
          from (
            select ${COLLECTED_DAY} as day,
              (${NET_REVENUE} * sh.share_percent::float8 / 100.0) as amount
            from transaction_closures tc
            inner join transaction_closure_shares sh on sh.tcf_id = tc.id
            where ${collected}
              and sh.user_id = any(${uuidArray(userIds)})
              and sh.share_percent::float8 > 0
            union all
            select ${COLLECTED_DAY} as day,
              (${NET_REVENUE} * sh.share_percent::float8 / 100.0) as amount
            from transaction_closures tc
            inner join transaction_closure_shares sh on sh.tcf_id = tc.id
            inner join lateral (
              select u.id
              from users u
              where u.org_id = tc.org_id
                and u.is_active = true
                and lower(u.name) = lower(btrim(sh.employee_name))
                and u.id = any(${uuidArray(userIds)})
              order by u.id
              limit 1
            ) named on true
            where ${collected}
              and sh.user_id is null
              and sh.share_percent::float8 > 0
              and not exists (
                select 1 from transaction_closure_shares s
                where s.tcf_id = tc.id and s.user_id is not null and s.share_percent::float8 > 0
              )
            union all
            select ${COLLECTED_DAY} as day, ${NET_REVENUE} as amount
            from transaction_closures tc
            where ${collected}
              and tc.created_by = any(${uuidArray(userIds)})
              and not exists (
                select 1 from transaction_closure_shares s
                where s.tcf_id = tc.id
                  and s.share_percent::float8 > 0
                  and (
                    s.user_id is not null
                    or exists (
                      select 1 from users u
                      where u.org_id = tc.org_id
                        and u.is_active = true
                        and lower(u.name) = lower(btrim(s.employee_name))
                    )
                  )
              )
          ) points
          group by day
        `);

  const amounts = new Map<string, number>();
  for (const row of rowsOf(result)) {
    const day = text(row.day);
    if (day) amounts.set(day, num(row.amount));
  }
  return amounts;
}

async function loadTopClosers(
  db: Database,
  fromKey: string,
  toKey: string,
  userIds: string[] | null,
  source: string | undefined,
  selectedFrom: Date,
  selectedTo: Date,
) {
  if (userIds && userIds.length === 0) return [];

  const range = sql`${COLLECTED_DAY} >= ${fromKey} and ${COLLECTED_DAY} <= ${toKey}`;
  const collected = collectedClosure(range, source);
  const shareUsers = userIds == null ? sql`true` : sql`sh.user_id = any(${uuidArray(userIds)})`;
  const namedUsers = userIds == null ? sql`true` : sql`named.id = any(${uuidArray(userIds)})`;
  const creatorUsers =
    userIds == null ? sql`true` : sql`tc.created_by = any(${uuidArray(userIds)})`;
  const fromTs = sqlTimestamptz(selectedFrom);
  const toTs = sqlTimestamptz(selectedTo);
  const scope = leadScope(userIds, source);
  const unresolvedShare = sql`
    not exists (
      select 1 from transaction_closure_shares s
      where s.tcf_id = tc.id
        and s.share_percent::float8 > 0
        and (
          s.user_id is not null
          or exists (
            select 1 from users u
            where u.org_id = tc.org_id
              and u.is_active = true
              and lower(u.name) = lower(btrim(s.employee_name))
          )
        )
    )
  `;

  const result = await db.execute(sql`
    select u.id as user_id, u.name as name,
      coalesce(sum(points.amount), 0)::float8 as net_revenue,
      count(distinct points.deal_id)::int as deals
    from (
      select sh.user_id, ('tcf:' || tc.id::text) as deal_id,
        (${NET_REVENUE} * sh.share_percent::float8 / 100.0) as amount
      from transaction_closures tc
      inner join transaction_closure_shares sh on sh.tcf_id = tc.id
      where ${collected}
        and sh.user_id is not null
        and sh.share_percent::float8 > 0
        and ${shareUsers}
      union all
      select named.id as user_id, ('tcf:' || tc.id::text) as deal_id,
        (${NET_REVENUE} * sh.share_percent::float8 / 100.0) as amount
      from transaction_closures tc
      inner join transaction_closure_shares sh on sh.tcf_id = tc.id
      inner join lateral (
        select u.id
        from users u
        where u.org_id = tc.org_id
          and u.is_active = true
          and lower(u.name) = lower(btrim(sh.employee_name))
        order by u.id
        limit 1
      ) named on true
      where ${collected}
        and sh.user_id is null
        and sh.share_percent::float8 > 0
        and ${namedUsers}
        and not exists (
          select 1 from transaction_closure_shares s
          where s.tcf_id = tc.id and s.user_id is not null and s.share_percent::float8 > 0
        )
      union all
      select tc.created_by as user_id, ('tcf:' || tc.id::text) as deal_id, ${NET_REVENUE} as amount
      from transaction_closures tc
      where ${collected}
        and tc.created_by is not null
        and ${creatorUsers}
        and ${unresolvedShare}
      union all
      select closer.user_id, ('lead:' || l.id::text) as deal_id, 0::float8 as amount
      from leads l
      cross join lateral (
        select coalesce(
          (
            select la.user_id
            from lead_activities la
            where la.lead_id = l.id
              and la.org_id = ${SINGLE_TENANT_ORG_ID}::uuid
              and la.type = 'status_change'
              and la.metadata->>'to' = 'won'
              and la.created_at >= ${fromTs}
              and la.created_at <= ${toTs}
              and la.user_id is not null
            order by la.created_at desc
            limit 1
          ),
          l.assigned_to
        ) as user_id
      ) closer
      where ${scope}
        and l.lead_status = 'won'
        and closer.user_id is not null
        and ${userFilter(sql`closer.user_id`, userIds)}
        and (
          (l.updated_at >= ${fromTs} and l.updated_at <= ${toTs})
          or exists (
            select 1 from lead_activities la
            where la.lead_id = l.id
              and la.type = 'status_change'
              and la.metadata->>'to' = 'won'
              and la.created_at >= ${fromTs}
              and la.created_at <= ${toTs}
          )
        )
        and not exists (
          select 1 from transaction_closures tc
          where ${collected}
            and nullif(btrim(tc.form #>> '{client,crmLeadId}'), '') = l.id::text
        )
    ) points
    inner join users u on u.id = points.user_id
    group by u.id, u.name
    having count(distinct points.deal_id) > 0
    order by net_revenue desc, deals desc, u.name
    limit 5
  `);

  return rowsOf(result).map((row) => ({
    userId: text(row.user_id),
    name: text(row.name) || "Agent",
    netRevenue: Math.round(num(row.net_revenue)),
    deals: num(row.deals),
  }));
}

export async function listDashboardTeamUserIds(db: Database, managerId: string) {
  const result = await db.execute(sql`
    select id
    from users
    where org_id = ${SINGLE_TENANT_ORG_ID}::uuid
      and is_active = true
      and (
        id = ${managerId}::uuid
        or reporting_to_id = ${managerId}::uuid
        or general_manager_id = ${managerId}::uuid
      )
  `);
  const ids = rowsOf(result)
    .map((row) => text(row.id))
    .filter(Boolean);
  if (!ids.includes(managerId)) ids.push(managerId);
  return ids;
}

export async function getAdminOverview(
  db: Database,
  query: AdminOverviewScope,
): Promise<AdminOverview> {
  const windows = resolveAdminDashboardWindows(query.period);
  const source = query.source?.trim() || null;
  const userIds = query.userIds;
  const scope = leadScope(userIds, source ?? undefined);
  const selectedFrom = sqlTimestamptz(windows.selected.from);
  const selectedTo = sqlTimestamptz(windows.selected.to);
  const previousFrom = sqlTimestamptz(windows.previous.from);
  const previousTo = sqlTimestamptz(windows.previous.to);
  const todayKey = windows.today.fromKey;

  const [
    revenueDays,
    receivedRows,
    driverRow,
    closedRow,
    visitRow,
    funnelRow,
    sourceRows,
    optionRows,
    closers,
    visitReminders,
    followupReminders,
    agentTalktimeRows,
  ] = await Promise.all([
    loadRevenueDays(
      db,
      windows.sparklineFromKey,
      windows.today.toKey,
      userIds,
      source ?? undefined,
    ),
    db.execute(sql`
      select l.lead_status as status, count(*)::int as count
      from leads l
      where ${scope}
        and l.created_at >= ${selectedFrom}
        and l.created_at <= ${selectedTo}
      group by l.lead_status
    `),
    db.execute(sql`
      select
        count(*) filter (
          where l.created_at >= ${selectedFrom} and l.created_at <= ${selectedTo}
        )::int as new_leads,
        count(*) filter (
          where l.created_at >= ${previousFrom} and l.created_at <= ${previousTo}
        )::int as new_leads_prev,
        count(*) filter (
          where l.created_at >= ${selectedFrom} and l.created_at <= ${selectedTo}
            and l.lead_status in ('new', 'contacted', 'qualified', 'negotiation')
        )::int as pending,
        count(*) filter (
          where l.created_at >= ${previousFrom} and l.created_at <= ${previousTo}
            and l.lead_status in ('new', 'contacted', 'qualified', 'negotiation')
        )::int as pending_prev
      from leads l
      where ${scope}
        and l.created_at >= ${previousFrom}
        and l.created_at <= ${selectedTo}
    `),
    db.execute(sql`
      select
        count(*) filter (
          where l.updated_at >= ${selectedFrom} and l.updated_at <= ${selectedTo}
        )::int as closed,
        count(*) filter (
          where l.updated_at >= ${previousFrom} and l.updated_at <= ${previousTo}
        )::int as closed_prev
      from leads l
      where ${scope}
        and l.lead_status = 'won'
        and l.updated_at >= ${previousFrom}
        and l.updated_at <= ${selectedTo}
    `),
    db.execute(sql`
      select
        count(*) filter (
          where sv.visit_date >= ${windows.selected.fromKey}
            and sv.visit_date <= ${windows.selected.toKey}
        )::int as current,
        count(*) filter (
          where sv.visit_date >= ${windows.previous.fromKey}
            and sv.visit_date <= ${windows.previous.toKey}
        )::int as previous
      from site_visits sv
      inner join leads l on l.id = sv.lead_id
      where sv.org_id = ${SINGLE_TENANT_ORG_ID}::uuid
        and sv.status <> 'cancelled'
        and sv.visit_date >= ${windows.previous.fromKey}
        and sv.visit_date <= ${windows.selected.toKey}
        and ${scope}
    `),
    db.execute(sql`
      select
        count(distinct l.id)::int as leads,
        count(distinct l.id) filter (
          where l.lead_status in ('contacted', 'qualified', 'negotiation', 'won')
            or u.id is not null
        )::int as prospect,
        count(distinct l.id) filter (
          where l.lead_status in ('qualified', 'negotiation', 'won')
            or u.id is not null
        )::int as opportunity,
        count(distinct l.id) filter (
          where l.lead_status = 'won' or u.id is not null
        )::int as booked,
        count(distinct l.id) filter (where l.lead_status = 'won')::int as invoiced
      from leads l
      left join project_units u
        on u.assigned_lead_id = l.id
       and u.status in ('booked', 'sold')
      where ${scope}
    `),
    db.execute(sql`
      select coalesce(nullif(trim(l.lead_source), ''), 'Unknown') as source, count(*)::int as count
      from leads l
      where ${scope}
        and l.created_at >= ${selectedFrom}
        and l.created_at <= ${selectedTo}
      group by 1
      order by count desc
      limit 30
    `),
    db.execute(sql`
      select coalesce(nullif(trim(l.lead_source), ''), 'Unknown') as source
      from leads l
      where ${scope}
      group by 1
      order by 1
      limit 40
    `),
    loadTopClosers(
      db,
      windows.selected.fromKey,
      windows.selected.toKey,
      userIds,
      source ?? undefined,
      windows.selected.from,
      windows.selected.to,
    ),
    db.execute(sql`
      select sv.id, l.first_name, l.last_name, sv.visit_date, sv.visit_time, p.name as project_name
      from site_visits sv
      inner join leads l on l.id = sv.lead_id
      left join projects p on p.id = sv.project_id
      where sv.org_id = ${SINGLE_TENANT_ORG_ID}::uuid
        and sv.status not in ('cancelled', 'completed')
        and sv.visit_date >= ${todayKey}
        and ${scope}
      order by sv.visit_date, sv.visit_time
      limit 6
    `),
    db.execute(sql`
      select l.id, l.first_name, l.last_name, l.next_followup_at
      from leads l
      where ${scope}
        and l.next_followup_at >= now()
        and l.lead_status not in ('won', 'lost', 'not_interested', 'dropped')
      order by l.next_followup_at
      limit 6
    `),
    loadAgentTalktime(db, {
      from: windows.selected.from,
      to: windows.selected.to,
      userIds,
      source: source ?? undefined,
    }),
  ]);

  const received = splitReceivedLeads(
    rowsOf(receivedRows).map((row) => ({ status: text(row.status), count: num(row.count) })),
  );
  const drivers = rowsOf(driverRow)[0] ?? {};
  const closed = rowsOf(closedRow)[0] ?? {};
  const visits = rowsOf(visitRow)[0] ?? {};
  const funnelRaw = rowsOf(funnelRow)[0] ?? {};
  const funnelCounts: FunnelCounts = {
    leads: num(funnelRaw.leads),
    prospect: num(funnelRaw.prospect),
    opportunity: num(funnelRaw.opportunity),
    booked: num(funnelRaw.booked),
    invoiced: num(funnelRaw.invoiced),
  };

  const newLeads = num(drivers.new_leads);
  const newLeadsPrev = num(drivers.new_leads_prev);
  const pending = num(drivers.pending);
  const pendingPrev = num(drivers.pending_prev);
  const closedCount = num(closed.closed);
  const closedPrev = num(closed.closed_prev);
  const visitCount = num(visits.current);
  const visitPrev = num(visits.previous);

  const reminders = [
    ...rowsOf(visitReminders).map((row) => {
      const [hour, minute] = text(row.visit_time).split(":");
      const at = istWallClockToDate(
        text(row.visit_date),
        Number(hour) || 0,
        Number(minute) || 0,
      ).toISOString();
      const project = text(row.project_name).trim();
      return {
        id: `visit-${text(row.id)}`,
        kind: "site_visit" as const,
        title: personName(row.first_name, row.last_name),
        subtitle: project || "Site visit",
        at,
      };
    }),
    ...rowsOf(followupReminders).map((row) => ({
      id: `follow-${text(row.id)}`,
      kind: "follow_up" as const,
      title: personName(row.first_name, row.last_name),
      subtitle: "Follow-up",
      at: asIso(row.next_followup_at),
    })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 8);

  const sourceOptions = [
    ...new Set(
      rowsOf(optionRows)
        .map((row) => canonicalizeLeadSource(text(row.source)) ?? text(row.source))
        .filter((name) => name && name !== "Unknown"),
    ),
  ].sort((a, b) => a.localeCompare(b));

  const agentTalktime = agentTalktimeRows.map((row) => ({
    userId: row.userId,
    name: row.name,
    totalCalls: row.totalCalls,
    connected: row.connected,
    totalDurationSeconds: row.totalDurationSeconds,
    incoming: row.incomingTotal,
    incomingAnswered: row.incomingAnswered,
    incomingMissed: row.incomingMissed,
    incomingDurationSeconds: row.incomingDurationSeconds,
    outgoing: row.outgoingTotal,
    outgoingDurationSeconds: row.outgoingDurationSeconds,
    outgoingAnswered: row.outgoingAnswered,
    outgoingNotAnswered: row.outgoingNotAnswered,
  }));

  return {
    period: query.period,
    label: windows.label,
    scope: userIds == null ? "org" : "team",
    source,
    range: { from: windows.selected.from.toISOString(), to: windows.selected.to.toISOString() },
    revenue: {
      total: revenueCard(
        revenueDays,
        windows.selected.fromKey,
        windows.selected.toKey,
        windows.previous.fromKey,
        windows.previous.toKey,
      ),
      today: revenueCard(
        revenueDays,
        windows.today.fromKey,
        windows.today.toKey,
        windows.yesterday.fromKey,
        windows.yesterday.toKey,
      ),
      last7Days: revenueCard(
        revenueDays,
        windows.last7.fromKey,
        windows.last7.toKey,
        windows.previous7.fromKey,
        windows.previous7.toKey,
      ),
      last30Days: revenueCard(
        revenueDays,
        windows.last30.fromKey,
        windows.last30.toKey,
        windows.previous30.fromKey,
        windows.previous30.toKey,
      ),
      lastQuarter: revenueCard(
        revenueDays,
        windows.lastQuarter.fromKey,
        windows.lastQuarter.toKey,
        windows.quarterBeforeLast.fromKey,
        windows.quarterBeforeLast.toKey,
      ),
    },
    leadsReceived: received,
    sources: rankLeadSources(
      rowsOf(sourceRows).map((row) => ({ source: text(row.source), count: num(row.count) })),
      (name) => canonicalizeLeadSource(name) ?? name,
    ),
    sourceOptions,
    funnel: buildLeadFunnel(funnelCounts),
    topClosers: closers,
    drivers: {
      newLeads: {
        count: newLeads,
        previous: newLeadsPrev,
        changePercent: changePercent(newLeads, newLeadsPrev),
      },
      siteVisits: {
        count: visitCount,
        previous: visitPrev,
        changePercent: changePercent(visitCount, visitPrev),
      },
      closed: {
        count: closedCount,
        previous: closedPrev,
        changePercent: changePercent(closedCount, closedPrev),
      },
      pending: {
        count: pending,
        previous: pendingPrev,
        changePercent: changePercent(pending, pendingPrev),
      },
    },
    reminders,
    agentTalktime,
  };
}
