"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useReportFilters } from "@/hooks/use-report-filters";
import {
  type TeamMemberStats,
  downloadTeamPerformanceCsv,
  isForbiddenError,
  useTeamReport,
} from "@/hooks/use-team-report";
import { Button } from "@propninja/ui/button";
import { Download } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type SortKey = keyof Pick<
  TeamMemberStats,
  "leadsAssigned" | "callsMade" | "tasksCompleted" | "conversionRate"
>;

export default function TeamReportPage() {
  const { filters, setFilters, labelFrom, labelTo } = useReportFilters();
  const [sortKey, setSortKey] = useState<SortKey>("callsMade");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [isExporting, setIsExporting] = useState(false);

  const report = useTeamReport({
    dateFrom: labelFrom,
    dateTo: labelTo,
  });

  const rows = useMemo(() => {
    const users = report.data?.users ?? [];
    return [...users].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey];
      return sortDir === "asc" ? diff : -diff;
    });
  }, [report.data, sortKey, sortDir]);

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
      await downloadTeamPerformanceCsv({ dateFrom: labelFrom, dateTo: labelTo });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team performance</h1>
          <p className="text-muted-foreground">
            Per-agent performance for ({labelFrom} → {labelTo}).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/reports">← Reports</Link>
          </Button>
          <Button variant="outline" onClick={() => void handleExport()} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "Exporting..." : "Export CSV"}
          </Button>
        </div>
      </div>

      <ReportFilterBar value={filters} onChange={setFilters} />

      {report.isLoading ? (
        <p className="text-muted-foreground">Loading team performance...</p>
      ) : report.isError ? (
        isForbiddenError(report.error) ? (
          <AccessDeniedEmptyState />
        ) : (
          <p className="text-muted-foreground">Unable to load team report.</p>
        )
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent Name</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("leadsAssigned")}>
                Leads Assigned {sortKey === "leadsAssigned" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("callsMade")}>
                Calls Made {sortKey === "callsMade" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("tasksCompleted")}>
                Tasks Completed{" "}
                {sortKey === "tasksCompleted" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("conversionRate")}>
                Conversion Rate{" "}
                {sortKey === "conversionRate" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((user) => (
              <TableRow key={user.userId}>
                <TableCell>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </TableCell>
                <TableCell>{user.leadsAssigned}</TableCell>
                <TableCell>{user.callsMade}</TableCell>
                <TableCell>{user.tasksCompleted}</TableCell>
                <TableCell>{user.conversionRate.toFixed(2)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
