"use client";

import { useSession } from "@/hooks/use-session";
import { apiGet, apiPut } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type AgentUser = { id: string; name: string; email: string; role: string };
type AgentTarget = {
  id: string;
  userId: string;
  month: string;
  targetCalls: number;
  targetSiteVisits: number;
  targetBookings: number;
  targetRevenue: string;
  actuals?: { calls: number; siteVisits: number; bookings: number };
};

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  const color = pct >= 100 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-blue-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function AgentTargetsPage() {
  const { session, isAdmin } = useSession();
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    targetCalls: 0,
    targetSiteVisits: 0,
    targetBookings: 0,
    targetRevenue: 0,
  });

  const users = useQuery({
    queryKey: ["users", "list"],
    queryFn: () => apiGet<{ items: AgentUser[] }>("/api/users?pageSize=100&status=active"),
    select: (d) => d.items.filter((u) => u.role === "agent" || u.role === "manager"),
  });

  const targets = useQuery({
    queryKey: ["agent-targets", month],
    queryFn: () => apiGet<AgentTarget[]>(`/api/agent-targets?month=${month}`),
  });

  const upsert = useMutation({
    mutationFn: (body: {
      userId: string;
      month: string;
      targetCalls: number;
      targetSiteVisits: number;
      targetBookings: number;
      targetRevenue: number;
    }) => apiPut("/api/agent-targets", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-targets", month] });
      setEditingId(null);
      toast.success("Target saved");
    },
    onError: (err) => toast.error(getErrorMessage(err, "Failed to save target")),
  });

  if (!isAdmin && session?.role !== "manager") {
    return <p className="text-muted-foreground">Access denied.</p>;
  }

  const agentList = users.data ?? [];
  const targetMap = new Map((targets.data ?? []).map((t) => [t.userId, t]));

  function startEdit(userId: string) {
    const existing = targetMap.get(userId);
    setForm({
      targetCalls: existing?.targetCalls ?? 0,
      targetSiteVisits: existing?.targetSiteVisits ?? 0,
      targetBookings: existing?.targetBookings ?? 0,
      targetRevenue: Number(existing?.targetRevenue ?? 0),
    });
    setEditingId(userId);
  }

  function handleSave(userId: string) {
    upsert.mutate({ userId, month, ...form });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agent Targets</h1>
          <p className="text-muted-foreground">
            Set monthly call, visit, and booking goals per agent.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="month">Month</Label>
          <Input
            id="month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agentList.map((agent) => {
          const t = targetMap.get(agent.id);
          const isEditing = editingId === agent.id;
          return (
            <Card key={agent.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{agent.name}</CardTitle>
                <CardDescription className="text-xs">{agent.email}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isEditing ? (
                  <div className="space-y-2">
                    {(
                      [
                        "targetCalls",
                        "targetSiteVisits",
                        "targetBookings",
                        "targetRevenue",
                      ] as const
                    ).map((field) => (
                      <div key={field} className="flex items-center gap-2">
                        <Label className="w-32 shrink-0 text-xs capitalize">
                          {field
                            .replace("target", "")
                            .replace(/([A-Z])/g, " $1")
                            .trim()}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={form[field]}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, [field]: Number(e.target.value) }))
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => handleSave(agent.id)}
                        disabled={upsert.isPending}
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {[
                      {
                        label: "Calls",
                        target: t?.targetCalls ?? 0,
                        actual: t?.actuals?.calls ?? 0,
                      },
                      {
                        label: "Site Visits",
                        target: t?.targetSiteVisits ?? 0,
                        actual: t?.actuals?.siteVisits ?? 0,
                      },
                      {
                        label: "Bookings",
                        target: t?.targetBookings ?? 0,
                        actual: t?.actuals?.bookings ?? 0,
                      },
                    ].map(({ label, target, actual }) => (
                      <div key={label} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium">
                            {actual} / {target}
                          </span>
                        </div>
                        <ProgressBar value={actual} max={target} />
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full"
                      onClick={() => startEdit(agent.id)}
                    >
                      {t ? "Edit targets" : "Set targets"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
        {agentList.length === 0 && !users.isLoading && (
          <p className="col-span-3 text-sm text-muted-foreground">No agents found.</p>
        )}
      </div>
    </div>
  );
}
