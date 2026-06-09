"use client";

import { ProjectSelect } from "@/components/projects/project-select";
import type { LeadRow } from "@/hooks/use-leads";
import { apiPatch } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { LEAD_SOURCE_OPTIONS, normalizeLeadSourceValue } from "@/lib/lead-sources";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

const STATUSES = ["new", "contacted", "qualified", "negotiation", "won", "lost"] as const;
const TEMPERATURES = ["cold", "warm", "hot"] as const;

function toDatetimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type LeadEditFormProps = {
  lead: LeadRow & {
    city?: string | null;
    state?: string | null;
    notes?: string | null;
    secondaryPhone?: string | null;
    tags?: string[] | null;
    nextFollowupAt?: string | null;
    estimatedValue?: string | null;
    projectName?: string | null;
    projectId?: string | null;
  };
  onSuccess?: () => void;
};

export function LeadEditForm({ lead, onSuccess }: LeadEditFormProps) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState(lead.firstName);
  const [lastName, setLastName] = useState(lead.lastName);
  const [phone, setPhone] = useState(lead.phone ?? "");
  const [secondaryPhone, setSecondaryPhone] = useState(lead.secondaryPhone ?? "");
  const [email, setEmail] = useState(lead.email ?? "");
  const [city, setCity] = useState(lead.city ?? "");
  const [state, setState] = useState(lead.state ?? "");
  const [leadSource, setLeadSource] = useState(
    () => normalizeLeadSourceValue(lead.leadSource ?? "") || lead.leadSource || "",
  );
  const [leadStatus, setLeadStatus] = useState(lead.leadStatus);
  const [temperature, setTemperature] = useState(lead.temperature ?? "");
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [tags, setTags] = useState((lead.tags ?? []).join(", "));
  const [nextFollowupAt, setNextFollowupAt] = useState(toDatetimeLocal(lead.nextFollowupAt));
  const [estimatedValue, setEstimatedValue] = useState(lead.estimatedValue ?? "");
  const [projectId, setProjectId] = useState(lead.projectId ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFirstName(lead.firstName);
    setLastName(lead.lastName);
    setPhone(lead.phone ?? "");
    setSecondaryPhone(lead.secondaryPhone ?? "");
    setEmail(lead.email ?? "");
    setCity(lead.city ?? "");
    setState(lead.state ?? "");
    setLeadSource(normalizeLeadSourceValue(lead.leadSource ?? "") || lead.leadSource || "");
    setLeadStatus(lead.leadStatus);
    setTemperature(lead.temperature ?? "");
    setNotes(lead.notes ?? "");
    setTags((lead.tags ?? []).join(", "));
    setNextFollowupAt(toDatetimeLocal(lead.nextFollowupAt));
    setEstimatedValue(lead.estimatedValue ?? "");
    setProjectId(lead.projectId ?? "");
  }, [lead]);

  const mutation = useMutation({
    mutationFn: () =>
      apiPatch(`/api/leads/${lead.id}`, {
        firstName,
        lastName,
        phone,
        secondaryPhone: secondaryPhone || undefined,
        email: email || undefined,
        city: city || undefined,
        state: state || undefined,
        leadSource: leadSource ? normalizeLeadSourceValue(leadSource) : undefined,
        leadStatus,
        temperature: temperature || undefined,
        notes: notes || undefined,
        tags: tags
          ? tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        nextFollowupAt: nextFollowupAt ? new Date(nextFollowupAt).toISOString() : undefined,
        estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
        projectId: projectId || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["leads", lead.id] });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      setError(null);
      toast.success("Lead updated");
      onSuccess?.();
    },
    onError: (err: Error) => {
      setError(getErrorMessage(err, "Failed to update lead"));
    },
  });

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="firstName">First name</Label>
        <Input
          id="firstName"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lastName">Last name</Label>
        <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="secondaryPhone">Secondary phone</Label>
        <Input
          id="secondaryPhone"
          value={secondaryPhone}
          onChange={(e) => setSecondaryPhone(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="city">City</Label>
        <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="state">State</Label>
        <Input id="state" value={state} onChange={(e) => setState(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="leadSource">Lead source</Label>
        <select
          id="leadSource"
          className={selectClass}
          value={leadSource}
          onChange={(e) => setLeadSource(e.target.value)}
        >
          <option value="">—</option>
          {LEAD_SOURCE_OPTIONS.map((source) => (
            <option key={source.value} value={source.value}>
              {source.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="leadStatus">Status</Label>
        <select
          id="leadStatus"
          className={selectClass}
          value={leadStatus}
          onChange={(e) => setLeadStatus(e.target.value)}
        >
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="temperature">Temperature</Label>
        <select
          id="temperature"
          className={selectClass}
          value={temperature}
          onChange={(e) => setTemperature(e.target.value)}
        >
          <option value="">—</option>
          {TEMPERATURES.map((temp) => (
            <option key={temp} value={temp}>
              {temp}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="nextFollowupAt">Next follow-up</Label>
        <Input
          id="nextFollowupAt"
          type="datetime-local"
          value={nextFollowupAt}
          onChange={(e) => setNextFollowupAt(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="estimatedValue">Estimated value (₹)</Label>
        <Input
          id="estimatedValue"
          type="number"
          min={0}
          value={estimatedValue}
          onChange={(e) => setEstimatedValue(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="projectId">Project</Label>
        <ProjectSelect id="projectId" value={projectId} onChange={setProjectId} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="tags">Tags (comma-separated)</Label>
        <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {error ? <p className="text-sm text-destructive md:col-span-2">{error}</p> : null}
      <div className="md:col-span-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
