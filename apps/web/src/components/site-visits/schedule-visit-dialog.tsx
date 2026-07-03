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
import { useProjectUnits } from "@/hooks/use-project-units";
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
  const [unitId, setUnitId] = useState("");
  const [tower, setTower] = useState("");
  const [agentId, setAgentId] = useState(defaultAgentId ?? session?.id ?? "");
  const [visitDate, setVisitDate] = useState(() => getIstDateKey());
  const [visitTime, setVisitTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [duration, setDuration] = useState("60");
  const [notes, setNotes] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [mapsLink, setMapsLink] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [confirmedVisit, setConfirmedVisit] = useState<SiteVisit | null>(null);
  const { data: unitsData } = useProjectUnits(projectId);

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

  function computeDurationFromTimes(start: string, end: string) {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const startMins = (sh ?? 0) * 60 + (sm ?? 0);
    const endMins = (eh ?? 0) * 60 + (em ?? 0);
    const diff = endMins - startMins;
    return diff > 0 ? diff : Number(duration) || 60;
  }

  async function handleSubmit() {
    if (!leadId) return;
    const selectedLead = filteredLeads.find((l) => l.id === leadId);
    const payload: CreateSiteVisitInput = {
      leadId,
      projectId: projectId || null,
      unitId: unitId || null,
      tower: tower.trim() || null,
      visitDate,
      visitTime,
      duration: computeDurationFromTimes(visitTime, endTime),
      notes: notes.trim() || null,
      propertyAddress: propertyAddress.trim() || null,
      meetingLocation: meetingLocation.trim() || null,
      mapsLink: mapsLink.trim() || null,
      customerEmail: customerEmail.trim() || selectedLead?.email || null,
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
                <Label>Project</Label>
                <select
                  className={selectClass}
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    setUnitId("");
                  }}
                >
                  <option value="">No project</option>
                  {(projects ?? []).map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              {projectId ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Tower</Label>
                    <Input
                      value={tower}
                      onChange={(e) => setTower(e.target.value)}
                      placeholder="Tower A"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <select
                      className={selectClass}
                      value={unitId}
                      onChange={(e) => setUnitId(e.target.value)}
                    >
                      <option value="">Select unit</option>
                      {(unitsData ?? []).map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.unitNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Customer email (optional)</Label>
                  <Input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="For calendar invite"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mobile</Label>
                  <Input
                    disabled
                    value={
                      filteredLeads.find((l) => l.id === leadId)?.phone ??
                      (defaultLeadId ? "From lead record" : "Select a lead")
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start time</Label>
                  <Input
                    type="time"
                    value={visitTime}
                    onChange={(e) => setVisitTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End time</Label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Meeting location</Label>
                <Input
                  value={meetingLocation}
                  onChange={(e) => setMeetingLocation(e.target.value)}
                  placeholder="Sales office, model flat, etc."
                />
              </div>

              <div className="space-y-2">
                <Label>Google Maps link</Label>
                <Input
                  value={mapsLink}
                  onChange={(e) => setMapsLink(e.target.value)}
                  placeholder="https://maps.google.com/..."
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
