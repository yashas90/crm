export type DateRangePreset = "today" | "yesterday" | "last7" | "thisMonth" | "custom";

export type ReportFilterValue = {
  dateRange: {
    preset: DateRangePreset;
    from?: string;
    to?: string;
  };
  userId?: string;
};

export function defaultReportFilters(): ReportFilterValue {
  return {
    dateRange: { preset: "last7" },
  };
}

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function resolveReportFilters(value: ReportFilterValue): { from: string; to: string } {
  const now = new Date();

  if (value.dateRange.preset === "custom" && value.dateRange.from && value.dateRange.to) {
    return { from: value.dateRange.from, to: value.dateRange.to };
  }

  if (value.dateRange.preset === "today") {
    const d = formatDate(now);
    return { from: d, to: d };
  }

  if (value.dateRange.preset === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const d = formatDate(y);
    return { from: d, to: d };
  }

  if (value.dateRange.preset === "thisMonth") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: formatDate(start), to: formatDate(now) };
  }

  const from = new Date(now);
  from.setDate(from.getDate() - 7);
  return { from: formatDate(from), to: formatDate(now) };
}

export function toApiRange(from: string, to: string) {
  return {
    dateFrom: new Date(`${from}T00:00:00`).toISOString(),
    dateTo: new Date(`${to}T23:59:59.999`).toISOString(),
  };
}
