"use client";

import {
  type ReportFilterValue,
  defaultReportFilters,
  resolveReportFilters,
  toApiRange,
} from "@/lib/report-filters";
import { useMemo, useState } from "react";

export function useReportFilters(initial?: ReportFilterValue) {
  const [filters, setFilters] = useState(initial ?? defaultReportFilters());

  const resolved = useMemo(() => resolveReportFilters(filters), [filters]);
  const apiRange = useMemo(() => toApiRange(resolved.from, resolved.to), [resolved]);

  return {
    filters,
    setFilters,
    dateFrom: apiRange.dateFrom,
    dateTo: apiRange.dateTo,
    userId: filters.userId,
    labelFrom: resolved.from,
    labelTo: resolved.to,
  };
}
