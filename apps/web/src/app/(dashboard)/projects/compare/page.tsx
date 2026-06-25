"use client";

import { Badge } from "@/components/ui/badge";
import { apiGet } from "@/lib/apiClient";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";

type ProjectListItem = { id: string; name: string; status: string };
type CompareProject = {
  id: string;
  name: string;
  status: string;
  projectType: string;
  builderName: string | null;
  minPrice: string | null;
  maxPrice: string | null;
  createdAt: string;
  stats: {
    totalLeads: number;
    wonLeads: number;
    conversionRate: number;
    totalVisits: number;
    completedVisits: number;
    visitToBookingRate: number;
    estimatedRevenue: number;
    units: Record<string, number>;
  };
};

function fmt(n: number) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  return `₹${n.toLocaleString()}`;
}

type StatKey =
  | "totalLeads"
  | "wonLeads"
  | "conversionRate"
  | "totalVisits"
  | "completedVisits"
  | "visitToBookingRate";
const STAT_ROWS: { key: StatKey; label: string; suffix: string }[] = [
  { key: "totalLeads", label: "Total Leads", suffix: "" },
  { key: "wonLeads", label: "Bookings", suffix: "" },
  { key: "conversionRate", label: "Conversion Rate", suffix: "%" },
  { key: "totalVisits", label: "Site Visits", suffix: "" },
  { key: "completedVisits", label: "Completed Visits", suffix: "" },
  { key: "visitToBookingRate", label: "Visit → Booking Rate", suffix: "%" },
];

export default function ProjectComparePage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const projects = useQuery({
    queryKey: ["projects", "list-all"],
    queryFn: () => apiGet<{ items: ProjectListItem[] }>("/api/projects?pageSize=200"),
    select: (d) => d.items,
  });

  const comparison = useQuery({
    queryKey: ["projects", "compare", selectedIds],
    queryFn: () => apiGet<CompareProject[]>(`/api/projects/compare?ids=${selectedIds.join(",")}`),
    enabled: selectedIds.length > 0,
  });

  const allProjects = projects.data ?? [];
  const filtered = allProjects.filter(
    (p) => !selectedIds.includes(p.id) && p.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  function addProject(id: string) {
    if (selectedIds.length >= 5) return;
    setSelectedIds((prev) => [...prev, id]);
    setSearchTerm("");
  }

  function removeProject(id: string) {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }

  const data = comparison.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Project Comparison</h1>
        <p className="text-muted-foreground">Compare up to 5 projects side by side.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {selectedIds.map((id) => {
          const p = allProjects.find((x) => x.id === id);
          return (
            <Badge key={id} variant="secondary" className="gap-1 px-3 py-1 text-sm">
              {p?.name ?? id}
              <button
                type="button"
                onClick={() => removeProject(id)}
                className="ml-1 opacity-60 hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}
        {selectedIds.length < 5 && (
          <div className="relative">
            <input
              type="text"
              placeholder="Add project…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {searchTerm && filtered.length > 0 && (
              <div className="absolute top-full z-10 mt-1 max-h-48 w-64 overflow-y-auto rounded-md border bg-popover shadow-md">
                {filtered.slice(0, 10).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => addProject(p.id)}
                  >
                    {p.name}
                    <Badge variant="outline" className="ml-auto text-xs">
                      {p.status}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {selectedIds.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
            Clear all
          </Button>
        )}
      </div>

      {selectedIds.length === 0 && (
        <p className="text-sm text-muted-foreground">Select projects above to compare.</p>
      )}

      {comparison.isLoading && <p className="text-sm text-muted-foreground">Loading comparison…</p>}

      {data.length > 0 && (
        <>
          {/* Header cards */}
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
          >
            {data.map((p) => (
              <Card key={p.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base leading-tight">{p.name}</CardTitle>
                    <button
                      type="button"
                      onClick={() => removeProject(p.id)}
                      className="ml-2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.projectType} · {p.builderName ?? "—"}
                  </p>
                </CardHeader>
                <CardContent className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="outline" className="text-xs">
                      {p.status}
                    </Badge>
                  </div>
                  {(p.minPrice || p.maxPrice) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Price range</span>
                      <span className="font-medium">
                        {p.minPrice ? fmt(Number(p.minPrice)) : "—"} –{" "}
                        {p.maxPrice ? fmt(Number(p.maxPrice)) : "—"}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Stats comparison table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left text-muted-foreground font-normal">Metric</th>
                    {data.map((p) => (
                      <th key={p.id} className="py-2 px-4 text-right font-semibold">
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {STAT_ROWS.map(({ key, label, suffix }) => {
                    const vals = data.map((p) => p.stats[key]);
                    const max = Math.max(...vals);
                    return (
                      <tr key={key} className="border-b last:border-0">
                        <td className="py-2 text-muted-foreground">{label}</td>
                        {data.map((p, i) => (
                          <td
                            key={p.id}
                            className={`py-2 px-4 text-right font-medium tabular-nums ${vals[i] === max && max > 0 ? "text-emerald-600" : ""}`}
                          >
                            {p.stats[key]}
                            {suffix ?? ""}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  <tr className="border-b last:border-0">
                    <td className="py-2 text-muted-foreground">Est. Revenue (Won)</td>
                    {data.map((p) => {
                      const vals = data.map((x) => x.stats.estimatedRevenue);
                      const max = Math.max(...vals);
                      return (
                        <td
                          key={p.id}
                          className={`py-2 px-4 text-right font-medium tabular-nums ${p.stats.estimatedRevenue === max && max > 0 ? "text-emerald-600" : ""}`}
                        >
                          {p.stats.estimatedRevenue > 0 ? fmt(p.stats.estimatedRevenue) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
