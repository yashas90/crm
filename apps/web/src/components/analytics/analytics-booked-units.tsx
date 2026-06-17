"use client";

import { useBookedUnits } from "@/hooks/use-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import Link from "next/link";

type AnalyticsBookedUnitsProps = {
  dateFrom: string;
  dateTo: string;
};

export function AnalyticsBookedUnits({ dateFrom, dateTo }: AnalyticsBookedUnitsProps) {
  const booked = useBookedUnits(dateFrom, dateTo);

  if (booked.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading booked units…</p>;
  }

  const items = booked.data?.items ?? [];

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Booked units this month</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bookings recorded this month.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Reference</th>
                  <th className="pb-2 pr-4 font-medium">Project</th>
                  <th className="pb-2 pr-4 font-medium">Unit</th>
                  <th className="pb-2 pr-4 font-medium">Lead</th>
                  <th className="pb-2 font-medium">Booked</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-border/40">
                    <td className="py-2 pr-4 font-mono text-xs">{row.bookingRef}</td>
                    <td className="py-2 pr-4">
                      <Link
                        href={`/projects/${row.projectId}?step=inventory&status=booked`}
                        className="text-primary hover:underline"
                      >
                        {row.projectName}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">
                      {row.unitNumber} · F{row.floor} · {row.bedrooms}BHK
                    </td>
                    <td className="py-2 pr-4">{row.leadName || "—"}</td>
                    <td className="py-2">
                      {new Date(row.generatedAt).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function currentMonthIsoRange(now = new Date()) {
  const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
  return { dateFrom, dateTo };
}
