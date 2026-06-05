"use client";

import { LeadEditModal } from "@/components/leads/lead-edit-modal";
import { LeadForm } from "@/components/leads/lead-form";
import { LeadsTable } from "@/components/leads/leads-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  type LeadRow,
  filterUpcomingLeads,
  followUpQueryParams,
  useLeads,
} from "@/hooks/use-leads";
import { getSession } from "@/lib/auth";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { Input } from "@propninja/ui/input";
import { cn } from "@propninja/ui/lib/utils";
import { Search, Upload } from "lucide-react";
import { useEffect, useState } from "react";

const STATUSES = ["", "new", "contacted", "qualified", "negotiation", "won", "lost"] as const;
const TEMPERATURES = ["", "cold", "warm", "hot"] as const;
const TEMP_CHIP: Record<string, string> = {
  "": "bg-muted text-muted-foreground",
  cold: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  warm: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  hot: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

export default function LeadsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [temperature, setTemperature] = useState("");
  const [myLeadsOnly, setMyLeadsOnly] = useState(false);
  const [followUpFilter, setFollowUpFilter] = useState<"" | "due_today" | "overdue" | "upcoming">(
    "",
  );
  const [showForm, setShowForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadRow | null>(null);

  const session = typeof window !== "undefined" ? getSession() : null;

  const followUpParams = followUpQueryParams(followUpFilter);

  const { data, isLoading, isError } = useLeads({
    search: search || undefined,
    status: status || undefined,
    temperature: temperature || undefined,
    assignedTo: myLeadsOnly && session ? session.id : undefined,
    ...followUpParams,
    page: "1",
    pageSize: "50",
  });

  const displayLeads =
    followUpFilter === "upcoming" && data ? filterUpcomingLeads(data.items) : (data?.items ?? []);

  const selectClass =
    "flex h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  useEffect(() => {
    function openNewLead() {
      setShowForm(true);
    }
    window.addEventListener("propninja:open-new-lead", openNewLead);
    return () => window.removeEventListener("propninja:open-new-lead", openNewLead);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Leads</h2>
          <p className="text-muted-foreground">Search, filter, and manage your pipeline.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImportModal(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import leads
          </Button>
          <Button onClick={() => setShowForm(true)}>Add Lead</Button>
        </div>
      </div>

      {showForm ? (
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Create lead</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadForm
              onSuccess={() => {
                setShowForm(false);
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/10 p-4">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="global-search"
            className="rounded-xl pl-10"
            placeholder="Search by name, phone, or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Press <kbd className="rounded border px-1">/</kbd> to search ·{" "}
          <kbd className="rounded border px-1">N</kbd> to add a lead
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <select
            className={selectClass}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {STATUSES.map((value) => (
              <option key={value || "all"} value={value}>
                {value ? value.charAt(0).toUpperCase() + value.slice(1) : "All statuses"}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap gap-2">
            {TEMPERATURES.map((value) => (
              <button
                key={value || "all"}
                type="button"
                onClick={() => setTemperature(value)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                  temperature === value
                    ? "bg-primary text-primary-foreground"
                    : (TEMP_CHIP[value] ?? "bg-muted text-muted-foreground"),
                )}
              >
                {value || "All temps"}
              </button>
            ))}
          </div>

          <Button
            variant={myLeadsOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setMyLeadsOnly((v) => !v)}
          >
            My Leads
          </Button>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["", "All follow-ups"],
                ["due_today", "Due today"],
                ["overdue", "Overdue"],
                ["upcoming", "Upcoming"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value || "all"}
                variant={followUpFilter === value ? "default" : "outline"}
                size="sm"
                onClick={() => setFollowUpFilter(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={7} />
      ) : isError || !data ? (
        <p className="text-muted-foreground">Unable to load leads.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {followUpFilter === "upcoming" ? displayLeads.length : data.total} leads
          </p>
          <LeadsTable
            leads={displayLeads}
            onEdit={setEditingLead}
            onAddLead={() => setShowForm(true)}
          />
        </>
      )}

      <LeadEditModal
        lead={editingLead}
        open={Boolean(editingLead)}
        onOpenChange={(open) => {
          if (!open) setEditingLead(null);
        }}
      />

      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import leads</DialogTitle>
            <DialogDescription>
              Bulk import is not yet available in this version. Please create leads manually using
              the Add Lead button.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportModal(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setShowImportModal(false);
                setShowForm(true);
              }}
            >
              Add lead manually
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
