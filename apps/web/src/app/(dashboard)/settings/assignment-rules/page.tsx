"use client";

import { Badge } from "@/components/ui/badge";
import { useSession } from "@/hooks/use-session";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

type Rule = {
  id: string;
  name: string;
  strategy: string;
  isActive: boolean;
  conditions: { sources?: string[]; cities?: string[]; zones?: string[] };
  assigneeIds: string[];
  priority: number;
};

type AgentUser = { id: string; name: string; role: string };

const BLANK: Omit<Rule, "id"> = {
  name: "",
  strategy: "round_robin",
  isActive: true,
  conditions: {},
  assigneeIds: [],
  priority: 0,
};

export default function AssignmentRulesPage() {
  const { isAdmin, session } = useSession();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<(Partial<Rule> & { id?: string }) | null>(null);

  const rules = useQuery({
    queryKey: ["assignment-rules"],
    queryFn: () => apiGet<Rule[]>("/api/assignment-rules"),
  });

  const users = useQuery({
    queryKey: ["users", "agents"],
    queryFn: () => apiGet<{ items: AgentUser[] }>("/api/users?pageSize=100&status=active"),
    select: (d) => d.items.filter((u) => u.role === "agent" || u.role === "manager"),
  });

  const save = useMutation({
    mutationFn: (rule: Partial<Rule> & { id?: string }) =>
      rule.id
        ? apiPatch(`/api/assignment-rules/${rule.id}`, rule)
        : apiPost("/api/assignment-rules", rule),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignment-rules"] });
      setEditing(null);
      toast.success("Rule saved");
    },
    onError: (err) => toast.error(getErrorMessage(err, "Failed to save rule")),
  });

  const del = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/assignment-rules/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignment-rules"] });
      toast.success("Rule deleted");
    },
    onError: (err) => toast.error(getErrorMessage(err, "Failed to delete rule")),
  });

  if (!isAdmin && session?.role !== "manager") {
    return <p className="text-muted-foreground">Access denied.</p>;
  }

  const agentList = users.data ?? [];
  const agentMap = new Map(agentList.map((u) => [u.id, u.name]));

  function toggleAssignee(id: string) {
    if (!editing) return;
    const ids = editing.assigneeIds ?? [];
    setEditing({
      ...editing,
      assigneeIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assignment Rules</h1>
          <p className="text-muted-foreground">Auto-assign new leads by source, city, or zone.</p>
        </div>
        <Button onClick={() => setEditing({ ...BLANK })}>
          <Plus className="mr-2 h-4 w-4" /> New rule
        </Button>
      </div>

      {editing && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-base">{editing.id ? "Edit Rule" : "New Rule"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Rule name</Label>
                <Input
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. Bangalore Round-robin"
                />
              </div>
              <div className="space-y-1">
                <Label>Strategy</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editing.strategy ?? "round_robin"}
                  onChange={(e) => setEditing({ ...editing, strategy: e.target.value })}
                >
                  <option value="round_robin">Round Robin</option>
                  <option value="by_source">By Source</option>
                  <option value="by_area">By Area</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Priority (lower = higher priority)</Label>
                <Input
                  type="number"
                  min={0}
                  value={editing.priority ?? 0}
                  onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label>Filter by cities (comma-separated)</Label>
                <Input
                  placeholder="Bangalore, Mumbai…"
                  value={(editing.conditions?.cities ?? []).join(", ")}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      conditions: {
                        ...editing.conditions,
                        cities: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Filter by sources (comma-separated)</Label>
                <Input
                  placeholder="facebook, google…"
                  value={(editing.conditions?.sources ?? []).join(", ")}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      conditions: {
                        ...editing.conditions,
                        sources: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      },
                    })
                  }
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editing.isActive ?? true}
                  onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Assignees (agents who will receive leads)</Label>
              <div className="flex flex-wrap gap-2">
                {agentList.map((agent) => {
                  const selected = (editing.assigneeIds ?? []).includes(agent.id);
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => toggleAssignee(agent.id)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-muted"
                      }`}
                    >
                      {agent.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => save.mutate(editing)}
                disabled={save.isPending || !editing.name || !editing.assigneeIds?.length}
              >
                {save.isPending ? "Saving…" : "Save rule"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {rules.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading rules…</p>
        ) : (rules.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No assignment rules yet. Create one above.
          </p>
        ) : (
          (rules.data ?? []).map((rule) => (
            <Card key={rule.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm">{rule.name}</CardTitle>
                    <Badge variant={rule.isActive ? "default" : "secondary"}>
                      {rule.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {rule.strategy.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditing({ ...rule })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => del.mutate(rule.id)}
                      disabled={del.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription className="text-xs">
                  Priority {rule.priority} · Assignees:{" "}
                  {rule.assigneeIds.map((id) => agentMap.get(id) ?? id).join(", ")}
                  {rule.conditions.cities?.length
                    ? ` · Cities: ${rule.conditions.cities.join(", ")}`
                    : ""}
                  {rule.conditions.sources?.length
                    ? ` · Sources: ${rule.conditions.sources.join(", ")}`
                    : ""}
                </CardDescription>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
