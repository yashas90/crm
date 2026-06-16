"use client";

import { type LeadRow, useLeads } from "@/hooks/use-leads";
import { apiPatch } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import { cn } from "@propninja/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Flame, Phone, User } from "lucide-react";
import Link from "next/link";

const STAGES = [
  { key: "new", label: "New", color: "bg-slate-100 border-slate-200 dark:bg-slate-800/60" },
  { key: "contacted", label: "Contacted", color: "bg-blue-50 border-blue-200 dark:bg-blue-900/20" },
  {
    key: "qualified",
    label: "Qualified",
    color: "bg-violet-50 border-violet-200 dark:bg-violet-900/20",
  },
  {
    key: "negotiation",
    label: "Negotiation",
    color: "bg-amber-50 border-amber-200 dark:bg-amber-900/20",
  },
  { key: "won", label: "Won", color: "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20" },
  { key: "lost", label: "Lost", color: "bg-rose-50 border-rose-200 dark:bg-rose-900/20" },
] as const;

const TEMP_ICONS: Record<string, string> = { hot: "🔥", warm: "☀️", cold: "❄️" };

function LeadCard({
  lead,
  onStatusChange,
}: {
  lead: LeadRow;
  onStatusChange: (id: string, status: string) => void;
}) {
  const isOverdue = lead.nextFollowupAt ? new Date(lead.nextFollowupAt) < new Date() : false;

  return (
    <div className="group rounded-xl border border-border/60 bg-card p-3 shadow-sm transition-all hover:border-border hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/leads/${lead.id}`}
          className="min-w-0 font-medium text-sm hover:text-primary hover:underline underline-offset-2 truncate"
        >
          {lead.firstName} {lead.lastName}
        </Link>
        {lead.temperature ? (
          <span className="shrink-0 text-base" title={lead.temperature}>
            {TEMP_ICONS[lead.temperature] ?? ""}
          </span>
        ) : null}
      </div>

      {lead.phone ? (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="h-3 w-3 shrink-0" />
          {lead.phone}
        </p>
      ) : null}

      {lead.assignedUser ? (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="h-3 w-3 shrink-0" />
          {lead.assignedUser.name}
        </p>
      ) : null}

      {lead.nextFollowupAt ? (
        <p
          className={cn(
            "mt-1 flex items-center gap-1.5 text-xs",
            isOverdue ? "text-rose-600 font-medium" : "text-muted-foreground",
          )}
        >
          <CalendarClock className="h-3 w-3 shrink-0" />
          {new Date(lead.nextFollowupAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
        </p>
      ) : null}

      {lead.estimatedValue ? (
        <p className="mt-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          ₹{Number(lead.estimatedValue).toLocaleString("en-IN")}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {STAGES.filter((s) => s.key !== lead.leadStatus).map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onStatusChange(lead.id, s.key)}
            className="rounded px-1.5 py-0.5 text-[10px] bg-muted hover:bg-muted-foreground/20 text-muted-foreground"
          >
            → {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function KanbanColumn({
  stage,
  leads,
  total,
  onStatusChange,
}: {
  stage: (typeof STAGES)[number];
  leads: LeadRow[];
  total: number;
  onStatusChange: (id: string, status: string) => void;
}) {
  const totalValue = leads.reduce(
    (sum, l) => sum + (l.estimatedValue ? Number(l.estimatedValue) : 0),
    0,
  );

  return (
    <div className="flex min-w-[220px] flex-1 flex-col gap-2">
      <div className={cn("rounded-xl border px-3 py-2", stage.color)}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{stage.label}</span>
          <span className="rounded-full bg-background/80 px-2 py-0.5 text-xs font-bold">
            {total}
          </span>
        </div>
        {totalValue > 0 ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            ₹{totalValue.toLocaleString("en-IN")}
          </p>
        ) : null}
      </div>

      <div
        className="flex flex-col gap-2 overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 260px)" }}
      >
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onStatusChange={onStatusChange} />
        ))}
        {leads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/40 py-8 text-center text-xs text-muted-foreground">
            No leads
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const qc = useQueryClient();

  const params = { pageSize: "200", activeOnly: "true" };
  const { data, isLoading } = useLeads(params);
  const leads = data?.items ?? [];

  async function handleStatusChange(id: string, status: string) {
    try {
      await apiPatch(`/api/leads/${id}`, { leadStatus: status });
      await qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`Moved to ${status}`);
    } catch {
      toast.error("Failed to update status");
    }
  }

  const byStage = Object.fromEntries(
    STAGES.map((s) => [s.key, leads.filter((l) => l.leadStatus === s.key)]),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-muted-foreground">Visual overview of leads across all stages.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Flame className="h-4 w-4 text-orange-500" />
          <span>Hover a card to move stages</span>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading pipeline...</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage.key}
              stage={stage}
              leads={byStage[stage.key] ?? []}
              total={byStage[stage.key]?.length ?? 0}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
