"use client";

import { apiGet } from "@/lib/apiClient";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export const AUDIT_LOG_PAGE_SIZE = 50;

export type AuditLogRow = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string | null;
  entityExists?: boolean;
  ipAddress?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AuditLogsQuery = {
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  action?: string;
  entityType?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type AuditLogsData = {
  items: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
};

function buildAuditLogsQuery(
  params: Pick<AuditLogsQuery, "dateFrom" | "dateTo" | "userId">,
): string {
  const search = new URLSearchParams();
  if (params.dateFrom) search.set("dateFrom", params.dateFrom);
  if (params.dateTo) search.set("dateTo", params.dateTo);
  if (params.userId) search.set("userId", params.userId);
  search.set("limit", "100");
  const qs = search.toString();
  return qs ? `/api/audit-logs?${qs}` : "/api/audit-logs";
}

function filterAuditRows(items: AuditLogRow[], params: AuditLogsQuery): AuditLogRow[] {
  let rows = items;

  if (params.action) {
    rows = rows.filter((row) => row.action === params.action);
  }
  if (params.entityType) {
    rows = rows.filter((row) => row.entityType === params.entityType);
  }
  if (params.search?.trim()) {
    const needle = params.search.trim().toLowerCase();
    rows = rows.filter((row) => {
      const haystack = [
        row.userName,
        row.userEmail,
        row.action,
        row.entityType,
        row.entityId,
        row.entityName ?? "",
        JSON.stringify(row.metadata ?? {}),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }

  return rows;
}

async function fetchAuditLogs(params: AuditLogsQuery): Promise<AuditLogsData> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? AUDIT_LOG_PAGE_SIZE;
  const response = await apiGet<{ items: AuditLogRow[] }>(
    buildAuditLogsQuery({
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      userId: params.userId,
    }),
  );
  const filtered = filterAuditRows(response.items, params);
  const total = filtered.length;
  const start = (page - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  };
}

export function useAuditLogs(
  params: AuditLogsQuery = { page: 1, pageSize: AUDIT_LOG_PAGE_SIZE },
  enabled = true,
) {
  return useQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => fetchAuditLogs(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (text.length > 0 && /^[=+\-@]/.test(text)) {
    return `'${text}`;
  }
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function exportAuditLogsCsv(params: AuditLogsQuery): Promise<void> {
  const { items } = await fetchAuditLogs({
    ...params,
    page: 1,
    pageSize: 10_000,
  });

  const headers = ["Timestamp", "User", "Email", "Action", "Entity Type", "Entity", "Details"];
  const lines = [
    headers.join(","),
    ...items.map((row) =>
      [
        row.createdAt,
        row.userName,
        row.userEmail,
        row.action,
        row.entityType,
        row.entityName ?? row.entityId,
        JSON.stringify(row.metadata ?? {}),
      ]
        .map((cell) => escapeCsvCell(cell))
        .join(","),
    ),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
