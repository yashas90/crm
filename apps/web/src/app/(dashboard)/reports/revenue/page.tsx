"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
import { StatCard } from "@/components/reports/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/hooks/use-permissions";
import { useReportFilters } from "@/hooks/use-report-filters";
import { isForbiddenError } from "@/hooks/use-reports";
import {
  type RevenuePipelineProjectRow,
  downloadRevenuePipelineCsv,
  formatInr,
  useRevenuePipelineReport,
} from "@/hooks/use-revenue-pipeline";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { cn } from "@propninja/ui/lib/utils";
import { Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  negotiation: "Negotiation",
};

type SortKey = keyof Pick<
  RevenuePipelineProjectRow,
  | "projectName"
  | "availableUnits"
  | "reservedUnits"
  | "bookedUnits"
  | "soldUnits"
  | "totalListedValue"
  | "totalBookedValue"
  | "leads"
>;

function sortValue(row: RevenuePipelineProjectRow, key: SortKey): string | number {
  return row[key];
}

export default function RevenuePipelineReportPage() {
  const router = useRouter();
  const { ready, canViewReports, canExportReports } = usePermissions();
  const { filters, setFilters, dateFrom, dateTo, labelFrom, labelTo } = useReportFilters();
  const [sortKey, setSortKey] = useState<SortKey>("projectName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!canViewReports) router.replace("/");
  }, [ready, canViewReports, router]);

  const report = useRevenuePipelineReport({
    dateFrom,
    dateTo,
    enabled: ready && canViewReports,
  });

  const rows = useMemo(() => {
    const items = report.data?.byProject ?? [];
    return [...items].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
  }, [report.data, sortKey, sortDir]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => ({
        availableUnits: acc.availableUnits + row.availableUnits,
        reservedUnits: acc.reservedUnits + row.reservedUnits,
        bookedUnits: acc.bookedUnits + row.bookedUnits,
        soldUnits: acc.soldUnits + row.soldUnits,
        totalListedValue: acc.totalListedValue + row.totalListedValue,
        totalBookedValue: acc.totalBookedValue + row.totalBookedValue,
        leads: acc.leads + row.leads,
      }),
      {
        availableUnits: 0,
        reservedUnits: 0,
        bookedUnits: 0,
        soldUnits: 0,
        totalListedValue: 0,
        totalBookedValue: 0,
        leads: 0,
      },
    );
  }, [rows]);

  const stageItems = report.data?.byStage ?? [];
  const maxStageCount = Math.max(...stageItems.map((s) => s.leadCount), 1);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      await downloadRevenuePipelineCsv({ dateFrom, dateTo });
    } finally {
      setIsExporting(false);
    }
  }

  if (!ready) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (!canViewReports) {
    return (
      <AccessDeniedEmptyState description="Revenue Pipeline is limited to managers and admins." />
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Revenue Pipeline</h1>
          <p className="text-muted-foreground">
            Unit inventory and lead funnel value — {labelFrom} → {labelTo}
          </p>
        </div>
        {canExportReports ? (
          <Button
            type="button"
            variant="outline"
            disabled={isExporting || report.isLoading}
            onClick={() => void handleExport()}
          >
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "Exporting…" : "Export CSV"}
          </Button>
        ) : null}
      </div>

      <ReportFilterBar value={filters} onChange={setFilters} />

      {report.isLoading ? (
        <p className="text-muted-foreground">Loading revenue pipeline…</p>
      ) : report.isError ? (
        isForbiddenError(report.error) ? (
          <AccessDeniedEmptyState />
        ) : (
          <p className="text-muted-foreground">Unable to load revenue pipeline.</p>
        )
      ) : !report.data ? (
        <p className="text-muted-foreground">No data available.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Pipeline Value"
              value={formatInr(report.data.totalPipelineValue)}
              hint="Active leads linked to units"
            />
            <StatCard
              title="Confirmed Revenue"
              value={formatInr(report.data.confirmedRevenue)}
              hint="Booked units (final price)"
            />
            <StatCard
              title="Projected Revenue"
              value={formatInr(report.data.projectedRevenue)}
              hint="Reserved units (listed price)"
            />
            <StatCard
              title="Conversion Rate"
              value={report.data.conversionRate != null ? `${report.data.conversionRate}%` : "—"}
              hint="Won vs lost this period"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Project breakdown</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No projects with unit inventory.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {(
                        [
                          ["projectName", "Project"],
                          ["availableUnits", "Available"],
                          ["reservedUnits", "Reserved"],
                          ["bookedUnits", "Booked"],
                          ["soldUnits", "Sold"],
                          ["totalListedValue", "Listed Value"],
                          ["totalBookedValue", "Booked Value"],
                          ["leads", "Active Leads"],
                        ] as const
                      ).map(([key, label]) => (
                        <TableHead key={key}>
                          <button
                            type="button"
                            className="font-medium hover:text-foreground"
                            onClick={() => toggleSort(key)}
                          >
                            {label}
                            {sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                          </button>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.projectId}>
                        <TableCell>
                          <Link
                            href={`/projects/${row.projectId}?step=inventory`}
                            className="text-primary hover:underline"
                          >
                            {row.projectName}
                          </Link>
                        </TableCell>
                        <TableCell>{row.availableUnits}</TableCell>
                        <TableCell>{row.reservedUnits}</TableCell>
                        <TableCell>{row.bookedUnits}</TableCell>
                        <TableCell>{row.soldUnits}</TableCell>
                        <TableCell>{formatInr(row.totalListedValue)}</TableCell>
                        <TableCell>{formatInr(row.totalBookedValue)}</TableCell>
                        <TableCell>{row.leads}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell>{totals.availableUnits}</TableCell>
                      <TableCell>{totals.reservedUnits}</TableCell>
                      <TableCell>{totals.bookedUnits}</TableCell>
                      <TableCell>{totals.soldUnits}</TableCell>
                      <TableCell>{formatInr(totals.totalListedValue)}</TableCell>
                      <TableCell>{formatInr(totals.totalBookedValue)}</TableCell>
                      <TableCell>{totals.leads}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Stage funnel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {stageItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active leads in pipeline.</p>
                ) : (
                  stageItems.map((stage) => (
                    <div key={stage.stage} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{STAGE_LABELS[stage.stage] ?? stage.stage}</span>
                        <span className="text-muted-foreground">
                          {stage.leadCount} leads · {formatInr(stage.estimatedValue)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className={cn("h-2 rounded-full bg-primary")}
                          style={{
                            width: `${(stage.leadCount / maxStageCount) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Won vs lost this period</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg">
                  Won{" "}
                  <span className="font-bold text-emerald-600">{report.data.wonThisPeriod}</span>
                  {" · "}
                  Lost <span className="font-bold text-red-600">{report.data.lostThisPeriod}</span>
                  {" · "}
                  Conversion{" "}
                  <span className="font-bold">
                    {report.data.conversionRate != null ? `${report.data.conversionRate}%` : "—"}
                  </span>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Based on leads moved to Won or Lost between {labelFrom} and {labelTo}.
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
