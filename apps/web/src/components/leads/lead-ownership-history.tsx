"use client";

import { EmptyState } from "@/components/common/empty-state";
import type { LeadAssignment } from "@/hooks/use-leads";
import { cn } from "@propninja/ui/lib/utils";
import { ArrowRightLeft } from "lucide-react";

function formatAssignmentDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export function formatOwnershipEntry(assignment: LeadAssignment) {
  const date = formatAssignmentDate(assignment.assignedAt);
  const verb = assignment.fromAgentId ? "Reassigned to" : "Assigned to";
  return `${verb} ${assignment.toAgentName} by ${assignment.assignedByName} on ${date}`;
}

type LeadOwnershipHistoryProps = {
  assignments: LeadAssignment[];
  isLoading?: boolean;
};

export function LeadOwnershipHistory({ assignments, isLoading }: LeadOwnershipHistoryProps) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading ownership history...</p>;
  }

  if (assignments.length === 0) {
    return (
      <EmptyState
        title="No ownership changes yet"
        description="Assignment and reassignment events will appear here."
        icon={<ArrowRightLeft className="h-7 w-7" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Ownership history</h3>
        <p className="text-xs text-muted-foreground">
          Every assignment and reassignment for this lead.
        </p>
      </div>
      <div className="relative space-y-0">
        <div className="absolute bottom-2 left-[18px] top-2 w-px bg-border" />
        {assignments.map((assignment, index) => {
          const fromLabel = assignment.fromAgentName ?? "Unassigned";
          return (
            <div key={assignment.id} className="relative flex gap-4 pb-6 last:pb-0">
              <div
                className={cn(
                  "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-500/30 bg-card text-violet-600 shadow-[2px_2px_0_0_#000]",
                )}
              >
                <ArrowRightLeft className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 rounded-lg border border-slate-200/80 bg-muted/20 p-3 dark:border-white/10">
                <p className="text-sm font-semibold">{formatOwnershipEntry(assignment)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {fromLabel} → {assignment.toAgentName}
                </p>
                {assignment.reason?.trim() ? (
                  <p className="mt-2 text-sm text-foreground/90">{assignment.reason.trim()}</p>
                ) : null}
                {index === 0 ? (
                  <span className="mt-2 inline-block text-[10px] font-medium uppercase tracking-wide text-primary">
                    Latest
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
