"use client";

import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TeamPerformanceRow } from "@/hooks/use-reports";
import { Users } from "lucide-react";

type TeamPerformanceTableProps = {
  team: TeamPerformanceRow[];
};

function pickNinja(team: TeamPerformanceRow[]) {
  if (team.length === 0) return null;
  return [...team].sort((a, b) => {
    const scoreA = a.deals_won_month * 10 + a.calls_today;
    const scoreB = b.deals_won_month * 10 + b.calls_today;
    return scoreB - scoreA;
  })[0];
}

export function TeamPerformanceTable({ team }: TeamPerformanceTableProps) {
  if (team.length === 0) {
    return (
      <EmptyState
        title="No team data yet"
        description="Agent activity will appear here once your team starts logging calls."
        icon={<Users className="h-7 w-7" />}
      />
    );
  }

  const ninja = pickNinja(team);

  return (
    <div className="overflow-hidden border-2 border-black">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agent</TableHead>
            <TableHead className="text-right">Leads owned</TableHead>
            <TableHead className="text-right">Calls (today)</TableHead>
            <TableHead className="text-right">Avg duration (today)</TableHead>
            <TableHead className="text-right">Won (month)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {team.map((row) => (
            <TableRow
              key={row.user_id}
              className="transition-colors duration-150 hover:bg-slate-50 dark:hover:bg-slate-900/50"
            >
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{row.name}</span>
                  {ninja && row.user_id === ninja.user_id ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300">
                      Ninja of the day
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-right">{row.leads_owned}</TableCell>
              <TableCell className="text-right">{row.calls_today}</TableCell>
              <TableCell className="text-right">{row.avg_duration_today}s</TableCell>
              <TableCell className="text-right font-semibold">{row.deals_won_month}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
