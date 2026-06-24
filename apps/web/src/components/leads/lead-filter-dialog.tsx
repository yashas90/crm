"use client";

import { ProjectSelect } from "@/components/projects/project-select";
import { LeadsScopeTabs } from "@/components/leads/leads-scope-tabs";
import {
  AD_LEADS_FILTER_VALUE,
  AD_PLATFORM_SOURCE_OPTIONS,
  OTHER_LEAD_SOURCE_OPTIONS,
} from "@/lib/lead-sources";
import {
  TAG_PRESET_OPTIONS,
  addSavedLeadFilter,
  defaultLeadsAdvancedFilters,
  loadSavedLeadFilters,
  type SavedLeadFilter,
} from "@/lib/leads-advanced-filters";
import type { LeadsScope } from "@/lib/leads-scope";
import type { LeadsStage } from "@/lib/leads-stage";
import { defaultLeadsUrlFilters, type LeadsUrlFilters } from "@/lib/leads-url-filters";
import { useUsers } from "@/hooks/use-users";
import { useSession } from "@/hooks/use-session";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { cn } from "@propninja/ui/lib/utils";
import { LEAD_STATUSES } from "@propninja/types/enums";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

const selectClass =
  "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
  not_interested: "Not Interested",
  dropped: "Dropped",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-sm font-semibold text-teal-700 dark:text-teal-400">{children}</h4>
  );
}

function FilterGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

type LeadFilterDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: LeadsUrlFilters;
  scope: LeadsScope;
  onScopeChange: (scope: LeadsScope) => void;
  onStageChange: (stage: LeadsStage) => void;
  scopeCounts?: Record<string, number>;
  scopeCountsLoading?: boolean;
  onApply: (filters: LeadsUrlFilters, scope: LeadsScope) => void;
};

