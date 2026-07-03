"use client";

import { LeadScoreBadge } from "@/components/leads/lead-score-badge";
import { Badge } from "@/components/ui/badge";
import { NeuBadge, NeuCard } from "@/components/ui/neubrutal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { HotLeadRow } from "@/hooks/use-reports";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import Link from "next/link";

function relativeTime(value: string | null) {
  if (!value) return "Never";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function nextAction(lead: HotLeadRow) {
  if (lead.next_followup_at) {
    const date = new Date(lead.next_followup_at);
    const now = new Date();
    if (date <= now) return "Follow up now";
    return `Follow up ${date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
  }
  return "Reach out soon";
}

const STATUS_CHIP: Record<string, string> = {
  new: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  contacted: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  qualified: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  negotiation: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  won: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  lost: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

type HotLeadsTableProps = {
  leads: HotLeadRow[];
  variant?: "default" | "neubrutal";
};

export function HotLeadsTable({ leads, variant = "default" }: HotLeadsTableProps) {
  const showScore = leads.some((lead) => typeof lead.score === "number");

  if (variant === "neubrutal") {
    return (
      <NeuCard hover={false} className="overflow-hidden">
        {leads.length === 0 ? (
          <p className="p-6 text-sm text-neutral-600">No hot leads in the pipeline right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="neubrutal-table w-full border-collapse">
              <thead>
                <tr>
                  <th>Lead Name</th>
                  <th>Contact</th>
                  <th>Location</th>
                  <th>Status</th>
                  {showScore ? <th>Score</th> : null}
                  <th>Next Action</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="cursor-pointer">
                    <td className="font-bold">
                      <Link href={`/leads/${lead.id}`} className="hover:underline">
                        {lead.name}
                      </Link>
                    </td>
                    <td>{lead.phone ?? "—"}</td>
                    <td>{lead.city ?? "—"}</td>
                    <td>
                      <NeuBadge>Hot</NeuBadge>
                    </td>
                    {showScore ? (
                      <td>
                        {typeof lead.score === "number" ? (
                          <LeadScoreBadge score={lead.score} showPoints />
                        ) : (
                          "—"
                        )}
                      </td>
                    ) : null}
                    <td className="italic text-neutral-600">{nextAction(lead)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </NeuCard>
    );
  }

  return (
    <Card className="">
      <CardHeader>
        <CardTitle className="text-base">Hot leads — follow up soon</CardTitle>
      </CardHeader>
      <CardContent>
        {leads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hot leads in the pipeline right now.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Status</TableHead>
                {showScore ? <TableHead>Score</TableHead> : null}
                <TableHead>Last contacted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer transition-colors duration-150 hover:bg-muted/50"
                >
                  <TableCell>
                    <Link href={`/leads/${lead.id}`} className="font-medium hover:text-primary">
                      {lead.name}
                    </Link>
                  </TableCell>
                  <TableCell>{lead.phone ?? "—"}</TableCell>
                  <TableCell>{lead.city ?? "—"}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_CHIP[lead.status] ?? ""}>{lead.status}</Badge>
                  </TableCell>
                  {showScore ? (
                    <TableCell>
                      {typeof lead.score === "number" ? (
                        <LeadScoreBadge score={lead.score} showPoints />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  ) : null}
                  <TableCell className="text-muted-foreground">
                    {relativeTime(lead.last_contacted_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
