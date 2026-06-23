"use client";

import { type OverdueLead, useOverdueLeads } from "@/hooks/use-follow-ups";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { cn } from "@propninja/ui/lib/utils";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

function formatRelativeDays(days: number) {
  if (days <= 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function OverdueFollowupsWidget({ className }: { className?: string }) {
  const { data, isLoading } = useOverdueLeads();
  const items = (data?.items ?? []).slice(0, 10);

  return (
    <Card className={cn("rounded-xl ", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          Overdue follow-ups
        </CardTitle>
        {data ? <span className="text-xs text-muted-foreground">{data.total} total</span> : null}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <p className="px-6 py-4 text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-6 py-4 text-sm text-muted-foreground">
            No overdue follow-ups. Nice work!
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Lead</th>
                  <th className="px-4 py-2">Agent</th>
                  <th className="px-4 py-2">Last contacted</th>
                  <th className="px-4 py-2">Due since</th>
                  <th className="px-4 py-2">Days overdue</th>
                </tr>
              </thead>
              <tbody>
                {items.map((lead: OverdueLead) => (
                  <tr key={lead.id} className="border-t border-black hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {lead.firstName} {lead.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {lead.assignedUser?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatRelativeDays(lead.daysSinceContact)}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {lead.nextFollowupAt
                        ? new Date(lead.nextFollowupAt).toLocaleDateString("en-IN")
                        : "—"}
                    </td>
                    <td className="px-4 py-2 font-semibold text-orange-600">{lead.daysOverdue}</td>
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
