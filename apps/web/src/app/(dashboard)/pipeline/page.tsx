"use client";

import { type LeadRow, useLeads } from "@/hooks/use-leads";
import { type PipelineStageView, usePipelineStages } from "@/hooks/use-pipeline-stages";
import { apiPatch } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { cn } from "@propninja/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Flame, Phone, Settings2, Snowflake, Sun, User } from "lucide-react";
import Link from "next/link";

const TEMP_ICONS: Record<string, { icon: typeof Flame; className: string }> = {
  hot: { icon: Flame, className: "text-rose-500" },
  warm: { icon: Sun, className: "text-amber-500" },
  cold: { icon: Snowflake, className: "text-sky-400" },
};

function LeadCard({
  lead,
  stages,
  onStatusChange,
}: {
  lead: LeadRow;
  stages: PipelineStageView[];
  onStatusChange: (id: string, status: string) => void;
}) {
  const isOverdue = lead.nextFollowupAt ? new Date(lead.nextFollowupAt) < new Date() : false;

  return (
    <div className="group rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:-translate-y-px hover:shadow-md dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/leads/${lead.id}`}
          className="min-w-0 font-medium text-sm hover:text-primary hover:underline underline-offset-2 truncate"
        >
          {lead.firstName} {lead.lastName}
        </Link>
        {lead.temperature && TEMP_ICONS[lead.temperature]
          ? (() => {
              const { icon: TempIcon, className } = TEMP_ICONS[lead.temperature]!;
              return (
                <TempIcon
                  className={cn("h-3.5 w-3.5 shrink-0", className)}
                  aria-label={lead.temperature}
                />
              );
            })()
          : null}
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
        {stages
          .filter((s) => s.key !== lead.leadStatus)
          .map((s) => (
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
  stages,
  onStatusChange,
}: {
  stage: PipelineStageView;
  leads: LeadRow[];
  total: number;
  stages: PipelineStageView[];
  onStatusChange: (id: string, status: string) => void;
}) {
  const totalValue = leads.reduce(
    (sum, l) => sum + (l.estimatedValue ? Number(l.estimatedValue) : 0),
    0,
  );

  return (
    <div className="flex min-w-[220px] flex-1 flex-col gap-2">
      <div className={cn("rounded-xl border px-3 py-2", stage.color)} style={stage.colorStyle}>
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
          <LeadCard key={lead.id} lead={lead} stages={stages} onStatusChange={onStatusChange} />
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
  const { data: stages = [], isLoading: stagesLoading } = usePipelineStages();

  const params = { pageSize: "200", activeOnly: "true" };
  const { data, isLoading: leadsLoading } = useLeads(params);
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
    stages.map((s) => [s.key, leads.filter((l) => l.leadStatus === s.key)]),
  );

  const isLoading = stagesLoading || leadsLoading;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-muted-foreground">Visual overview of leads across all stages.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
            <Link href="/settings/pipeline-stages">
              <Settings2 className="h-3.5 w-3.5" />
              Configure stages
            </Link>
          </Button>
          <Flame className="h-4 w-4 text-orange-500" />
          <span>Hover a card to move stages</span>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading pipeline...</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.key}
              stage={stage}
              stages={stages}
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
