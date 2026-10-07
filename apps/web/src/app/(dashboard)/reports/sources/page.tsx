"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
import { SourceMatrixTable } from "@/components/reports/source-matrix-table";
import { useReportFilters } from "@/hooks/use-report-filters";
import { downloadSourcesReportCsv, isForbiddenError, useSourceReport } from "@/hooks/use-reports";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Download } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const PAGE_SIZES = [10, 25, 50] as const;

export default function SourcesReportPage() {
  const { filters, setFilters, dateFrom, dateTo, userId, labelFrom, labelTo } = useReportFilters();
  const sourcesReport = useSourceReport({ dateFrom, dateTo, userId });
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(50);
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  const matrix = sourcesReport.data?.matrix;
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = matrix?.rows ?? [];
    if (!query) return rows;
    return rows.filter((row) => row.source.toLowerCase().includes(query));
  }, [matrix?.rows, search]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const visibleRows = filteredRows.slice(start, start + pageSize);

  async function handleExport() {
    setIsExporting(true);
    try {
      await downloadSourcesReportCsv({ dateFrom, dateTo, userId });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads - Source Report</h1>
          <p className="text-muted-foreground">
            Lead counts by source and stage ({labelFrom} → {labelTo}). Each cell shows the lead
            count and how many of those are unique phone numbers.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/reports">← Reports</Link>
        </Button>
      </div>

      <ReportFilterBar value={filters} onChange={setFilters} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search by source"
          className="max-w-sm"
          aria-label="Search by source"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void handleExport()} disabled={isExporting || !matrix}>
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "Exporting..." : "Export"}
          </Button>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Show entries
            <select
              className="h-10 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value) as (typeof PAGE_SIZES)[number]);
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {sourcesReport.isLoading ? (
        <p className="text-muted-foreground">Loading source report...</p>
      ) : sourcesReport.isError ? (
        isForbiddenError(sourcesReport.error) ? (
          <AccessDeniedEmptyState />
        ) : (
          <p className="text-muted-foreground">Unable to load source report.</p>
        )
      ) : !matrix ? (
        <p className="text-muted-foreground">Unable to load source report.</p>
      ) : (
        <>
          {filteredRows.length === 0 ? (
            <p className="text-muted-foreground">
              {search.trim()
                ? "No sources match this search."
                : "No leads were created in this date range."}
            </p>
          ) : null}
          {search.trim() && filteredRows.length === 0 ? null : (
            <SourceMatrixTable rows={visibleRows} totals={matrix.totals} />
          )}
          {filteredRows.length > 0 ? (
            <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing {start + 1}–{Math.min(start + pageSize, filteredRows.length)} of{" "}
                {filteredRows.length} sources
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </Button>
                <span>
                  Page {currentPage} / {pageCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
