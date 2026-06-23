"use client";

import { TaskSlideOver } from "@/components/tasks/task-slide-over";
import { useLeads } from "@/hooks/use-leads";
import { usePermissions } from "@/hooks/use-permissions";
import {
  type BulkAddUnitsInput,
  type ProjectUnitRow,
  type UnitFilters,
  type UnitStatus,
  openBookingPdf,
  projectUnitsExportUrl,
  useBulkAddProjectUnits,
  useDeleteProjectUnit,
  useProjectUnitSummary,
  useProjectUnits,
  useUpdateProjectUnit,
} from "@/hooks/use-project-units";
import { apiDownload } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { cn } from "@propninja/ui/lib/utils";
import { Download, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const STATUS_STYLES: Record<UnitStatus, string> = {
  available: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  reserved: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  booked: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  sold: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<UnitStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  booked: "Booked",
  sold: "Sold",
};

function formatPrice(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

type ProjectInventoryStepProps = {
  projectId: string;
  readOnly?: boolean;
};

export function ProjectInventoryStep({ projectId, readOnly = false }: ProjectInventoryStepProps) {
  const { isAdmin, isManager } = usePermissions();
  const canManage = isAdmin || isManager;
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<UnitFilters>({});
  useEffect(() => {
    const status = searchParams.get("status");
    if (
      status === "available" ||
      status === "reserved" ||
      status === "booked" ||
      status === "sold"
    ) {
      setFilters({ status });
    }
  }, [searchParams]);
  const { data: unitsData, isLoading } = useProjectUnits(projectId, filters);
  const units: ProjectUnitRow[] = unitsData ?? [];
  const { data: summary } = useProjectUnitSummary(projectId);

  const [selectedUnit, setSelectedUnit] = useState<ProjectUnitRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  async function handleExport() {
    await apiDownload(projectUnitsExportUrl(projectId), `project-${projectId}-units.csv`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Unit inventory</h2>
          <p className="text-sm text-muted-foreground">
            Track individual units, availability, and lead assignments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void handleExport()}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          {canManage && !readOnly ? (
            <Button type="button" size="sm" onClick={() => setBulkOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add units
            </Button>
          ) : null}
        </div>
      </div>

      {summary ? <SummaryBar summary={summary} /> : null}

      <div className="flex flex-wrap gap-3">
        <FilterSelect
          label="Status"
          value={filters.status ?? ""}
          onChange={(v) =>
            setFilters((f) => ({ ...f, status: (v || undefined) as UnitStatus | undefined }))
          }
          options={[
            { value: "", label: "All statuses" },
            ...(["available", "reserved", "booked", "sold"] as UnitStatus[]).map((s) => ({
              value: s,
              label: STATUS_LABELS[s],
            })),
          ]}
        />
        <FilterSelect
          label="BHK"
          value={filters.bedrooms !== undefined ? String(filters.bedrooms) : ""}
          onChange={(v) => setFilters((f) => ({ ...f, bedrooms: v ? Number(v) : undefined }))}
          options={[
            { value: "", label: "All BHK" },
            { value: "1", label: "1 BHK" },
            { value: "2", label: "2 BHK" },
            { value: "3", label: "3 BHK" },
            { value: "4", label: "4 BHK" },
          ]}
        />
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Floor</Label>
          <Input
            type="number"
            className="h-9 w-28"
            placeholder="All"
            value={filters.floor ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                floor: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-white/10">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-black bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Unit</th>
              <th className="px-4 py-3 font-medium">Floor</th>
              <th className="px-4 py-3 font-medium">BHK</th>
              <th className="px-4 py-3 font-medium">Area</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Lead</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Loading units…
                </td>
              </tr>
            ) : units.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No units yet. {canManage && !readOnly ? "Use Add units to create inventory." : ""}
                </td>
              </tr>
            ) : (
              units.map((unit) => (
                <tr
                  key={unit.id}
                  className="cursor-pointer border-b border-border/40 hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-medium">
                    <button
                      type="button"
                      className="w-full text-left font-medium"
                      onClick={() => setSelectedUnit(unit)}
                    >
                      {unit.unitNumber}
                    </button>
                  </td>
                  <td className="px-4 py-3">{unit.floor}</td>
                  <td className="px-4 py-3">{unit.bedrooms} BHK</td>
                  <td className="px-4 py-3">{unit.areaSqFt} sqft</td>
                  <td className="px-4 py-3">{formatPrice(unit.priceListedRs)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        STATUS_STYLES[unit.status],
                      )}
                    >
                      {STATUS_LABELS[unit.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {unit.assignedLead ? (
                      <Link
                        href={`/leads/${unit.assignedLead.id}`}
                        className="text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {unit.assignedLead.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <UnitDetailSlideOver
        projectId={projectId}
        unit={selectedUnit}
        readOnly={readOnly || !canManage}
        isAdmin={isAdmin}
        canDownloadBookingPdf={canManage}
        onClose={() => setSelectedUnit(null)}
      />

      <BulkAddModal projectId={projectId} open={bulkOpen} onOpenChange={setBulkOpen} />
    </div>
  );
}

function SummaryBar({
  summary,
}: { summary: { available: number; reserved: number; booked: number; sold: number } }) {
  const items = [
    { label: "Available", count: summary.available, className: "text-emerald-600" },
    { label: "Reserved", count: summary.reserved, className: "text-amber-600" },
    { label: "Booked", count: summary.booked, className: "text-blue-600" },
    { label: "Sold", count: summary.sold, className: "text-muted-foreground" },
  ];

  return (
    <div className="flex flex-wrap gap-4 rounded-xl border border-slate-200/80 bg-muted/20 px-5 py-4 dark:border-white/10">
      {items.map((item) => (
        <div key={item.label} className="text-center">
          <div className={cn("text-2xl font-bold tabular-nums", item.className)}>{item.count}</div>
          <div className="text-xs text-muted-foreground">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <select
        className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function UnitDetailSlideOver({
  projectId,
  unit,
  readOnly,
  isAdmin,
  canDownloadBookingPdf,
  onClose,
}: {
  projectId: string;
  unit: ProjectUnitRow | null;
  readOnly: boolean;
  isAdmin: boolean;
  canDownloadBookingPdf: boolean;
  onClose: () => void;
}) {
  const update = useUpdateProjectUnit(projectId);
  const remove = useDeleteProjectUnit(projectId);

  const [status, setStatus] = useState<UnitStatus>("available");
  const [priceListedRs, setPriceListedRs] = useState("");
  const [priceFinalRs, setPriceFinalRs] = useState("");
  const [notes, setNotes] = useState("");
  const [leadId, setLeadId] = useState("");
  const [leadSearch, setLeadSearch] = useState("");

  const leadsQuery = useLeads(
    { search: leadSearch, page: "1", pageSize: "20" },
    { enabled: Boolean(unit) && leadSearch.length >= 2 },
  );
  const leadOptions = useMemo(() => leadsQuery.data?.items ?? [], [leadsQuery.data]);

  const open = Boolean(unit);

  useEffect(() => {
    if (!unit) return;
    setStatus(unit.status);
    setPriceListedRs(String(unit.priceListedRs));
    setPriceFinalRs(unit.priceFinalRs != null ? String(unit.priceFinalRs) : "");
    setNotes(unit.notes ?? "");
    setLeadId(unit.assignedLeadId ?? "");
    setLeadSearch(unit.assignedLead?.name ?? "");
  }, [unit]);

  return (
    <TaskSlideOver
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={unit ? `Unit ${unit.unitNumber}` : "Unit"}
      description={
        unit ? `Floor ${unit.floor} · ${unit.bedrooms} BHK · ${unit.areaSqFt} sqft` : undefined
      }
      footer={
        readOnly ? (
          <Button type="button" variant="outline" className="w-full" onClick={onClose}>
            Close
          </Button>
        ) : (
          <div className="flex gap-2">
            {isAdmin ? (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                disabled={!unit || remove.isPending}
                onClick={() => {
                  if (!unit) return;
                  remove.mutate(unit.id, { onSuccess: onClose });
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={!unit || update.isPending}
              onClick={() => {
                if (!unit) return;
                update.mutate(
                  {
                    unitId: unit.id,
                    status,
                    priceListedRs: Number(priceListedRs),
                    priceFinalRs: priceFinalRs ? Number(priceFinalRs) : null,
                    notes: notes || null,
                    assignedLeadId: leadId || null,
                  },
                  { onSuccess: onClose },
                );
              }}
            >
              Save
            </Button>
          </div>
        )
      }
    >
      {unit ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={status}
              disabled={readOnly}
              onChange={(e) => setStatus(e.target.value as UnitStatus)}
            >
              {(["available", "reserved", "booked", "sold"] as UnitStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Listed price (₹)</Label>
              <Input
                type="number"
                value={priceListedRs}
                disabled={readOnly}
                onChange={(e) => setPriceListedRs(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Final price (₹)</Label>
              <Input
                type="number"
                value={priceFinalRs}
                disabled={readOnly}
                onChange={(e) => setPriceFinalRs(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <textarea
              className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={notes}
              disabled={readOnly}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Link to lead</Label>
            {readOnly ? (
              unit.assignedLead ? (
                <Link
                  href={`/leads/${unit.assignedLead.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  {unit.assignedLead.name}
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">No lead linked</p>
              )
            ) : (
              <>
                <Input
                  placeholder="Search leads…"
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                />
                {leadId && unit.assignedLead ? (
                  <p className="text-xs text-muted-foreground">
                    Current:{" "}
                    <Link
                      href={`/leads/${unit.assignedLead.id}`}
                      className="text-primary hover:underline"
                    >
                      {unit.assignedLead.name}
                    </Link>
                  </p>
                ) : null}
                {leadOptions.length > 0 ? (
                  <ul className="max-h-40 overflow-y-auto rounded-md border border-black">
                    {leadOptions.map((lead) => (
                      <li key={lead.id}>
                        <button
                          type="button"
                          className={cn(
                            "w-full px-3 py-2 text-left text-sm hover:bg-muted/50",
                            leadId === lead.id && "bg-muted",
                          )}
                          onClick={() => {
                            setLeadId(lead.id);
                            setLeadSearch(`${lead.firstName} ${lead.lastName}`.trim());
                          }}
                        >
                          {lead.firstName} {lead.lastName}
                          {lead.phone ? ` · ${lead.phone}` : ""}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </div>
          {unit.status === "booked" && canDownloadBookingPdf ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                void openBookingPdf(projectId, unit.id).catch((error) => {
                  toast.error(getErrorMessage(error, "Failed to open booking PDF"));
                });
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Download Booking PDF
            </Button>
          ) : null}
        </div>
      ) : null}
    </TaskSlideOver>
  );
}

function BulkAddModal({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const bulkAdd = useBulkAddProjectUnits(projectId);
  const [form, setForm] = useState<BulkAddUnitsInput>({
    unitNumberFrom: "",
    unitNumberTo: "",
    floor: 1,
    bedrooms: 2,
    areaSqFt: 850,
    priceListedRs: 0,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200/80 bg-background p-6 shadow-xl dark:border-white/10">
        <h3 className="text-lg font-semibold">Add units in bulk</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a range of units with shared floor, BHK, area, and price.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            bulkAdd.mutate(form, { onSuccess: () => onOpenChange(false) });
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>From</Label>
              <Input
                placeholder="A-101"
                value={form.unitNumberFrom}
                onChange={(e) => setForm((f) => ({ ...f, unitNumberFrom: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input
                placeholder="A-115"
                value={form.unitNumberTo}
                onChange={(e) => setForm((f) => ({ ...f, unitNumberTo: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Floor</Label>
              <Input
                type="number"
                value={form.floor}
                onChange={(e) => setForm((f) => ({ ...f, floor: Number(e.target.value) }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>BHK</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.bedrooms}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bedrooms: Number(e.target.value) as 1 | 2 | 3 | 4 }))
                }
              >
                <option value={1}>1 BHK</option>
                <option value={2}>2 BHK</option>
                <option value={3}>3 BHK</option>
                <option value={4}>4 BHK</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Area (sqft)</Label>
              <Input
                type="number"
                value={form.areaSqFt}
                onChange={(e) => setForm((f) => ({ ...f, areaSqFt: Number(e.target.value) }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Price (₹)</Label>
              <Input
                type="number"
                value={form.priceListedRs}
                onChange={(e) => setForm((f) => ({ ...f, priceListedRs: Number(e.target.value) }))}
                required
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={bulkAdd.isPending}>
              Add units
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
