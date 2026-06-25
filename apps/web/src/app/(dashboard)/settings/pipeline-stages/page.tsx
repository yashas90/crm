"use client";

import { useSession } from "@/hooks/use-session";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

type Stage = {
  id: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  mapsToStatus: string | null;
};

const STATUS_OPTIONS = [
  { value: "", label: "— none —" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "not_interested", label: "Not Interested" },
  { value: "dropped", label: "Dropped" },
];

const BLANK: {
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  mapsToStatus: string | null;
} = {
  name: "",
  color: "#6366f1",
  position: 0,
  isDefault: false,
  mapsToStatus: null,
};

export default function PipelineStagesPage() {
  const { isAdmin } = useSession();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<(typeof BLANK & { id?: string }) | null>(null);

  const stages = useQuery({
    queryKey: ["pipeline-stages"],
    queryFn: () => apiGet<Stage[]>("/api/pipeline-stages"),
  });

  const save = useMutation({
    mutationFn: (s: typeof BLANK & { id?: string }) =>
      s.id ? apiPatch(`/api/pipeline-stages/${s.id}`, s) : apiPost("/api/pipeline-stages", s),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline-stages"] });
      setEditing(null);
      toast.success("Stage saved");
    },
    onError: (err) => toast.error(getErrorMessage(err, "Failed to save stage")),
  });

  const del = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/pipeline-stages/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline-stages"] });
      toast.success("Stage deleted");
    },
    onError: (err) => toast.error(getErrorMessage(err, "Failed to delete stage")),
  });

  const reorder = useMutation({
    mutationFn: (reordered: { id: string; position: number }[]) =>
      apiPut("/api/pipeline-stages/reorder", { stages: reordered }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-stages"] }),
    onError: () => toast.error("Failed to reorder stages"),
  });

  if (!isAdmin) {
    return <p className="text-muted-foreground">Admin access required.</p>;
  }

  const list = stages.data ?? [];

  function moveUp(index: number) {
    if (index === 0) return;
    const reordered = [...list];
    const temp = reordered[index - 1]!;
    reordered[index - 1] = reordered[index]!;
    reordered[index] = temp;
    reorder.mutate(reordered.map((s, i) => ({ id: s.id, position: i })));
  }

  function moveDown(index: number) {
    if (index === list.length - 1) return;
    const reordered = [...list];
    const temp = reordered[index + 1]!;
    reordered[index + 1] = reordered[index]!;
    reordered[index] = temp;
    reorder.mutate(reordered.map((s, i) => ({ id: s.id, position: i })));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline Stages</h1>
          <p className="text-muted-foreground">Customize your pipeline board columns.</p>
        </div>
        <Button onClick={() => setEditing({ ...BLANK, position: list.length })}>
          <Plus className="mr-2 h-4 w-4" /> Add stage
        </Button>
      </div>

      {editing && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-base">{editing.id ? "Edit Stage" : "New Stage"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Stage name</Label>
              <Input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="e.g. Hot Prospect"
              />
            </div>
            <div className="space-y-1">
              <Label>Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={editing.color}
                  onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                  className="h-10 w-12 cursor-pointer rounded border border-input p-1"
                />
                <Input
                  value={editing.color}
                  onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                  placeholder="#6366f1"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Maps to status</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={editing.mapsToStatus ?? ""}
                onChange={(e) => setEditing({ ...editing, mapsToStatus: e.target.value || null })}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Position</Label>
              <Input
                type="number"
                min={0}
                value={editing.position}
                onChange={(e) => setEditing({ ...editing, position: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="isDefault"
                checked={editing.isDefault}
                onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })}
              />
              <Label htmlFor="isDefault">Default stage for new leads</Label>
            </div>
            <div className="flex items-end gap-2">
              <Button
                onClick={() => save.mutate(editing)}
                disabled={save.isPending || !editing.name}
              >
                {save.isPending ? "Saving…" : "Save"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {stages.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom stages yet.</p>
        ) : (
          list.map((stage, i) => (
            <Card key={stage.id} className="flex items-center gap-3 px-4 py-3">
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div
                className="h-4 w-4 shrink-0 rounded-full"
                style={{ backgroundColor: stage.color }}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{stage.name}</p>
                {stage.mapsToStatus && (
                  <p className="text-xs text-muted-foreground">→ {stage.mapsToStatus}</p>
                )}
              </div>
              {stage.isDefault && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  default
                </span>
              )}
              <div className="flex shrink-0 items-center gap-1">
                <Button size="icon" variant="ghost" onClick={() => moveUp(i)} disabled={i === 0}>
                  ↑
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => moveDown(i)}
                  disabled={i === list.length - 1}
                >
                  ↓
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    setEditing({
                      id: stage.id,
                      name: stage.name,
                      color: stage.color,
                      position: stage.position,
                      isDefault: stage.isDefault,
                      mapsToStatus: stage.mapsToStatus ?? null,
                    })
                  }
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => del.mutate(stage.id)}
                  disabled={del.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
