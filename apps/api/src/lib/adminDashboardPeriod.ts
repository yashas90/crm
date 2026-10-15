import {
  addDaysToDateKey,
  getIstDateKey,
  getIstDayBounds,
  istWallClockToDate,
} from "@propninja/types/ist";

export const ADMIN_DASHBOARD_PERIODS = ["today", "7d", "30d", "quarter"] as const;

export type AdminDashboardPeriod = (typeof ADMIN_DASHBOARD_PERIODS)[number];

export type DayWindow = {
  from: Date;
  to: Date;
  fromKey: string;
  toKey: string;
};

export type AdminDashboardWindows = {
  period: AdminDashboardPeriod;
  label: string;
  selected: DayWindow;
  previous: DayWindow;
  today: DayWindow;
  yesterday: DayWindow;
  last7: DayWindow;
  previous7: DayWindow;
  last30: DayWindow;
  previous30: DayWindow;
  thisQuarter: DayWindow;
  lastQuarter: DayWindow;
  quarterBeforeLast: DayWindow;
  /** Earliest day needed for sparklines and quarter-over-quarter change. */
  sparklineFromKey: string;
};

const PERIOD_LABELS: Record<AdminDashboardPeriod, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  quarter: "This quarter",
};

function windowBetween(fromKey: string, toKey: string): DayWindow {
  const from = istWallClockToDate(fromKey, 0, 0);
  const to = new Date(istWallClockToDate(addDaysToDateKey(toKey, 1), 0, 0).getTime() - 1);
  return { from, to, fromKey, toKey };
}

function relativeWindow(startOffset: number, endOffset: number, now: Date): DayWindow {
  const start = getIstDayBounds(startOffset, now);
  const end = getIstDayBounds(endOffset, now);
  return {
    from: start.start,
    to: end.end,
    fromKey: start.dateKey,
    toKey: end.dateKey,
  };
}

function quarterStartKey(dateKey: string): string {
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(5, 7));
  const quarterMonth = Math.floor((month - 1) / 3) * 3 + 1;
  return `${year}-${String(quarterMonth).padStart(2, "0")}-01`;
}

/** Calendar quarter immediately before the quarter that starts on `quarterStart`. */
export function previousQuarterWindow(quarterStart: string): { fromKey: string; toKey: string } {
  const toKey = addDaysToDateKey(quarterStart, -1);
  return { fromKey: quarterStartKey(toKey), toKey };
}

export function resolveAdminDashboardWindows(
  period: AdminDashboardPeriod,
  now = new Date(),
): AdminDashboardWindows {
  const today = relativeWindow(0, 0, now);
  const yesterday = relativeWindow(-1, -1, now);
  const last7 = relativeWindow(-6, 0, now);
  const previous7 = relativeWindow(-13, -7, now);
  const last30 = relativeWindow(-29, 0, now);
  const previous30 = relativeWindow(-59, -30, now);

  const thisStart = quarterStartKey(today.fromKey);
  const last = previousQuarterWindow(thisStart);
  const before = previousQuarterWindow(last.fromKey);
  const thisQuarter = windowBetween(thisStart, today.toKey);
  const lastQuarter = windowBetween(last.fromKey, last.toKey);
  const quarterBeforeLast = windowBetween(before.fromKey, before.toKey);

  const selected =
    period === "today" ? today : period === "7d" ? last7 : period === "30d" ? last30 : thisQuarter;
  const previous =
    period === "today"
      ? yesterday
      : period === "7d"
        ? previous7
        : period === "30d"
          ? previous30
          : lastQuarter;

  return {
    period,
    label: PERIOD_LABELS[period],
    selected,
    previous,
    today,
    yesterday,
    last7,
    previous7,
    last30,
    previous30,
    thisQuarter,
    lastQuarter,
    quarterBeforeLast,
    sparklineFromKey: quarterBeforeLast.fromKey,
  };
}

