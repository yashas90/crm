"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import { useMyVisitReport, useOrgVisitReport } from "@/hooks/use-site-visits";
import { apiDownload } from "@/lib/apiClient";
import { Button } from "@propninja/ui/button";

export default function SiteVisitReportsPage() {
  const { session } = useSession();
  const isAdmin = session?.role === "admin";
  const org = useOrgVisitReport(isAdmin);
  const mine = useMyVisitReport(!isAdmin);
  const report = isAdmin ? org.data : mine.data;
  const loading = isAdmin ? org.isLoading : mine.isLoading;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Site visit reports</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Org-wide reactions, no-shows, and conversion." : "Your visit outcomes."}
          </p>
        </div>
        {isAdmin ? (
          <Button
            variant="outline"
            onClick={() =>
              void apiDownload("/api/site-visits/reports/org.xlsx", "site-visit-report.xls")
            }
          >
            Export Excel
          </Button>
        ) : null}
      </div>
      {loading || !report ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {["Visits", "Duration", "Stars", "Conversion", "No-show", "Completed"].map((label) => (
            <Skeleton key={label} className="h-20" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Visits" value={String(report.total)} />
            <Stat label="Avg duration" value={`${report.avgDurationMinutes} min`} />
            <Stat label="Avg stars" value={report.avgStars} />
            <Stat label="Visits to won" value={report.conversionPercent} />
            <Stat label="No-show rate" value={report.noShowRate} />
            <Stat label="Completed" value={String(report.completed)} />
          </div>
          <section>
            <h2 className="mb-2 font-medium">Outcomes</h2>
            <ul className="space-y-1 text-sm">
              {Object.entries(report.outcomes).map(([name, count]) => (
                <li key={name}>
                  {name.replaceAll("_", " ")} · {count}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="mb-2 font-medium">Common concerns</h2>
            <ul className="space-y-1 text-sm">
              {report.concerns.map(([name, count]) => (
                <li key={name}>
                  {name} · {count}
                </li>
              ))}
            </ul>
          </section>
          {isAdmin ? (
            <>
              <section>
                <h2 className="mb-2 font-medium">Property reactions</h2>
                <ul className="space-y-1 text-sm">
                  {report.propertyReactions.map((row) => (
                    <li key={row.property}>
                      {row.property} · {row.avgStars} stars · {row.visits} visits
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h2 className="mb-2 font-medium">Peak times</h2>
                <ul className="space-y-1 text-sm">
                  {report.peakHours.map((row) => (
                    <li key={row.hour}>
                      {row.hour} · {row.count}
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h2 className="mb-2 font-medium">Agent conversion</h2>
                <ul className="space-y-1 text-sm">
                  {(report.agents ?? []).map((agent) => (
                    <li key={agent.agentName}>
                      {agent.agentName} · {agent.conversionPercent} · {agent.avgStars} stars
                    </li>
                  ))}
                </ul>
              </section>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
