export type LeadsDatePreset = "all" | "today" | "thisWeek" | "thisMonth" | "custom";

export const LEADS_DATE_PRESETS: { id: LeadsDatePreset; label: string }[] = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "thisWeek", label: "This week" },
  { id: "thisMonth", label: "This month" },
  { id: "custom", label: "Custom" },
];

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function resolveLeadsDatePreset(
  preset: LeadsDatePreset,
  customFrom?: string,
  customTo?: string,
): { dateFrom?: string; dateTo?: string } {
  if (preset === "all") {
    return {};
  }

  const now = new Date();

  if (preset === "today") {
    const key = formatDate(now);
    return { dateFrom: key, dateTo: key };
  }

  if (preset === "thisWeek") {
    const start = new Date(now);
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    return { dateFrom: formatDate(start), dateTo: formatDate(now) };
  }

  if (preset === "thisMonth") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateFrom: formatDate(start), dateTo: formatDate(now) };
  }

  if (customFrom && customTo) {
    return { dateFrom: customFrom, dateTo: customTo };
  }

  return {};
}

export function inferDatePresetFromRange(dateFrom?: string, dateTo?: string): LeadsDatePreset {
  if (!dateFrom || !dateTo) return "all";

  const resolved = {
    today: resolveLeadsDatePreset("today"),
    thisWeek: resolveLeadsDatePreset("thisWeek"),
    thisMonth: resolveLeadsDatePreset("thisMonth"),
  };

  if (dateFrom === resolved.today.dateFrom && dateTo === resolved.today.dateTo) {
    return "today";
  }
  if (dateFrom === resolved.thisWeek.dateFrom && dateTo === resolved.thisWeek.dateTo) {
    return "thisWeek";
  }
  if (dateFrom === resolved.thisMonth.dateFrom && dateTo === resolved.thisMonth.dateTo) {
    return "thisMonth";
  }

  return "custom";
}
