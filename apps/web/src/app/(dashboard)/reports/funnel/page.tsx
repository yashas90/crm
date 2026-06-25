"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/use-permissions";
import { apiGet } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, TrendingDown } from "lucide-react";

type FunnelStage = {
  stage: string;
  count: number;
  conversionFromPrev: number;
  conversionFromTop: number;
  dropOff: number;
};

type CloseReason = { reason: string | null; count: number };

type FunnelData = {
  total: number;
  stages: FunnelStage[];
  terminal: { lost: number; notInterested: number; dropped: number };
  closeReasons: CloseReason[];
};

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  negotiation: "Negotiation",
  won: "Won / Booked",
};

const CLOSE_REASON_LABELS: Record<string, string> = {
  budget_issue: "Budget Issue",
  not_serious: "Not Serious",
  competitor: "Went to Competitor",
  location_mismatch: "Location Mismatch",
  project_mismatch: "Project Mismatch",
  no_response: "No Response",
  already_purchased: "Already Purchased",
  future_requirement: "Future Requirement",
  other: "Other",
};

const STAGE_COLORS = [
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-emerald-500",
];

export default function FunnelReportPage() {
  const { canViewReports, ready } = usePermissions();

  const funnel = useQuery({
    queryKey: ["reports", "funnel"],
    queryFn: () => apiGet<FunnelData>("/api/reports/funnel"),
    enabled: ready && canViewReports,
  });

  if (ready && !canViewReports) return <AccessDeniedEmptyState />;

  const data = funnel.data;
  const maxCount = data ? Math.max(...data.stages.map((s) => s.count), 1) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Conversion Funnel</h1>
        <p className="text-muted-foreground">
          Lead drop-off rates and close reasons across pipeline stages.
        </p>
      </div>

      {funnel.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`skel-${i}`} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : funnel.isError ? (
        <p className="text-sm text-destructive">Failed to load funnel data.</p>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Leads
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{data.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Booked</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-emerald-600">
                  {data.stages.find((s) => s.stage === "won")?.count ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Lost / Not Interested
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-rose-500">
                  {data.terminal.lost + data.terminal.notInterested}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Pipeline Stages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.stages.map((stage, i) => (
                <div key={stage.stage}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{STAGE_LABELS[stage.stage] ?? stage.stage}</span>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span className="font-semibold text-foreground">{stage.count}</span>
                      {i > 0 && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <ArrowDown className="h-3 w-3" />
                          {stage.conversionFromPrev}% from prev
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {stage.conversionFromTop}% of total
                      </Badge>
                    </div>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${STAGE_COLORS[i] ?? "bg-slate-500"}`}
                      style={{ width: `${Math.max((stage.count / maxCount) * 100, 1)}%` }}
                    />
                  </div>
                  {i < data.stages.length - 1 && stage.dropOff > 0 && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-rose-500">
                      <TrendingDown className="h-3 w-3" />
                      {stage.dropOff} leads dropped off after this stage
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {data.closeReasons.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Close Reasons</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.closeReasons.map((row) => (
                  <div
                    key={row.reason ?? "unknown"}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{CLOSE_REASON_LABELS[row.reason ?? ""] ?? row.reason ?? "Unknown"}</span>
                    <Badge variant="secondary">{row.count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
