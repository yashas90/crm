"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AUDIT_LOG_PAGE_SIZE,
  type AuditLogRow,
  type AuditLogsQuery,
  exportAuditLogsCsv,
  useAuditLogs,
} from "@/hooks/use-audit-logs";
import { useUsers } from "@/hooks/use-users";
import {
  AUDIT_ACTION_OPTIONS,
  AUDIT_BADGE_CLASSES,
  AUDIT_ENTITY_TYPES,
  auditBadgeVariant,
  auditDetailsPreview,
  auditEntityHref,
  formatAuditAction,
} from "@/lib/audit-log";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { cn } from "@propninja/ui/lib/utils";
import { ChevronDown, ChevronRight, Download, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function toIsoStart(date: string) {
  return new Date(`${date}T00:00:00`).toISOString();
}

function toIsoEnd(date: string) {
  return new Date(`${date}T23:59:59.999`).toISOString();
}

export function AuditLogPageView() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const query = useMemo<AuditLogsQuery>(
    () => ({
      dateFrom: dateFrom ? toIsoStart(dateFrom) : undefined,
      dateTo: dateTo ? toIsoEnd(dateTo) : undefined,
      userId: userId || undefined,
      action: action || undefined,
      entityType: entityType || undefined,
      search: search.trim() || undefined,
      page,
      pageSize: AUDIT_LOG_PAGE_SIZE,
    }),
    [action, dateFrom, dateTo, entityType, page, search, userId],
  );

  const auditQuery = useAuditLogs(query);
  const { data: usersData } = useUsers();

  const totalPages = Math.max(1, Math.ceil((auditQuery.data?.total ?? 0) / AUDIT_LOG_PAGE_SIZE));

  function resetFilters() {
    setDateFrom("");
    setDateTo("");
    setUserId("");
    setAction("");
    setEntityType("");
    setSearch("");
    setPage(1);
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
            Full activity history across leads, users, calls, visits, and settings.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void exportAuditLogsCsv(query)}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
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
      </div>

      <div className="grid gap-3 border-2 border-black bg-muted/20 p-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <FilterField label="From">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
        </FilterField>
        <FilterField label="To">
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
        </FilterField>
        <FilterField label="User">
          <select
            className={selectClass}
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All users</option>
            {(usersData ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Action">
          <select
            className={selectClass}
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All actions</option>
            {AUDIT_ACTION_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {formatAuditAction(opt)}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Entity type">
          <select
            className={selectClass}
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All entities</option>
            {AUDIT_ENTITY_TYPES.map((opt) => (
              <option key={opt} value={opt}>
                {opt.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Search entity">
          <Input
            placeholder="Entity name…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </FilterField>
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          Clear filters
        </Button>
      </div>

      <div className="overflow-x-auto border-2 border-black">
        {auditQuery.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading audit log…</p>
        ) : auditQuery.isError ? (
          <p className="p-6 text-sm text-destructive">Unable to load audit log.</p>
        ) : !auditQuery.data?.items.length ? (
          <p className="p-6 text-sm text-muted-foreground">No audit events match your filters.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditQuery.data.items.map((row) => (
                <AuditLogRowView
                  key={row.id}
                  row={row}
                  expanded={expandedId === row.id}
                  onToggle={() => setExpandedId((id) => (id === row.id ? null : row.id))}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {auditQuery.data && auditQuery.data.total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            Page {auditQuery.data.page} of {totalPages} · {auditQuery.data.total} events
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function AuditLogRowView({
  row,
  expanded,
  onToggle,
}: {
  row: AuditLogRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const variant = auditBadgeVariant(row.action);
  const href = auditEntityHref(row);
  const deleted = row.entityExists === false;
  const displayName = row.entityName ?? row.entityId.slice(0, 8);

  return (
    <>
      <TableRow className="align-top">
        <TableCell>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted"
            onClick={onToggle}
            aria-label={expanded ? "Collapse details" : "Expand details"}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </TableCell>
        <TableCell className="whitespace-nowrap text-sm">
          {new Date(row.createdAt).toLocaleString()}
        </TableCell>
        <TableCell className="text-sm">
          <div className="font-medium">{row.userName}</div>
          <div className="text-xs text-muted-foreground">{row.userEmail}</div>
        </TableCell>
        <TableCell>
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
              AUDIT_BADGE_CLASSES[variant],
            )}
          >
            {formatAuditAction(row.action)}
          </span>
        </TableCell>
        <TableCell className="text-sm">
          <div className="capitalize text-muted-foreground">
            {row.entityType.replace(/_/g, " ")}
          </div>
          {deleted ? (
            <span className="text-muted-foreground">
              {displayName} <span className="text-xs">[deleted]</span>
            </span>
          ) : href ? (
            <Link href={href} className="font-medium text-primary hover:underline">
              {displayName}
            </Link>
          ) : (
            <span className="font-medium">{displayName}</span>
          )}
          {row.ipAddress ? (
            <div className="font-mono text-xs text-muted-foreground">{row.ipAddress}</div>
          ) : null}
        </TableCell>
        <TableCell className="max-w-xs text-xs text-muted-foreground">
          {auditDetailsPreview(row.metadata)}
        </TableCell>
      </TableRow>
      {expanded ? (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30">
            <pre className="overflow-x-auto rounded-md border border-black bg-background p-3 text-xs">
              {JSON.stringify(row.metadata, null, 2)}
            </pre>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}
