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
};

export function CallsListTable({ calls, showLead = false }: CallsListTableProps) {
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
          {showLead ? <TableHead>Lead</TableHead> : null}
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
          <TableRow key={call.id}>
            <TableCell>{new Date(call.startedAt).toLocaleString()}</TableCell>
            {showLead ? (
              <TableCell>
                {call.lead ? (
                  <Link href={`/leads/${call.lead.id}`} className="text-primary hover:underline">
                    {call.lead.firstName} {call.lead.lastName}
                  </Link>
                ) : (
                  call.phoneNumber
                )}
              </TableCell>
            ) : null}
            <TableCell className="capitalize">{call.direction}</TableCell>
            <TableCell className="capitalize">{call.status}</TableCell>
            <TableCell>{formatDuration(call.durationSeconds)}</TableCell>
            <TableCell>{call.disposition ?? "—"}</TableCell>
            <TableCell>{call.userName ?? "—"}</TableCell>
            <TableCell className="max-w-[200px] truncate">{call.notes ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
