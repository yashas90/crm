"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  type ManagerVisitBoard as VisitBoard,
  useManagerVisitBoard,
} from "@/hooks/use-site-visits";
import { formatVisitTimeIst } from "@propninja/types/ist";

const PIN_COLOR: Record<VisitBoard["items"][number]["color"], string> = {
  green: "#16a34a",
  blue: "#2563eb",
  yellow: "#ca8a04",
  red: "#dc2626",
  slate: "#64748b",
};

export function ManagerVisitBoard() {
  const board = useManagerVisitBoard(true);
  const data = board.data;

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div>
        <h2 className="text-lg font-semibold">Today</h2>
        <p className="text-sm text-muted-foreground">
          Map SDK was not added. Pins use the same colors and open in Google Maps.
        </p>
      </div>
      {board.isLoading ? (
        <div className="grid gap-2 sm:grid-cols-5">
          {["Scheduled", "Checked in", "Completed", "Upcoming", "No-show"].map((label) => (
            <Skeleton key={label} className="h-16" />
          ))}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-5">
          <Count label="Scheduled" value={data?.counts.scheduled ?? 0} />
          <Count label="Checked in" value={data?.counts.checkedIn ?? 0} />
          <Count label="Completed" value={data?.counts.completed ?? 0} />
          <Count label="Upcoming" value={data?.counts.upcoming ?? 0} />
          <Count label="No-show" value={data?.counts.noShow ?? 0} />
        </div>
      )}
      <div className="flex flex-wrap gap-3 text-xs">
        <Legend color={PIN_COLOR.green} label="In progress" />
        <Legend color={PIN_COLOR.blue} label="Completed" />
        <Legend color={PIN_COLOR.yellow} label="Upcoming within 2h" />
        <Legend color={PIN_COLOR.red} label="No-show or overdue" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-2 pr-3">Agent</th>
              <th className="py-2 pr-3">Time</th>
              <th className="py-2 pr-3">Property</th>
              <th className="py-2 pr-3">Lead</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Check-in</th>
              <th className="py-2 pr-3">Outcome</th>
              <th className="py-2">GPS</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="py-2 pr-3">
                  <span
                    className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: PIN_COLOR[item.color] }}
                  />
                  {item.agentName}
                </td>
                <td className="py-2 pr-3">{formatVisitTimeIst(item.time)}</td>
                <td className="py-2 pr-3">
                  {item.mapsUrl ? (
                    <a className="underline" href={item.mapsUrl} target="_blank" rel="noreferrer">
                      {item.property}
                    </a>
                  ) : (
                    item.property
                  )}
                </td>
                <td className="py-2 pr-3">
                  {item.leadName}
                  {item.leadCode ? ` (${item.leadCode})` : ""}
                </td>
                <td className="py-2 pr-3 capitalize">{item.status.replaceAll("_", " ")}</td>
                <td className="py-2 pr-3">
                  {item.checkinAt ? new Date(item.checkinAt).toLocaleTimeString("en-IN") : "—"}
                </td>
                <td className="py-2 pr-3">{item.outcome?.replaceAll("_", " ") ?? "—"}</td>
                <td className="py-2">
                  {item.gpsVerified ? "Verified" : "No"}
                  {item.agentMapsUrl ? (
                    <>
                      {" "}
                      <a
                        className="underline"
                        href={item.agentMapsUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Pin
                      </a>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!board.isLoading && (data?.items.length ?? 0) === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No visits scheduled today.</p>
        ) : null}
      </div>
    </section>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
