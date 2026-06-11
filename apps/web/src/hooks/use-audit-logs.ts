"use client";

import { apiGet } from "@/lib/apiClient";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export type AuditLogRow = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AuditLogsData = {
  items: AuditLogRow[];
};

export type AuditLogsQuery = {
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  limit?: number;
};

function buildAuditLogsQuery(params: AuditLogsQuery): string {
  const search = new URLSearchParams();
  if (params.dateFrom) search.set("dateFrom", params.dateFrom);
  if (params.dateTo) search.set("dateTo", params.dateTo);
  if (params.userId) search.set("userId", params.userId);
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return qs ? `/api/audit-logs?${qs}` : "/api/audit-logs";
}

export function useAuditLogs(params: AuditLogsQuery = { limit: 50 }, enabled = true) {
  return useQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => apiGet<AuditLogsData>(buildAuditLogsQuery(params)),
    enabled,
    placeholderData: keepPreviousData,
  });
}
