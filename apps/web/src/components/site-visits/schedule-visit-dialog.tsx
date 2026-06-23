"use client";

import {
  AddToCalendarDropdown,
  siteVisitToCalendarEvent,
} from "@/components/site-visits/add-to-calendar-dropdown";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLeads } from "@/hooks/use-leads";
import { useProjects } from "@/hooks/use-projects";
import { useSession } from "@/hooks/use-session";
import {
  type CreateSiteVisitInput,
  type SiteVisit,
  formatVisitTime,
  useCreateSiteVisit,
} from "@/hooks/use-site-visits";
import { useUsers } from "@/hooks/use-users";
import { getIstDateKey } from "@propninja/types/ist";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { useEffect, useMemo, useState } from "react";

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

type ScheduleVisitDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultLeadId?: string;
  defaultAgentId?: string;
};

export function ScheduleVisitDialog({
  open,
  onOpenChange,
  defaultLeadId,
  defaultAgentId,
}: ScheduleVisitDialogProps) {
  const { session } = useSession();
  const isManager = session?.role === "admin" || session?.role === "manager";
  const createVisit = useCreateSiteVisit();
  const { data: leadsData } = useLeads({ pageSize: "100" }, { enabled: open });
  const { data: projects } = useProjects({ availability: true });
  const { data: users } = useUsers();

  const [leadId, setLeadId] = useState(defaultLeadId ?? "");
  const [projectId, setProjectId] = useState("");
  const [agentId, setAgentId] = useState(defaultAgentId ?? session?.id ?? "");
  const [visitDate, setVisitDate] = useState(() => getIstDateKey());
  const [visitTime, setVisitTime] = useState("10:00");
  const [duration, setDuration] = useState("60");
  const [notes, setNotes] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [confirmedVisit, setConfirmedVisit] = useState<SiteVisit | null>(null);

  useEffect(() => {
    if (!open) {
      setConfirmedVisit(null);
      return;
    }
    setLeadId(defaultLeadId ?? "");
    setAgentId(defaultAgentId ?? session?.id ?? "");
  }, [open, defaultLeadId, defaultAgentId, session?.id]);

  function handleClose() {
    setConfirmedVisit(null);
    onOpenChange(false);
  }

  const filteredLeads = useMemo(() => {
    const items = leadsData?.items ?? [];
    const q = leadSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((lead) => {
      const name = `${lead.firstName} ${lead.lastName}`.toLowerCase();
      return name.includes(q) || (lead.phone ?? "").includes(q);
    });
  }, [leadsData?.items, leadSearch]);

  async function handleSubmit() {
    if (!leadId) return;
    const payload: CreateSiteVisitInput = {
      leadId,
      projectId: projectId || null,
      visitDate,
      visitTime,
      duration: Number(duration) || 60,
      notes: notes.trim() || null,
      propertyAddress: propertyAddress.trim() || null,
    };
    if (isManager && agentId) payload.agentId = agentId;

    const created = await createVisit.mutateAsync(payload);
    setConfirmedVisit(created);
  }

  const calendarEvent = confirmedVisit ? siteVisitToCalendarEvent(confirmedVisit) : null;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-w-lg">
        {confirmedVisit && calendarEvent ? (
          <>
            <DialogHeader>
              <DialogTitle>Visit scheduled</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {calendarEvent.leadName} · {confirmedVisit.visitDate} ·{" "}
                {formatVisitTime(confirmedVisit.visitTime)} · {confirmedVisit.duration} min
              </p>
              <p className="text-sm">
                {confirmedVisit.propertyLabel ??
                  confirmedVisit.propertyAddress ??
                  calendarEvent.projectName ??
                  "Property TBD"}
              </p>
              <AddToCalendarDropdown event={calendarEvent} className="w-full" />
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Schedule site visit</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {!defaultLeadId ? (
                <div className="space-y-2">
                  <Label>Search lead</Label>
                  <Input
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                    placeholder="Name or phone"
                  />
                  <select
                    className={selectClass}
                    value={leadId}
                    onChange={(e) => setLeadId(e.target.value)}
                  >
                    <option value="">Select lead</option>
                    {filteredLeads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.firstName} {lead.lastName} · {lead.phone ?? "No phone"}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Project (optional)</Label>
                <select
                  className={selectClass}
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">No project</option>
                  {(projects ?? []).map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={visitTime}
                    onChange={(e) => setVisitTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  min={15}
                  max={480}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>

              {isManager ? (
                <div className="space-y-2">
                  <Label>Agent</Label>
                  <select
                    className={selectClass}
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                  >
                    {(users ?? []).map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Property address (if no project)</Label>
                <Input
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value)}
                  placeholder="Site address"
                />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <textarea
                  className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleSubmit()}
                disabled={!leadId || createVisit.isPending}
              >
                {createVisit.isPending ? "Scheduling…" : "Schedule visit"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
