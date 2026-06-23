"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AnalyticsLeadPreview, AnalyticsOverview } from "@/hooks/use-analytics";
import { useBulkLeadActions } from "@/hooks/use-bulk-leads";
import { useUsers } from "@/hooks/use-users";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { Label } from "@propninja/ui/label";
import { AlertTriangle, Clock, Snowflake, UserX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const selectClass =
  "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function LeadPreviewTable({
  items,
  extraColumn,
}: {
  items: AnalyticsLeadPreview[];
  extraColumn?: { header: string; render: (lead: AnalyticsLeadPreview) => string };
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">None right now.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="pb-2 pr-4">Lead</th>
            <th className="pb-2 pr-4">Agent</th>
            <th className="pb-2 pr-4">Stage</th>
            {extraColumn ? <th className="pb-2">{extraColumn.header}</th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((lead) => (
            <tr key={lead.id} className="border-t border-border/40">
              <td className="py-2 pr-4">
                <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                  {lead.name}
                </Link>
              </td>
              <td className="py-2 pr-4 text-muted-foreground">{lead.agentName ?? "—"}</td>
              <td className="py-2 pr-4 capitalize text-muted-foreground">
                {lead.leadStatus.replace(/_/g, " ")}
              </td>
              {extraColumn ? (
                <td className="py-2 tabular-nums text-muted-foreground">
                  {extraColumn.render(lead)}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type AnalyticsHealthProps = {
  health: AnalyticsOverview["health"];
  onAssignComplete?: () => void;
};

export function AnalyticsHealth({ health, onAssignComplete }: AnalyticsHealthProps) {
  const { data: users } = useUsers();
  const bulk = useBulkLeadActions();
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");

  const unassignedIds = health.unassignedLeads.leadIds;

  async function handleAssignAll() {
    if (!assignUserId || unassignedIds.length === 0) return;
    const result = await bulk.assign.mutateAsync({
      leadIds: unassignedIds,
      userId: assignUserId,
    });
    setAssignOpen(false);
    if (result.succeeded.length > 0) {
      onAssignComplete?.();
    }
  }

  const agents = (users ?? []).filter((u) => u.isActive);

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Snowflake className="h-4 w-4 text-sky-500" />
              Cold leads
            </CardTitle>
            <span className="text-sm font-semibold tabular-nums">{health.coldLeads.count}</span>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">No contact in 7+ days</p>
            <LeadPreviewTable
              items={health.coldLeads.preview}
              extraColumn={{
                header: "Days silent",
                render: (lead) => `${lead.daysSinceContact ?? 0}d`,
              }}
            />
          </CardContent>
        </Card>

        <Card className="">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Overdue follow-ups
            </CardTitle>
            <span className="text-sm font-semibold tabular-nums">
              {health.overdueFollowUps.count}
            </span>
          </CardHeader>
          <CardContent>
            <LeadPreviewTable
              items={health.overdueFollowUps.preview}
              extraColumn={{
                header: "Days overdue",
                render: (lead) => `${lead.daysOverdue ?? 0}d`,
              }}
            />
          </CardContent>
        </Card>

        <Card className="">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserX className="h-4 w-4 text-violet-500" />
              Unassigned leads
            </CardTitle>
            <span className="text-sm font-semibold tabular-nums">
              {health.unassignedLeads.count}
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            <LeadPreviewTable items={health.unassignedLeads.preview} />
            {health.unassignedLeads.count > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setAssignOpen(true)}
                disabled={unassignedIds.length === 0}
              >
                Assign All
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card className="">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-amber-600" />
              Stale pipeline
            </CardTitle>
            <span className="text-sm font-semibold tabular-nums">{health.stalePipeline.count}</span>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">Same stage for 14+ days</p>
            <LeadPreviewTable
              items={health.stalePipeline.preview}
              extraColumn={{
                header: "Days in stage",
                render: (lead) => `${lead.daysInStage ?? 0}d`,
              }}
            />
          </CardContent>
        </Card>
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign unassigned leads</DialogTitle>
            <DialogDescription>
              Bulk-assign all {health.unassignedLeads.count} unassigned lead
              {health.unassignedLeads.count === 1 ? "" : "s"} to an agent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="assign-agent">Agent</Label>
            <select
              id="assign-agent"
              className={selectClass}
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
            >
              <option value="">Select agent…</option>
              {agents.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAssignAll}
              disabled={!assignUserId || bulk.assign.isPending}
            >
              {bulk.assign.isPending ? "Assigning…" : "Assign all"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
