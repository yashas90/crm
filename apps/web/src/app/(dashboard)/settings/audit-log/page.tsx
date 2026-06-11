"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuditLogs } from "@/hooks/use-audit-logs";
import { useSession } from "@/hooks/use-session";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { RefreshCw } from "lucide-react";
import Link from "next/link";

function formatMetadata(metadata: Record<string, unknown>): string {
  const keys = Object.keys(metadata);
  if (keys.length === 0) return "—";
  return JSON.stringify(metadata);
}

export default function AuditLogPage() {
  const { ready, isAdmin } = useSession();
  const auditQuery = useAuditLogs({ limit: 50 }, ready && isAdmin);

  if (ready && !isAdmin) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
          <p className="text-sm text-muted-foreground">Admin-only activity history.</p>
        </div>
        <AccessDeniedEmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/settings" className="hover:underline">
              Settings
            </Link>
            {" / Audit log"}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
          <p className="text-muted-foreground">
            Latest critical admin actions (user changes, lead deletes, projects, TCF consent).
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void auditQuery.refetch()}
          disabled={auditQuery.isFetching}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${auditQuery.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent events</CardTitle>
          <CardDescription>Showing up to 50 most recent entries.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {auditQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading audit log…</p>
          ) : auditQuery.isError ? (
            <p className="text-sm text-destructive">Unable to load audit log.</p>
          ) : !auditQuery.data?.items.length ? (
            <p className="text-sm text-muted-foreground">No audit events recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Metadata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditQuery.data.items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(row.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{row.userName}</div>
                      <div className="text-xs text-muted-foreground">{row.userEmail}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.action}</TableCell>
                    <TableCell className="text-sm">
                      <div>{row.entityType}</div>
                      <div className="font-mono text-xs text-muted-foreground">{row.entityId}</div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                      {formatMetadata(row.metadata)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
