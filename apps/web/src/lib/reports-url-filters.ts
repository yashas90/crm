import {
  type DateRangePreset,
  type ReportFilterValue,
  defaultReportFilters,
} from "@/lib/report-filters";

const VALID_PRESETS = new Set<DateRangePreset>([
  "today",
  "yesterday",
  "last7",
  "thisMonth",
  "custom",
]);

export function parseCallsSearchParams(params: URLSearchParams): ReportFilterValue {
  const presetParam = params.get("date_preset");
  const from = params.get("from") ?? undefined;
  const to = params.get("to") ?? undefined;
  const userId = params.get("user_id") ?? undefined;

  if (from && to) {
    return {
      dateRange: { preset: "custom", from, to },
      userId,
    };
  }

  if (presetParam && VALID_PRESETS.has(presetParam as DateRangePreset)) {
    return {
      dateRange: {
        preset: presetParam as DateRangePreset,
        from,
        to,
      },
      userId,
    };
  }

  return {
    ...defaultReportFilters(),
    userId,
  };
}
