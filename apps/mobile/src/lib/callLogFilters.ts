import { getIstDayBounds, getIstMonthBounds, getIstWeekBounds } from "@propninja/types/ist";

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
  if (filter === "week") {
    const { start, end } = getIstWeekBounds();
    return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
  }
  if (filter === "month") {
    const { start, end } = getIstMonthBounds();
    return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
  }
  const { start, end } = getIstDayBounds(0);
  return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
}

export function weekRange(): { dateFrom: string; dateTo: string } {
  return dateRangeForFilter("week");
}
