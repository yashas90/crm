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

const HEADER_CELL = "bg-slate-900 font-semibold text-slate-50";
const GROUP_BORDER = "border-l-2 border-slate-700";

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

function NumericCell({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return <TableCell className={cn("text-right tabular-nums", className)}>{value}</TableCell>;
}

function TalkTimeCell({
  seconds,
  className,
}: {
  seconds: number;
  className?: string;
}) {
  return (
    <TableCell className={cn("text-right tabular-nums", className)}>
      {formatTalkTime(seconds)}
    </TableCell>
  );
}

function ReportTableHeader() {
  return (
    <TableHeader className="sticky top-0 z-10">
      <TableRow className="border-0 bg-slate-900 hover:bg-slate-900">
        <TableHead className={cn(HEADER_CELL, "min-w-[10rem]")}>User Name</TableHead>
        <TableHead className={cn(HEADER_CELL, "text-right")}>Incoming Answered</TableHead>
        <TableHead className={cn(HEADER_CELL, "text-right")}>Incoming Missed</TableHead>
        <TableHead className={cn(HEADER_CELL, "text-right")}>Incoming Total</TableHead>
        <TableHead className={cn(HEADER_CELL, GROUP_BORDER, "text-right")}>
          Outgoing Answered
        </TableHead>
        <TableHead className={cn(HEADER_CELL, "text-right")}>Outgoing Not Connected</TableHead>
        <TableHead className={cn(HEADER_CELL, "text-right")}>Outgoing Total</TableHead>
        <TableHead className={cn(HEADER_CELL, GROUP_BORDER, "text-right")}>
          Total TalkTime
        </TableHead>
        <TableHead className={cn(HEADER_CELL, "text-right")}>Avg TalkTime</TableHead>
        <TableHead className={cn(HEADER_CELL, "text-right")}>Min TalkTime</TableHead>
        <TableHead className={cn(HEADER_CELL, "text-right")}>Max TalkTime</TableHead>
        <TableHead className={cn(HEADER_CELL, GROUP_BORDER, "text-right")}>Total Calls</TableHead>
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
        Showing {start}-{end} of {total} entries
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
                {Array.from({ length: 11 }, (__, cellIndex) => (
                  <TableCell
                    key={cellIndex}
                    className={cn(
                      cellIndex === 3 || cellIndex === 6 || cellIndex === 10
                        ? GROUP_BORDER
                        : undefined,
                    )}
                  >
                    <Skeleton className="ml-auto h-4 w-10" />
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
    return (
      <p className="text-sm text-muted-foreground">No call activity for the selected filters.</p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="max-h-[min(70vh,42rem)] overflow-auto rounded-md border border-border">
        <Table>
          <ReportTableHeader />
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.userId} className="hover:bg-muted/50">
                <TableCell className="font-medium">{row.userName}</TableCell>
                <NumericCell value={row.incomingAnswered} />
                <NumericCell value={row.incomingMissed} />
                <NumericCell value={row.incomingTotal} />
                <NumericCell value={row.outgoingAnswered} className={GROUP_BORDER} />
                <NumericCell value={row.outgoingNotConnected} />
                <NumericCell value={row.outgoingTotal} />
                <TalkTimeCell seconds={row.totalTalkTimeSeconds} className={GROUP_BORDER} />
                <TalkTimeCell seconds={row.avgTalkTimeSeconds} />
                <TalkTimeCell seconds={row.minTalkTimeSeconds} />
                <TalkTimeCell seconds={row.maxTalkTimeSeconds} />
                <NumericCell value={row.totalCalls} className={GROUP_BORDER} />
              </TableRow>
            ))}
            <TableRow className="border-t-2 bg-muted/30 font-semibold hover:bg-muted/30">
              <TableCell>Total</TableCell>
              <NumericCell value={totals.incomingAnswered} />
              <NumericCell value={totals.incomingMissed} />
              <NumericCell value={totals.incomingTotal} />
              <NumericCell value={totals.outgoingAnswered} className={GROUP_BORDER} />
              <NumericCell value={totals.outgoingNotConnected} />
              <NumericCell value={totals.outgoingTotal} />
              <TalkTimeCell seconds={totals.totalTalkTimeSeconds} className={GROUP_BORDER} />
              <TalkTimeCell seconds={totals.avgTalkTimeSeconds} />
              <TalkTimeCell seconds={totals.minTalkTimeSeconds} />
              <TalkTimeCell seconds={totals.maxTalkTimeSeconds} />
              <NumericCell value={totals.totalCalls} className={GROUP_BORDER} />
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
