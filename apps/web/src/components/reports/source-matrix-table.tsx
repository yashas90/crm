"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SourceMatrixCount, SourceMatrixRow } from "@/hooks/use-reports";
import { cn } from "@propninja/ui/lib/utils";

export const SOURCE_MATRIX_COLUMNS: {
  key: keyof Omit<SourceMatrixRow, "source">;
  label: string;
}[] = [
  { key: "allLeads", label: "All Leads" },
  { key: "newLeads", label: "New" },
  { key: "pending", label: "Pending" },
  { key: "callback", label: "Callback" },
  { key: "qualified", label: "Qualified" },
  { key: "duplicate", label: "Duplicate" },
  { key: "meetingScheduled", label: "Meeting Scheduled" },
  { key: "meetingDone", label: "Meeting Done" },
  { key: "meetingNotDone", label: "Meeting Not Done" },
  { key: "siteVisitScheduled", label: "Site Visit Scheduled" },
  { key: "siteVisitDone", label: "Site Visit Done" },
  { key: "siteVisitNotDone", label: "Site Visit Not Done" },
  { key: "booked", label: "Booked" },
  { key: "bookingCancel", label: "Booking Cancel" },
  { key: "notInterested", label: "Not Interested" },
  { key: "dropped", label: "Dropped" },
  { key: "expressionOfInterest", label: "Expression Of Interest" },
];

const HEADER_CELL =
  "sticky top-0 z-20 min-w-[7.5rem] bg-slate-900 px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-white dark:bg-slate-950";
const SOURCE_HEADER = "left-0 z-30 min-w-[10rem] text-left";
const DATA_CELL = "px-3 py-2 text-center align-top";
const SOURCE_CELL = "sticky left-0 z-10 bg-background text-left font-medium";

function CountCell({ value, emphasize }: { value: SourceMatrixCount; emphasize?: boolean }) {
  if (!value.count) {
    return (
      <TableCell className={cn(DATA_CELL, "text-muted-foreground", emphasize && "font-semibold")}>
        —
      </TableCell>
    );
  }

  return (
    <TableCell className={DATA_CELL}>
      <div className={cn("tabular-nums text-sm font-semibold", emphasize && "text-base")}>
        {value.count}
      </div>
      <div className="text-[10px] font-normal text-muted-foreground">
        unique count: {value.unique}
      </div>
    </TableCell>
  );
}

type SourceMatrixTableProps = {
  rows: SourceMatrixRow[];
  totals: SourceMatrixRow;
};

export function SourceMatrixTable({ rows, totals }: SourceMatrixTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
      <Table>
        <TableHeader>
          <TableRow className="border-0 hover:bg-transparent">
            <TableHead className={cn(HEADER_CELL, SOURCE_HEADER)}>Source Name</TableHead>
            {SOURCE_MATRIX_COLUMNS.map((column) => (
              <TableHead key={column.key} className={HEADER_CELL}>
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.source}>
              <TableCell className={cn(DATA_CELL, SOURCE_CELL)}>{row.source}</TableCell>
              {SOURCE_MATRIX_COLUMNS.map((column) => (
                <CountCell key={column.key} value={row[column.key]} />
              ))}
            </TableRow>
          ))}
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableCell className={cn(DATA_CELL, SOURCE_CELL, "bg-muted/40 font-bold")}>
              {totals.source}
            </TableCell>
            {SOURCE_MATRIX_COLUMNS.map((column) => (
              <CountCell key={column.key} value={totals[column.key]} emphasize />
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
