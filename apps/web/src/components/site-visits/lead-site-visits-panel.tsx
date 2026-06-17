"use client";

import { ScheduleVisitDialog } from "@/components/site-visits/schedule-visit-dialog";
import { VisitDetailSlideOver } from "@/components/site-visits/visit-detail-slide-over";
import {
  type SiteVisit,
  formatVisitTime,
  useSiteVisits,
  visitStatusColor,
} from "@/hooks/use-site-visits";
import { Button } from "@propninja/ui/button";
import { useState } from "react";

type LeadSiteVisitsPanelProps = {
  leadId: string;
};

export function LeadSiteVisitsPanel({ leadId }: LeadSiteVisitsPanelProps) {
  const { data, isLoading } = useSiteVisits({ leadId, pageSize: 50 });
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selected, setSelected] = useState<SiteVisit | null>(null);

  const visits = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{visits.length} visit(s) for this lead</p>
        <Button size="sm" onClick={() => setScheduleOpen(true)}>
          Schedule visit
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading visits…</p>
      ) : visits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No site visits scheduled yet.</p>
      ) : (
        <div className="space-y-3">
          {visits.map((visit) => (
            <button
              key={visit.id}
              type="button"
              onClick={() => setSelected(visit)}
              className="flex w-full items-start gap-3 rounded-lg border border-border p-4 text-left transition hover:bg-muted/40"
            >
              <span
                className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: visitStatusColor(visit.status) }}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {visit.visitDate} · {formatVisitTime(visit.visitTime)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {visit.propertyLabel ?? visit.propertyAddress ?? "Property TBD"} ·{" "}
                  {visit.agent?.name ?? "Agent"}
                </p>
                {visit.notes ? (
                  <p className="mt-1 text-sm text-muted-foreground">{visit.notes}</p>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      )}

      <ScheduleVisitDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        defaultLeadId={leadId}
      />

      <VisitDetailSlideOver
        visit={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