export function LeadFilterDialog({
  open,
  onOpenChange,
  filters,
  scope,
  onScopeChange,
  onStageChange,
  scopeCounts,
  scopeCountsLoading,
  onApply,
}: LeadFilterDialogProps) {
  const { isAdmin } = useSession();
  const { data: users } = useUsers();
  const [draft, setDraft] = useState(filters);
  const [draftScope, setDraftScope] = useState(scope);
  const [savedFilters, setSavedFilters] = useState<SavedLeadFilter[]>([]);
  const [saveName, setSaveName] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft(filters);
    setDraftScope(scope);
    setSavedFilters(loadSavedLeadFilters());
  }, [open, filters, scope]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  function patch(partial: Partial<LeadsUrlFilters>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  function toggleTagPreset(id: string) {
    setDraft((current) => {
      const has = current.tagPresets.includes(id);
      return {
        ...current,
        tagPresets: has
          ? current.tagPresets.filter((t) => t !== id)
          : [...current.tagPresets, id],
      };
    });
  }

  function handleReset() {
    setDraft(defaultLeadsUrlFilters());
    setDraftScope("all");
    onStageChange("active");
  }

  function handleSearch() {
    onApply(draft, draftScope);
    onOpenChange(false);
  }

  function handleSavePreset() {
    if (!saveName.trim()) return;
    addSavedLeadFilter(saveName.trim(), draft, draftScope);
    setSavedFilters(loadSavedLeadFilters());
    setSaveName("");
  }

  function loadPreset(preset: SavedLeadFilter) {
    setDraft({ ...draft, ...preset.filters });
    if (preset.scope) setDraftScope(preset.scope as LeadsScope);
  }

  const sourceSelectValue = draft.adLeadsOnly ? AD_LEADS_FILTER_VALUE : draft.source;
  const agentOptions = users ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-8">
      <div className="relative w-full max-w-5xl rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-xl font-bold">Lead Filter</h2>
            <p className="text-sm text-muted-foreground">Refine leads by agent, status, project, and more.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className={cn(selectClass, "h-9 w-48")}
              defaultValue=""
              onChange={(e) => {
                const preset = savedFilters.find((p) => p.id === e.target.value);
                if (preset) loadPreset(preset);
                e.target.value = "";
              }}
            >
              <option value="">Saved filters…</option>
              {savedFilters.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-5">
          <section className="space-y-3">
            <SectionTitle>Filter By</SectionTitle>
            <LeadsScopeTabs
              value={draftScope}
              onChange={setDraftScope}
              counts={scopeCounts as never}
              isLoadingCounts={scopeCountsLoading}
              isAdmin={isAdmin}
            />
          </section>

          <section className="space-y-3">
            <SectionTitle>Tags</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {TAG_PRESET_OPTIONS.map((opt) => {
                const active = draft.tagPresets.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleTagPreset(opt.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                      active
                        ? "border-teal-600 bg-teal-600 text-white"
                        : "border-border bg-muted/40 text-foreground hover:bg-muted",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle>Meeting / Site Visit</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["meetingDone", "Meeting Done"],
                  ["meetingNotDone", "Meeting Not Done"],
                  ["siteVisitDone", "Site Visit Done"],
                  ["siteVisitNotDone", "Site Visit Not Done"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => patch({ [key]: !draft[key] })}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold",
                    draft[key]
                      ? "border-teal-600 bg-teal-50 text-teal-800"
                      : "border-border bg-background",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle>Assign</SectionTitle>
            <FilterGrid>
              <div className="space-y-1">
                <Label>Assign To</Label>
                <select
                  className={selectClass}
                  value={draft.filterAssignTo}
                  onChange={(e) => patch({ filterAssignTo: e.target.value })}
                >
                  <option value="">Any agent</option>
                  {agentOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={draft.assignWithHistory}
                    onChange={(e) => patch({ assignWithHistory: e.target.checked })}
                  />
                  History
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={draft.assignWithTeam}
                    onChange={(e) => patch({ assignWithTeam: e.target.checked })}
                  />
                  With Team
                </label>
              </div>
              <AgentSelect
                label="Assigned From"
                value={draft.assignedFrom}
                onChange={(v) => patch({ assignedFrom: v })}
                users={agentOptions}
              />
              <AgentSelect
                label="Assignment Done By"
                value={draft.assignedBy}
                onChange={(v) => patch({ assignedBy: v })}
                users={agentOptions}
              />
              <AgentSelect
                label="Original Owner"
                value={draft.originalOwner}
                onChange={(v) => patch({ originalOwner: v })}
                users={agentOptions}
              />
            </FilterGrid>
          </section>

          <section className="space-y-3">
            <SectionTitle>Status &amp; Source</SectionTitle>
            <FilterGrid>
              <div className="space-y-1">
                <Label>Status</Label>
                <select
                  className={selectClass}
                  value={draft.status}
                  onChange={(e) => {
                    const status = e.target.value;
                    patch({ status, activeOnly: false });
                    if (status === "new") onStageChange("new");
                    else if (status === "contacted") onStageChange("pending");
                    else if (status === "qualified") onStageChange("eoi");
                    else if (!status) onStageChange("active");
                  }}
                >
                  <option value="">All statuses</option>
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s] ?? s}
                    </option>
                  ))}
                </select>
              </div>
              <FieldInput label="Sub status" value={draft.subStatus} onChange={(v) => patch({ subStatus: v })} />
              <div className="space-y-1">
                <Label>Source</Label>
                <select
                  className={selectClass}
                  value={sourceSelectValue}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === AD_LEADS_FILTER_VALUE) {
                      patch({ adLeadsOnly: true, source: "" });
                    } else {
                      patch({ adLeadsOnly: false, source: value });
                    }
                  }}
                >
                  <option value="">All sources</option>
                  <option value={AD_LEADS_FILTER_VALUE}>All Ad Leads</option>
                  {AD_PLATFORM_SOURCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                  {OTHER_LEAD_SOURCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <FieldInput label="Sub-Source" value={draft.subSource} onChange={(v) => patch({ subSource: v })} />
            </FilterGrid>
          </section>

          <section className="space-y-3">
            <SectionTitle>Project &amp; Property</SectionTitle>
            <FilterGrid>
              <FieldInput
                label="Project Status"
                value={draft.projectStatus}
                onChange={(v) => patch({ projectStatus: v })}
              />
              <div className="space-y-1">
                <Label>Project</Label>
                <ProjectSelect
                  value={draft.filterProjectId}
                  onChange={(v) => patch({ filterProjectId: v })}
                />
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={draft.associatedProjectsOnly}
                    onChange={(e) => patch({ associatedProjectsOnly: e.target.checked })}
                  />
                  Associated Projects
                </label>
              </div>
              <FieldInput
                label="Property Status"
                value={draft.propertyStatus}
                onChange={(v) => patch({ propertyStatus: v })}
              />
              <FieldInput
                label="Property Type"
                value={draft.propertyType}
                onChange={(v) => patch({ propertyType: v })}
              />
              <FieldInput
                label="Property Sub-Type"
                value={draft.propertySubType}
                onChange={(v) => patch({ propertySubType: v })}
              />
              <FieldInput label="BHK" value={draft.bhk} onChange={(v) => patch({ bhk: v })} />
              <FieldInput label="BHK Type" value={draft.bhkType} onChange={(v) => patch({ bhkType: v })} />
              <FieldInput
                label="Possession from"
                type="date"
                value={draft.possessionFrom}
                onChange={(v) => patch({ possessionFrom: v })}
              />
              <FieldInput
                label="Possession to"
                type="date"
                value={draft.possessionTo}
                onChange={(v) => patch({ possessionTo: v })}
              />
            </FilterGrid>
          </section>

          <section className="space-y-3">
            <SectionTitle>Location</SectionTitle>
            <FilterGrid>
              <FieldInput label="City" value={draft.filterCity} onChange={(v) => patch({ filterCity: v })} />
              <FieldInput label="State" value={draft.filterState} onChange={(v) => patch({ filterState: v })} />
              <FieldInput label="Locality" value={draft.locality} onChange={(v) => patch({ locality: v })} />
              <FieldInput label="Country" value={draft.country} onChange={(v) => patch({ country: v })} />
              <FieldInput label="Zone" value={draft.zone} onChange={(v) => patch({ zone: v })} />
              <FieldInput label="Latitude" value={draft.latitude} onChange={(v) => patch({ latitude: v })} />
              <FieldInput label="Longitude" value={draft.longitude} onChange={(v) => patch({ longitude: v })} />
              <FieldInput label="Radius (km)" value={draft.radiusKm} onChange={(v) => patch({ radiusKm: v })} />
              <FieldInput
                label="Country Code"
                value={draft.countryCode}
                onChange={(v) => patch({ countryCode: v })}
              />
              <FieldInput
                label="Alt Country Code"
                value={draft.altCountryCode}
                onChange={(v) => patch({ altCountryCode: v })}
              />
              <FieldInput
                label="Customer Country"
                value={draft.customerCountry}
                onChange={(v) => patch({ customerCountry: v })}
              />
            </FilterGrid>
          </section>

          <section className="space-y-3">
            <SectionTitle>Budget &amp; Area</SectionTitle>
            <FilterGrid>
              <RangeField
                label="Min Budget"
                from={draft.minBudgetFrom}
                to={draft.minBudgetTo}
                onFrom={(v) => patch({ minBudgetFrom: v })}
                onTo={(v) => patch({ minBudgetTo: v })}
              />
              <RangeField
                label="Max Budget"
                from={draft.maxBudgetFrom}
                to={draft.maxBudgetTo}
                onFrom={(v) => patch({ maxBudgetFrom: v })}
                onTo={(v) => patch({ maxBudgetTo: v })}
              />
              <RangeField
                label="Carpet Area (sq ft)"
                from={draft.carpetAreaFrom}
                to={draft.carpetAreaTo}
                onFrom={(v) => patch({ carpetAreaFrom: v })}
                onTo={(v) => patch({ carpetAreaTo: v })}
              />
              <RangeField
                label="Built-Up Area (sq ft)"
                from={draft.builtUpAreaFrom}
                to={draft.builtUpAreaTo}
                onFrom={(v) => patch({ builtUpAreaFrom: v })}
                onTo={(v) => patch({ builtUpAreaTo: v })}
              />
            </FilterGrid>
          </section>

          <section className="flex flex-wrap items-end gap-2 border-t pt-4">
            <Input
              placeholder="Save filter as…"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className="max-w-xs"
            />
            <Button type="button" variant="outline" size="sm" onClick={handleSavePreset}>
              Save preset
            </Button>
          </section>
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button type="button" onClick={handleSearch}>
            Search
          </Button>
        </div>
      </div>
    </div>
  );
}

function AgentSelect({
  label,
  value,
  onChange,
  users,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  users: { id: string; name: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Any</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function RangeField({
  label,
  from,
  to,
  onFrom,
  onTo,
}: {
  label: string;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input placeholder="From" value={from} onChange={(e) => onFrom(e.target.value)} />
        <Input placeholder="To" value={to} onChange={(e) => onTo(e.target.value)} />
      </div>
    </div>
  );
}