/** Both zero stays 0%. A rise from zero is 100%. */
export function changePercent(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

export function sumAmountBetween(
  amounts: Map<string, number>,
  fromKey: string,
  toKey: string,
): number {
  let total = 0;
  for (const [day, amount] of amounts) {
    if (day >= fromKey && day <= toKey) total += amount;
  }
  return Math.round(total);
}

export function sparklineBetween(
  amounts: Map<string, number>,
  fromKey: string,
  toKey: string,
  maxPoints = 28,
): number[] {
  const values: number[] = [];
  let cursor = fromKey;
  let guard = 0;
  while (cursor <= toKey && guard < 400) {
    values.push(Math.round(amounts.get(cursor) ?? 0));
    cursor = addDaysToDateKey(cursor, 1);
    guard += 1;
  }
  if (values.length === 0) return [0, 0];
  if (values.length === 1) return [values[0] ?? 0, values[0] ?? 0];
  if (values.length <= maxPoints) return values;

  const sampled: number[] = [];
  const step = (values.length - 1) / (maxPoints - 1);
  for (let index = 0; index < maxPoints; index += 1) {
    sampled.push(values[Math.round(index * step)] ?? 0);
  }
  return sampled;
}

const LOST_STATUSES = new Set(["lost", "not_interested", "dropped"]);

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
  not_interested: "Not interested",
  dropped: "Dropped",
};

export function splitReceivedLeads(rows: { status: string; count: number }[]) {
  let active = 0;
  let lost = 0;
  const byStatus = rows
    .filter((row) => row.count > 0)
    .map((row) => ({
      status: row.status,
      label: STATUS_LABELS[row.status] ?? row.status,
      count: row.count,
    }))
    .sort((a, b) => b.count - a.count);

  for (const row of rows) {
    if (LOST_STATUSES.has(row.status)) lost += row.count;
    else active += row.count;
  }

  return { total: active + lost, active, lost, byStatus };
}

export type FunnelCounts = {
  leads: number;
  prospect: number;
  opportunity: number;
  booked: number;
  invoiced: number;
};

/** Live pipeline. Later stages are cumulative and shown as a percent of all leads. */
export function buildLeadFunnel(counts: FunnelCounts) {
  const stages = [
    { key: "leads", label: "Leads", count: counts.leads },
    { key: "prospect", label: "Prospect", count: counts.prospect },
    { key: "opportunity", label: "Opportunity", count: counts.opportunity },
    { key: "booked", label: "Booked", count: counts.booked },
    { key: "invoiced", label: "Invoiced", count: counts.invoiced },
  ];
  const base = stages[0]?.count ?? 0;
  return stages.map((stage) => ({
    ...stage,
    percent: base > 0 ? Math.round((stage.count / base) * 100) : 0,
  }));
}

/**
 * Collected net revenue. The column wins when it is positive.
 * Older closures keep the amount only inside the TCF form JSON.
 */
export function collectedNetRevenue(column: number, formValue: string | null | undefined): number {
  if (Number.isFinite(column) && column > 0) return column;
  const parsed = Number(String(formValue ?? "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function closureInvoiceCollected(
  columnStatus: string | null | undefined,
  formStatus: string | null | undefined,
): boolean {
  return columnStatus === "collected" || formStatus === "collected";
}

export type ClosureShareCredit = {
  userId: string | null;
  employeeName: string;
  sharePercent: number;
};

/** Who earns a collected closure. Mirrors the admin overview closer SQL. */
export function attributeClosureCredit(input: {
  amount: number;
  createdBy: string | null;
  shares: ClosureShareCredit[];
  userIdByName: ReadonlyMap<string, string>;
}): { userId: string; amount: number }[] {
  const credited = input.shares.filter((share) => share.sharePercent > 0 && share.userId);
  if (credited.length > 0) {
    return credited.map((share) => ({
      userId: share.userId as string,
      amount: (input.amount * share.sharePercent) / 100,
    }));
  }

  const named = input.shares.flatMap((share) => {
    if (share.sharePercent <= 0) return [];
    const userId = input.userIdByName.get(share.employeeName.trim().toLowerCase());
    if (!userId) return [];
    return [{ userId, amount: (input.amount * share.sharePercent) / 100 }];
  });
  if (named.length > 0) return named;

  if (input.createdBy) return [{ userId: input.createdBy, amount: input.amount }];
  return [];
}

export function rankLeadSources(
  rows: { source: string; count: number }[],
  canonicalize: (source: string) => string,
  limit = 5,
) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const name = canonicalize(row.source) || "Unknown";
    totals.set(name, (totals.get(name) ?? 0) + row.count);
  }

  const ranked = [...totals.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([source, count]) => ({ source, count }));

  const max = Math.max(...ranked.map((row) => row.count), 0);
  return ranked.map((row) => ({
    ...row,
    percent: max > 0 ? Math.round((row.count / max) * 100) : 0,
  }));
}
