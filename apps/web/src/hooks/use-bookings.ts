"use client";

import { apiGet } from "@/lib/apiClient";
import type { BookingListItem } from "@propninja/types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export type BookingsListData = {
  items: BookingListItem[];
  page: number;
  pageSize: number;
  total: number;
};

export type BookingsFilters = {
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
  projectId?: string;
  agentId?: string;
  search?: string;
};

function buildQuery(filters: BookingsFilters) {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.agentId) params.set("agentId", filters.agentId);
  if (filters.search) params.set("search", filters.search);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useBookings(filters: BookingsFilters = {}) {
  const query = buildQuery(filters);
  return useQuery({
    queryKey: ["bookings", filters],
    queryFn: () => apiGet<BookingsListData>(`/api/bookings${query}`),
    placeholderData: keepPreviousData,
  });
}

export function currentMonthIsoRange(now = new Date()) {
  const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
  return { dateFrom, dateTo };
}

export async function openBookingPdf(projectId: string, unitId: string) {
  const result = await apiGet<{ signedUrl: string }>(
    `/api/projects/${projectId}/units/${unitId}/booking-pdf`,
  );
  if (result?.signedUrl) {
    window.open(result.signedUrl, "_blank", "noopener,noreferrer");
  }
}
