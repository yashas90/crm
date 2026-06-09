"use client";

import { ProjectSelect } from "@/components/projects/project-select";
import { apiPost } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { LEAD_SOURCE_OPTIONS, normalizeLeadSourceValue } from "@/lib/lead-sources";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type LeadFormProps = {
  onSuccess?: () => void;
};

export function LeadForm({ onSuccess }: LeadFormProps) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [secondaryPhone, setSecondaryPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [leadSource, setLeadSource] = useState("");
  const [tags, setTags] = useState("");
  const [nextFollowupAt, setNextFollowupAt] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  const mutation = useMutation({
    mutationFn: () =>
      apiPost("/api/leads", {
        firstName,
        lastName,
        phone,
        secondaryPhone: secondaryPhone || undefined,
        email: email || undefined,
        city: city || undefined,
        leadSource: leadSource ? normalizeLeadSourceValue(leadSource) : undefined,
        tags: tags
          ? tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined,
        nextFollowupAt: nextFollowupAt ? new Date(nextFollowupAt).toISOString() : undefined,
        estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
        projectId: projectId || undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      setFirstName("");
      setLastName("");
      setPhone("");
      setSecondaryPhone("");
      setEmail("");
      setCity("");
      setLeadSource("");
      setTags("");
      setNextFollowupAt("");
      setEstimatedValue("");
      setProjectId("");
      setError(null);
      toast.success("Lead created");
      onSuccess?.();
    },
    onError: (err: Error) => {
      setError(getErrorMessage(err, "Failed to create lead"));
    },
  });

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
        <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
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
        <Label htmlFor="nextFollowupAt">Next follow-up</Label>
        <Input
          id="nextFollowupAt"
          type="datetime-local"
          value={nextFollowupAt}
          onChange={(e) => setNextFollowupAt(e.target.value)}
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="tags">Tags (comma-separated)</Label>
        <Input
          id="tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="vip, 2bhk"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="estimatedValue">Estimated value (₹)</Label>
        <Input
          id="estimatedValue"
          type="number"
          min={0}
          placeholder="e.g. 8500000"
          value={estimatedValue}
          onChange={(e) => setEstimatedValue(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="projectId">Project</Label>
        <ProjectSelect id="projectId" value={projectId} onChange={setProjectId} />
      </div>
      {error ? <p className="text-sm text-destructive md:col-span-2">{error}</p> : null}
      <div className="md:col-span-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Creating..." : "Create lead"}
        </Button>
      </div>
    </form>
  );
}
