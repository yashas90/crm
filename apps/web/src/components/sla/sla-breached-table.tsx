"use client";

import { EmptyState } from "@/components/common/empty-state";
import { StatusChip } from "@/components/leads/lead-chips";
import { formatRelativeTime } from "@/lib/relative-time";
import type { SlaBreachedLead } from "@/lib/sla";
import { Button } from "@propninja/ui/button";
import { cn } from "@propninja/ui/lib/utils";
import { AlertTriangle, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";

type SlaBreachedTableProps = {
  items: SlaBreachedLead[];
  total: number;
  page: number;
  pageSize: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
};

function severityClass(days: number) {
  if (days >= 14) return "text-red-700 dark:text-red-300";
  if (days >= 7) return "text-rose-700 dark:text-rose-300";
  if (days >= 3) return "text-orange-700 dark:text-orange-300";
  return "text-amber-700 dark:text-amber-300";
}

export function SlaBreachedTable({
  items,
  total,
  page,
  pageSize,
  isLoading,
  onPageChange,
}: SlaBreachedTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (!isLoading && items.length === 0) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-7 w-7" />}
        title="No SLA breaches"
        description="All active pipeline leads have recent engagement within your selected threshold."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:bg-white/5">
            <tr>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Assignee</th>
              <th className="px-4 py-3">Last activity</th>
              <th className="px-4 py-3">Inactive</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={`sk-${i}`} className="border-t border-slate-100 dark:border-white/5">
                    <td colSpan={6} className="px-4 py-4">
                      <div className="h-4 animate-pulse rounded bg-muted" />
                    </td>
                  </tr>
                ))
              : items.map((lead) => {
                  const name = `${lead.firstName} ${lead.lastName}`.trim();
                  return (
                    <tr
                      key={lead.id}
                      className="border-t border-slate-100 transition-colors hover:bg-muted/30 dark:border-white/5"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground">{lead.phone ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip status={lead.leadStatus} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {lead.assignedUser?.name ?? "Unassigned"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatRelativeTime(lead.inactiveSince)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 font-semibold tabular-nums",
                            severityClass(lead.daysSinceActivity),
                          )}
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {lead.daysSinceActivity}d
                        </span>
                        {lead.slaBreachedAt ? (
                          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-rose-600">
                            Flagged
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/leads/${lead.id}`}>
                            Open
                            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {page} of {totalPages} · {total} lead{total === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
