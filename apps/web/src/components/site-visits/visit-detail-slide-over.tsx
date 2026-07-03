"use client";

import { ProjectSelect } from "@/components/projects/project-select";
import {
  AddToCalendarDropdown,
  siteVisitToCalendarEvent,
} from "@/components/site-visits/add-to-calendar-dropdown";
import { TaskSlideOver } from "@/components/tasks/task-slide-over";
import {
  type SiteVisit,
  formatVisitTime,
  useCancelSiteVisit,
  useUpdateSiteVisit,
  visitStatusColor,
} from "@/hooks/use-site-visits";
import { siteVisitCustomerUrlFromToken } from "@/lib/site-visit-customer-url";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import Link from "next/link";
import { useEffect, useState } from "react";

type VisitDetailSlideOverProps = {
  visit: SiteVisit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
};

export function VisitDetailSlideOver({
  visit,
  open,
  onOpenChange,
  onCompleted,
}: VisitDetailSlideOverProps) {
  const updateVisit = useUpdateSiteVisit();
  const cancelVisit = useCancelSiteVisit();
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [completeProjectId, setCompleteProjectId] = useState("");

  useEffect(() => {
    if (visit) {
      setCompleteProjectId(visit.projectId ?? "");
    }
  }, [visit?.id, visit?.projectId]);

  if (!visit) return null;

  const v = visit;
  const leadName = v.lead ? `${v.lead.firstName} ${v.lead.lastName}` : "Lead";
  const property = v.propertyLabel ?? v.propertyAddress ?? "—";

  async function setStatus(status: SiteVisit["status"]) {
    await updateVisit.mutateAsync({ id: v.id, payload: { status } });
    if (status === "completed") onCompleted?.();
  }

  async function handleMarkComplete() {
    if (!completeProjectId) {
      toast.error("Select which project the client visited before marking complete.");
      return;
    }

    try {
      await updateVisit.mutateAsync({
        id: v.id,
        payload: { status: "completed", projectId: completeProjectId },
      });
      onCompleted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not complete visit");
    }
  }

  async function handleReschedule() {
    if (!rescheduleDate || !rescheduleTime) return;
    await updateVisit.mutateAsync({
      id: v.id,
      payload: { visitDate: rescheduleDate, visitTime: rescheduleTime, status: "scheduled" },
    });
  }

  return (
    <TaskSlideOver
      open={open}
      onOpenChange={onOpenChange}
      title={leadName}
      description={`${v.visitDate} · ${formatVisitTime(v.visitTime)} · ${v.duration} min`}
      footer={
        <div className="flex flex-wrap gap-2">
          {v.status === "scheduled" ? (
            <Button
              size="sm"
              onClick={() => void handleMarkComplete()}
              disabled={updateVisit.isPending}
            >
              Mark complete
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" onClick={() => void setStatus("no_show")}>
            No show
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void cancelVisit.mutateAsync(v.id).then(() => onOpenChange(false))}
          >
            Cancel visit
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <span
          className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
          style={{ backgroundColor: visitStatusColor(v.status) }}
        >
          {v.status.replace("_", " ")}
        </span>

        <div>
          <p className="text-sm font-medium">Property</p>
          <p className="text-sm text-muted-foreground">{property}</p>
        </div>
        {v.status === "scheduled" ? (
          <div className="space-y-2">
            <Label htmlFor="complete-project">Project visited</Label>
            <ProjectSelect
              id="complete-project"
              value={completeProjectId}
              onChange={setCompleteProjectId}
            />
            <p className="text-xs text-muted-foreground">
              Required when marking the site visit as complete.
            </p>
          </div>
        ) : v.project ? (
          <div>
            <p className="text-sm font-medium">Project visited</p>
            <p className="text-sm text-muted-foreground">{v.project.name}</p>
          </div>
        ) : null}
        <div>
          <p className="text-sm font-medium">Agent</p>
          <p className="text-sm text-muted-foreground">{v.agent?.name ?? "—"}</p>
        </div>
        {v.notes ? (
          <div>
            <p className="text-sm font-medium">Notes</p>
            <p className="text-sm text-muted-foreground">{v.notes}</p>
          </div>
        ) : null}
        {v.lead ? (
          <Link
            href={`/leads/${v.leadId}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            View lead profile
          </Link>
        ) : null}

        <AddToCalendarDropdown event={siteVisitToCalendarEvent(v)} />

        {v.publicToken ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              void navigator.clipboard
                .writeText(siteVisitCustomerUrlFromToken(v.publicToken))
                .then(() => toast.success("Customer link copied"))
                .catch(() => toast.error("Could not copy link"));
            }}
          >
            Copy customer link
          </Button>
        ) : null}

        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-sm font-semibold">Reschedule</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Time</Label>
              <Input
                type="time"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
              />
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void handleReschedule()}>
            Save new time
          </Button>
        </div>
      </div>
    </TaskSlideOver>
  );
}
