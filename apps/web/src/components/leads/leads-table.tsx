"use client";

import { EmptyState } from "@/components/common/empty-state";
import { LeadDeleteDialog } from "@/components/leads/lead-delete-dialog";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LeadRow } from "@/hooks/use-leads";
import { getSession } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { cn } from "@propninja/ui/lib/utils";
import { Copy, Pencil, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUS_CHIP: Record<string, string> = {
  new: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  contacted: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  qualified: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  negotiation: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  won: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  lost: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

const TEMP_CHIP: Record<string, string> = {
  cold: "border border-border bg-transparent text-muted-foreground",
  warm: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  hot: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

type LeadsTableProps = {
  leads: LeadRow[];
  onEdit: (lead: LeadRow) => void;
  onAddLead?: () => void;
  isLoading?: boolean;
};

function relativeTime(value: string | null) {
  if (!value) return "Never";
  const diff = Date.now() - new Date(value).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function copyText(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    void navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }
}

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {initials}
    </div>
  );
}

export function LeadsTable({ leads, onEdit, onAddLead, isLoading }: LeadsTableProps) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<LeadRow | null>(null);
  const isAdmin = typeof window !== "undefined" && getSession()?.role === "admin";

  if (isLoading) {
    return <TableSkeleton rows={7} />;
  }

  if (leads.length === 0) {
    return (
      <EmptyState
        title="No leads yet"
        description="Create your first lead to start tracking calls and follow-ups."
        actionLabel="Add Lead"
        onActionClick={onAddLead}
        icon={<Users className="h-7 w-7" />}
      />
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead>Lead</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Last contacted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow
                key={lead.id}
                className="cursor-pointer transition-colors duration-150 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                onClick={() => router.push(`/leads/${lead.id}`)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="font-medium">
                        {lead.firstName} {lead.lastName}
                      </p>
                      {lead.temperature ? (
                        <span
                          className={cn(
                            "mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                            TEMP_CHIP[lead.temperature] ?? "bg-muted text-muted-foreground",
                          )}
                        >
                          {lead.temperature}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {lead.phone ? (
                    <div className="flex items-center gap-2">
                      <span>{lead.phone}</span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyText(lead.phone!);
                        }}
                        aria-label="Copy phone"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>{lead.city ?? "—"}</TableCell>
                <TableCell>
                  <Badge className={cn("capitalize", STATUS_CHIP[lead.leadStatus] ?? "")}>
                    {lead.leadStatus}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {lead.assignedUser ? <UserAvatar name={lead.assignedUser.name} /> : null}
                    <span className="text-sm">{lead.assignedUser?.name ?? "Unassigned"}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {relativeTime(lead.lastContactedAt)}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/leads/${lead.id}`)}
                    >
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`Edit ${lead.firstName} ${lead.lastName}`}
                      onClick={() => onEdit(lead)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {isAdmin ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(lead)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {deleteTarget ? (
        <LeadDeleteDialog
          leadId={deleteTarget.id}
          leadName={`${deleteTarget.firstName} ${deleteTarget.lastName}`}
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        />
      ) : null}
    </>
  );
}
