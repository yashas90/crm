"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CallRecord } from "@/hooks/use-leads";
import Link from "next/link";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type CallsListTableProps = {
  calls: CallRecord[];
  showLead?: boolean;
  showLeadId?: boolean;
  showPhone?: boolean;
};

export function CallsListTable({
  calls,
  showLead = false,
  showLeadId = false,
  showPhone = false,
}: CallsListTableProps) {
  if (calls.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No calls found for the selected filters.</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date / time</TableHead>
          {showLeadId ? <TableHead>Lead ID</TableHead> : null}
          {showLead ? <TableHead>Lead</TableHead> : null}
          {showPhone ? <TableHead>Phone</TableHead> : null}
          <TableHead>Direction</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Disposition</TableHead>
          <TableHead>Agent</TableHead>
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {calls.map((call) => (
          <TableRow key={call.id} className="dark:hover:bg-slate-800/60">
            <TableCell className="whitespace-nowrap tabular-nums font-medium text-foreground">
              {new Date(call.startedAt).toLocaleString()}
            </TableCell>
            {showLeadId ? (
              <TableCell className="font-mono text-sm font-semibold text-primary">
                {call.lead?.leadCode ?? "—"}
              </TableCell>
            ) : null}
            {showLead ? (
              <TableCell>
                {call.lead ? (
                  <Link
                    href={`/leads/${call.lead.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {call.lead.firstName} {call.lead.lastName}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Unlinked</span>
                )}
              </TableCell>
            ) : null}
            {showPhone ? (
              <TableCell className="tabular-nums text-foreground">{call.phoneNumber}</TableCell>
            ) : null}
            <TableCell className="capitalize text-foreground">{call.direction}</TableCell>
            <TableCell className="capitalize text-foreground">{call.status}</TableCell>
            <TableCell className="tabular-nums font-semibold text-foreground">
              {formatDuration(call.durationSeconds)}
            </TableCell>
            <TableCell className="text-foreground">{call.disposition ?? "—"}</TableCell>
            <TableCell className="text-foreground">{call.userName ?? "—"}</TableCell>
            <TableCell className="max-w-[200px] truncate text-foreground">
              {call.notes ?? "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
