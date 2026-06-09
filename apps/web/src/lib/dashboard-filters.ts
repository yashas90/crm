import type { LeadStatus } from "@propninja/types/enums";

export type DashboardDatePreset = "today" | "last7" | "last30" | "thisMonth" | "custom";

export type DashboardFilterValue = {
  dateRange: {
    preset: DashboardDatePreset;
    from?: string;
    to?: string;
  };
  userId?: string;
  status?: LeadStatus | "";
};

export const DASHBOARD_DATE_PRESETS: { id: DashboardDatePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "thisMonth", label: "This month" },
  { id: "custom", label: "Custom" },
];

export const DASHBOARD_STATUS_OPTIONS: { value: LeadStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

export function defaultDashboardFilters(): DashboardFilterValue {
  return {
    dateRange: { preset: "last30" },
    status: "",
  };
}

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function resolveDashboardFilters(value: DashboardFilterValue): {
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

  if (value.dateRange.preset === "thisMonth") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: formatDate(start), to: formatDate(now), label: "This month" };
  }

  if (value.dateRange.preset === "last7") {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return { from: formatDate(from), to: formatDate(now), label: "Last 7 days" };
  }

  if (value.dateRange.preset === "last30") {
    const from = new Date(now);
    from.setDate(from.getDate() - 29);
    return { from: formatDate(from), to: formatDate(now), label: "Last 30 days" };
  }

  const from = new Date(now);
  from.setDate(from.getDate() - 29);
  return { from: formatDate(from), to: formatDate(now), label: "Last 30 days" };
}

export function toDashboardApiParams(value: DashboardFilterValue) {
  const resolved = resolveDashboardFilters(value);
  return {
    dateFrom: new Date(`${resolved.from}T00:00:00`).toISOString(),
    dateTo: new Date(`${resolved.to}T23:59:59.999`).toISOString(),
    labelFrom: resolved.from,
    labelTo: resolved.to,
    rangeLabel: resolved.label,
    userId: value.userId || undefined,
    status: value.status || undefined,
  };
}
