"use client";

import type { AnalyticsOverview } from "@/hooks/use-analytics";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { cn } from "@propninja/ui/lib/utils";
import { Download } from "lucide-react";
import { useMemo, useState } from "react";

type SortKey = keyof AnalyticsOverview["leaderboard"][number];

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "agentName", label: "Agent" },
  { key: "leadsAssigned", label: "Leads Assigned", align: "right" },
  { key: "callsMade", label: "Calls Made", align: "right" },
  { key: "answeredPercent", label: "Answered %", align: "right" },
  { key: "visitsDone", label: "Visits Done", align: "right" },
  { key: "won", label: "Won", align: "right" },
  { key: "conversionPercent", label: "Conversion %", align: "right" },
];

function pickTopPerformer(rows: AnalyticsOverview["leaderboard"]) {
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => {
    const scoreA = a.won * 10 + a.callsMade;
    const scoreB = b.won * 10 + b.callsMade;
    return scoreB - scoreA;
  })[0]?.agentId;
}

function exportLeaderboardCsv(rows: AnalyticsOverview["leaderboard"]) {
  const headers = COLUMNS.map((c) => c.label);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        `"${row.agentName.replace(/"/g, '""')}"`,
        row.leadsAssigned,
        row.callsMade,
        row.answeredPercent,
        row.visitsDone,
        row.won,
        row.conversionPercent,
      ].join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `team-leaderboard-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

type AnalyticsLeaderboardProps = {
  rows: AnalyticsOverview["leaderboard"];
};

export function AnalyticsLeaderboard({ rows }: AnalyticsLeaderboardProps) {
  const [sortKey, setSortKey] = useState<SortKey>("won");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const topPerformerId = useMemo(() => pickTopPerformer(rows), [rows]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const numA = Number(av);
      const numB = Number(bv);
      return sortDir === "asc" ? numA - numB : numB - numA;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "agentName" ? "asc" : "desc");
  }

  return (
    <Card className="">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-lg">Team leaderboard</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => exportLeaderboardCsv(sorted)}
          disabled={rows.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">
            No team activity in this period.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      "px-4 py-3 text-xs uppercase text-muted-foreground",
                      col.align === "right" && "text-right",
                    )}
                  >
                    <button
                      type="button"
                      className="inline-flex w-full cursor-pointer items-center gap-1 hover:text-foreground"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                      {sortKey === col.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr
                  key={row.agentId}
                  className={cn(
                    "border-t border-black",
                    row.agentId === topPerformerId && "bg-amber-50/80 dark:bg-amber-950/20",
                  )}
                >
                  <td className="px-4 py-3 font-medium">{row.agentName}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.leadsAssigned}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.callsMade}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.answeredPercent}%</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.visitsDone}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.won}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.conversionPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
