"use client";

import { SlaBreachedTable } from "@/components/sla/sla-breached-table";
import { SlaFlaggedBanner, SlaSummaryCards } from "@/components/sla/sla-summary-cards";
import { usePermissions } from "@/hooks/use-permissions";
import { useSlaBreached, useSlaSummary } from "@/hooks/use-sla";
import { useUsers } from "@/hooks/use-users";
import { SLA_DEFAULT_INACTIVE_DAYS } from "@/lib/sla";
import { LEAD_STATUSES } from "@propninja/types/enums";
import { Button } from "@propninja/ui/button";
import { Label } from "@propninja/ui/label";
import { cn } from "@propninja/ui/lib/utils";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

const selectClass =
  "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SlaPageContent() {
  const { isAdmin, isManager } = usePermissions();
  const canFilterAgent = isAdmin || isManager;

  const [inactiveDays, setInactiveDays] = useState(SLA_DEFAULT_INACTIVE_DAYS);
  const [status, setStatus] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [page, setPage] = useState(1);

  const summary = useSlaSummary();
  const breached = useSlaBreached(
    {
      inactiveDays,
      status: status || undefined,
      assignedTo: assignedTo || undefined,
      page,
      pageSize: 20,
    },
    { enabled: true },
  );

  const { data: users } = useUsers(undefined, { enabled: canFilterAgent });
  const agents = useMemo(
    () => (users ?? []).filter((u) => u.role === "agent" || u.role === "manager"),
    [users],
  );

  function handleThresholdSelect(days: number) {
    setInactiveDays(days);
    setPage(1);
  }

  function handleRefresh() {
    void summary.refetch();
    void breached.refetch();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-orange-600" />
            <h1 className="text-2xl font-bold tracking-tight">Lead SLA</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Active pipeline leads with no calls, notes, or updates. Default breach threshold is{" "}
            {SLA_DEFAULT_INACTIVE_DAYS} days of inactivity.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={summary.isFetching || breached.isFetching}
          onClick={handleRefresh}
        >
          <RefreshCw
            className={cn(
              "mr-2 h-4 w-4",
              (summary.isFetching || breached.isFetching) && "animate-spin",
            )}
          />
          Refresh
        </Button>
      </div>

      <SlaFlaggedBanner flagged={summary.data?.flagged} isLoading={summary.isLoading} />

      <SlaSummaryCards
        summary={summary.data}
        isLoading={summary.isLoading}
        selectedDays={inactiveDays}
        onSelectDays={handleThresholdSelect}
      />

      <section className="space-y-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="sla-threshold">Inactivity threshold</Label>
            <select
              id="sla-threshold"
              className={selectClass}
              value={inactiveDays}
              onChange={(e) => {
                setInactiveDays(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={1}>1+ day</option>
              <option value={3}>3+ days (default SLA)</option>
              <option value={7}>7+ days</option>
              <option value={14}>14+ days (critical)</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sla-status">Lead status</Label>
            <select
              id="sla-status"
              className={selectClass}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All active stages</option>
              {LEAD_STATUSES.filter((s) =>
                ["new", "contacted", "qualified", "negotiation"].includes(s),
              ).map((value) => (
                <option key={value} value={value}>
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {canFilterAgent ? (
            <div className="space-y-2">
              <Label htmlFor="sla-agent">Assigned agent</Label>
              <select
                id="sla-agent"
                className={selectClass}
                value={assignedTo}
                onChange={(e) => {
                  setAssignedTo(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All agents</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      </section>

      <SlaBreachedTable
        items={breached.data?.items ?? []}
        total={breached.data?.total ?? 0}
        page={page}
        pageSize={breached.data?.pageSize ?? 20}
        isLoading={breached.isLoading}
        onPageChange={setPage}
      />
    </div>
  );
}
