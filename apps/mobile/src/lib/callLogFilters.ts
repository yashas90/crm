export type CallDateFilter = "today" | "week" | "month";
export type CallOutcomeFilter = "all" | "answered" | "no_answer" | "busy" | "left_voicemail";

export const CALL_DATE_FILTERS: { id: CallDateFilter; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
];

export const CALL_OUTCOME_FILTERS: { id: CallOutcomeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "answered", label: "Answered" },
  { id: "no_answer", label: "No Answer" },
  { id: "busy", label: "Busy" },
  { id: "left_voicemail", label: "Left Voicemail" },
];

export function dateRangeForFilter(filter: CallDateFilter): { dateFrom: string; dateTo: string } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  if (filter === "week") {
    const day = start.getDay();
    const mondayOffset = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - mondayOffset);
  } else if (filter === "month") {
    start.setDate(1);
  }

  return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
}

export function weekRange(): { dateFrom: string; dateTo: string } {
  return dateRangeForFilter("week");
}
