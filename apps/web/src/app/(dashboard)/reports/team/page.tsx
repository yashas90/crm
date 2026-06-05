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
import { type TeamMemberStats, isForbiddenError, useTeamReport } from "@/hooks/use-team-report";
import { Button } from "@propninja/ui/button";
import Link from "next/link";
import { useMemo, useState } from "react";

type SortKey = keyof Pick<
  TeamMemberStats,
  "callsToday" | "completedToday" | "avgDurationToday" | "leadsTouchedToday" | "dealsWonToday"
>;

export default function TeamReportPage() {
  const { filters, setFilters, labelFrom, labelTo } = useReportFilters({
    dateRange: { preset: "today" },
  });
  const [sortKey, setSortKey] = useState<SortKey>("callsToday");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team performance</h1>
          <p className="text-muted-foreground">
            Today&apos;s performance — per-agent stand-up metrics ({labelFrom} → {labelTo}). Differs
            from the dashboard team snapshot, which mixes current book, today&apos;s calls, and
            monthly wins.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/reports">← Reports</Link>
        </Button>
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
              <TableHead>Agent</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("callsToday")}>
                Calls {sortKey === "callsToday" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("completedToday")}>
                Completed {sortKey === "completedToday" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("avgDurationToday")}>
                Avg duration {sortKey === "avgDurationToday" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("leadsTouchedToday")}>
                Leads touched{" "}
                {sortKey === "leadsTouchedToday" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("dealsWonToday")}>
                Deals won {sortKey === "dealsWonToday" ? (sortDir === "asc" ? "↑" : "↓") : ""}
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
                <TableCell>{user.callsToday}</TableCell>
                <TableCell>{user.completedToday}</TableCell>
                <TableCell>{user.avgDurationToday}s</TableCell>
                <TableCell>{user.leadsTouchedToday}</TableCell>
                <TableCell>{user.dealsWonToday}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
