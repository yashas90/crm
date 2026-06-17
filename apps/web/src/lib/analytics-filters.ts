export type AnalyticsDatePreset = "today" | "thisWeek" | "thisMonth" | "custom";

export type AnalyticsFilterValue = {
  dateRange: {
    preset: AnalyticsDatePreset;
    from?: string;
    to?: string;
  };
};

export const ANALYTICS_DATE_PRESETS: { id: AnalyticsDatePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "thisWeek", label: "This Week" },
  { id: "thisMonth", label: "This Month" },
  { id: "custom", label: "Custom" },
];

export function defaultAnalyticsFilters(): AnalyticsFilterValue {
  return { dateRange: { preset: "thisMonth" } };
}

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date) {
  const start = new Date(d);
  const day = start.getDay();
  const diff = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function resolveAnalyticsFilters(value: AnalyticsFilterValue): {
  from: string;
  to: string;
  label: string;
} {
  const now = new Date();

  if (value.dateRange.preset === "custom" && value.dateRange.from && value.dateRange.to) {
    return {
      from: value.dateRange.from,
      to: value.dateRange.to,
      label: `${value.dateRange.from} → ${value.dateRange.to}`,
    };
  }

  if (value.dateRange.preset === "today") {
    const d = formatDate(now);
    return { from: d, to: d, label: "Today" };
  }

  if (value.dateRange.preset === "thisWeek") {
    const start = startOfWeek(now);
    return { from: formatDate(start), to: formatDate(now), label: "This week" };
  }

  if (value.dateRange.preset === "thisMonth") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: formatDate(start), to: formatDate(now), label: "This month" };
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: formatDate(start), to: formatDate(now), label: "This month" };
}

export function toAnalyticsApiParams(value: AnalyticsFilterValue) {
  const resolved = resolveAnalyticsFilters(value);
  return {
    dateFrom: new Date(`${resolved.from}T00:00:00`).toISOString(),
    dateTo: new Date(`${resolved.to}T23:59:59.999`).toISOString(),
    labelFrom: resolved.from,
    labelTo: resolved.to,
    rangeLabel: resolved.label,
  };
}
