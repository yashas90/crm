"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CallsUserReportRow, CallsUserReportTotals } from "@/hooks/use-reports";
import { formatTalkTime } from "@/lib/format-talk-time";
import { Button } from "@propninja/ui/button";
import { cn } from "@propninja/ui/lib/utils";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from "lucide-react";

const HEADER_CELL = "bg-slate-900 text-center text-xs font-semibold text-slate-50";
const GROUP_BORDER = "border-l border-slate-700";
const EMPTY = "--";

type CallsUserReportTableProps = {
  rows: CallsUserReportRow[];
  totals: CallsUserReportTotals;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  className?: string;
};

function formatCount(value: number, hasActivity: boolean) {
  if (!hasActivity) return EMPTY;
  return String(value);
}

function formatDuration(seconds: number, hasActivity: boolean) {
  if (!hasActivity) return EMPTY;
  return formatTalkTime(seconds);
}

function NumericCell({
  value,
  hasActivity,
  className,
}: {
  value: number;
  hasActivity: boolean;
  className?: string;
}) {
  return (
    <TableCell className={cn("text-center tabular-nums", className)}>
      {formatCount(value, hasActivity)}
    </TableCell>
  );
}

function TalkTimeCell({
  seconds,
  hasActivity,
  className,
}: {
  seconds: number;
  hasActivity: boolean;
  className?: string;
}) {
  return (
    <TableCell className={cn("text-center tabular-nums", className)}>
      {formatDuration(seconds, hasActivity)}
    </TableCell>
  );
}

function ReportTableHeader() {
  return (
    <TableHeader className="sticky top-0 z-10">
      <TableRow className="border-0 bg-slate-900 hover:bg-slate-900">
        <TableHead rowSpan={2} className={cn(HEADER_CELL, "min-w-[10rem] text-left align-middle")}>
          User Name
        </TableHead>
        <TableHead colSpan={3} className={cn(HEADER_CELL, "border-b border-slate-700")}>
          Incoming
        </TableHead>
        <TableHead
          colSpan={3}
          className={cn(HEADER_CELL, GROUP_BORDER, "border-b border-slate-700")}
        >
          Outgoing
        </TableHead>
        <TableHead rowSpan={2} className={cn(HEADER_CELL, GROUP_BORDER, "align-middle")}>
          Total TalkTime
        </TableHead>
        <TableHead rowSpan={2} className={cn(HEADER_CELL, "align-middle")}>
          Avg TalkTime
        </TableHead>
        <TableHead rowSpan={2} className={cn(HEADER_CELL, "align-middle")}>
          Min TalkTime
        </TableHead>
        <TableHead rowSpan={2} className={cn(HEADER_CELL, "align-middle")}>
          Max TalkTime
        </TableHead>
        <TableHead rowSpan={2} className={cn(HEADER_CELL, GROUP_BORDER, "align-middle")}>
          Total Calls
        </TableHead>
        <TableHead rowSpan={2} className={cn(HEADER_CELL, GROUP_BORDER, "align-middle")}>
          Site Visits Booked
        </TableHead>
        <TableHead rowSpan={2} className={cn(HEADER_CELL, "align-middle")}>
          Site Visits Conducted
        </TableHead>
      </TableRow>
      <TableRow className="border-0 bg-slate-900 hover:bg-slate-900">
        <TableHead className={cn(HEADER_CELL, "font-medium")}>Answered</TableHead>
        <TableHead className={cn(HEADER_CELL, "font-medium")}>Missed</TableHead>
        <TableHead className={cn(HEADER_CELL, "font-medium")}>Total</TableHead>
        <TableHead className={cn(HEADER_CELL, GROUP_BORDER, "font-medium")}>Answered</TableHead>
        <TableHead className={cn(HEADER_CELL, "font-medium")}>Not Connected</TableHead>
        <TableHead className={cn(HEADER_CELL, "font-medium")}>Total</TableHead>
      </TableRow>
    </TableHeader>
  );
}

function CallsReportPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {start} - {end} of {total} entries
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
          aria-label="First page"
        >
          <ChevronFirst className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[5rem] text-center text-sm tabular-nums">
          Page {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page >= totalPages}
          onClick={() => onPageChange(totalPages)}
          aria-label="Last page"
        >
          <ChevronLast className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function CallsUserReportTableSkeleton({ rowCount }: { rowCount: number }) {
  return (
    <div className="space-y-3">
      <div className="max-h-[min(70vh,42rem)] overflow-auto rounded-md border border-border">
        <Table>
          <ReportTableHeader />
          <TableBody>
            {Array.from({ length: rowCount }, (_, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                {Array.from({ length: 13 }, (__, cellIndex) => (
                  <TableCell
                    key={cellIndex}
                    className={cn(
                      cellIndex === 3 || cellIndex === 6 || cellIndex === 10 || cellIndex === 11
                        ? GROUP_BORDER
                        : undefined,
                    )}
                  >
                    <Skeleton className="mx-auto h-4 w-10" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-between gap-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-48" />
      </div>
    </div>
  );
}

export function CallsUserReportTable({
  rows,
  totals,
  total,
  page,
  pageSize,
  onPageChange,
  isLoading = false,
  className,
}: CallsUserReportTableProps) {
  if (isLoading) {
    return <CallsUserReportTableSkeleton rowCount={pageSize} />;
  }

  if (total === 0) {
    return <p className="text-sm text-muted-foreground">No users match the selected filters.</p>;
  }

  const totalsHaveActivity = totals.totalCalls > 0;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="max-h-[min(70vh,42rem)] overflow-auto rounded-md border border-border">
        <Table>
          <ReportTableHeader />
          <TableBody>
            {rows.map((row) => {
              const hasCallActivity = row.totalCalls > 0;
              return (
                <TableRow key={row.userId} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{row.userName}</TableCell>
                  <NumericCell value={row.incomingAnswered} hasActivity={hasCallActivity} />
                  <NumericCell value={row.incomingMissed} hasActivity={hasCallActivity} />
                  <NumericCell value={row.incomingTotal} hasActivity={hasCallActivity} />
                  <NumericCell
                    value={row.outgoingAnswered}
                    hasActivity={hasCallActivity}
                    className={GROUP_BORDER}
                  />
                  <NumericCell value={row.outgoingNotConnected} hasActivity={hasCallActivity} />
                  <NumericCell value={row.outgoingTotal} hasActivity={hasCallActivity} />
                  <TalkTimeCell
                    seconds={row.totalTalkTimeSeconds}
                    hasActivity={hasCallActivity}
                    className={GROUP_BORDER}
                  />
                  <TalkTimeCell seconds={row.avgTalkTimeSeconds} hasActivity={hasCallActivity} />
                  <TalkTimeCell seconds={row.minTalkTimeSeconds} hasActivity={hasCallActivity} />
                  <TalkTimeCell seconds={row.maxTalkTimeSeconds} hasActivity={hasCallActivity} />
                  <NumericCell
                    value={row.totalCalls}
                    hasActivity={hasCallActivity}
                    className={GROUP_BORDER}
                  />
                  <NumericCell
                    value={row.siteVisitsBooked}
                    hasActivity={row.siteVisitsBooked > 0}
                    className={GROUP_BORDER}
                  />
                  <NumericCell
                    value={row.siteVisitsConducted}
                    hasActivity={row.siteVisitsConducted > 0}
                  />
                </TableRow>
              );
            })}
            <TableRow className="border-t-2 bg-muted/30 font-semibold hover:bg-muted/30">
              <TableCell>Total</TableCell>
              <NumericCell value={totals.incomingAnswered} hasActivity={totalsHaveActivity} />
              <NumericCell value={totals.incomingMissed} hasActivity={totalsHaveActivity} />
              <NumericCell value={totals.incomingTotal} hasActivity={totalsHaveActivity} />
              <NumericCell
                value={totals.outgoingAnswered}
                hasActivity={totalsHaveActivity}
                className={GROUP_BORDER}
              />
              <NumericCell value={totals.outgoingNotConnected} hasActivity={totalsHaveActivity} />
              <NumericCell value={totals.outgoingTotal} hasActivity={totalsHaveActivity} />
              <TalkTimeCell
                seconds={totals.totalTalkTimeSeconds}
                hasActivity={totalsHaveActivity}
                className={GROUP_BORDER}
              />
              <TalkTimeCell seconds={totals.avgTalkTimeSeconds} hasActivity={totalsHaveActivity} />
              <TalkTimeCell seconds={totals.minTalkTimeSeconds} hasActivity={totalsHaveActivity} />
              <TalkTimeCell seconds={totals.maxTalkTimeSeconds} hasActivity={totalsHaveActivity} />
              <NumericCell
                value={totals.totalCalls}
                hasActivity={totalsHaveActivity}
                className={GROUP_BORDER}
              />
              <NumericCell
                value={totals.siteVisitsBooked}
                hasActivity={totals.siteVisitsBooked > 0}
                className={GROUP_BORDER}
              />
              <NumericCell
                value={totals.siteVisitsConducted}
                hasActivity={totals.siteVisitsConducted > 0}
              />
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <CallsReportPagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
      />
    </div>
  );
}
