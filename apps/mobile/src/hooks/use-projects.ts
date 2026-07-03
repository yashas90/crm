import { apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type UnitSummary = {
  total: number;
  available: number;
  reserved: number;
  booked: number;
  sold: number;
};

export type BookingDocumentSummary = {
  id: string;
  bookingRef: string;
  fileKey: string;
  fileUrl: string;
  generatedAt: string;
};

export type ProjectRow = {
  id: string;
  name: string;
  status: string;
  projectType: string;
  availability: boolean;
  unitSummary?: UnitSummary | null;
};

export type ProjectUnitRow = {
  id: string;
  projectId: string;
  unitNumber: string;
  floor: number;
  bedrooms: number;
  areaSqFt: string;
  status: "available" | "reserved" | "booked" | "sold";
  priceListedRs: number;
  priceFinalRs: number | null;
  assignedLeadId: string | null;
  assignedLead?: { id: string; name: string } | null;
  bookingDocument?: BookingDocumentSummary | null;
};

export type BookingListItem = {
  id: string;
  bookingRef: string;
  generatedAt: string;
  unitId: string;
  unitNumber: string;
  floor: number;
  bedrooms: number;
  status: ProjectUnitRow["status"];
  priceListedRs: number;
  priceFinalRs: number | null;
  projectId: string;
  projectName: string;
  leadId: string | null;
  leadName: string;
  agentId: string | null;
  agentName: string;
};

export function useProjectsList() {
  return useQuery({
    queryKey: ["projects", "list", "with-units"],
    queryFn: async () => {
      const res = await apiGet<{ items: ProjectRow[] }>(
        "/api/projects?page=1&pageSize=100&availability=true&includeUnitSummary=true",
      );
      return res.items ?? [];
    },
  });
}

export function useProjectUnits(projectId: string, status?: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const qs = params.toString();

  return useQuery({
    queryKey: ["projects", projectId, "units", status ?? "all"],
    queryFn: async () => {
      const res = await apiGet<ProjectUnitRow[]>(
        `/api/projects/${projectId}/units${qs ? `?${qs}` : ""}`,
      );
      return res ?? [];
    },
    enabled: Boolean(projectId),
  });
}

export function useBookingsList(filters?: {
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters?.dateTo) params.set("dateTo", filters.dateTo);
  if (filters?.search) params.set("search", filters.search);
  const qs = params.toString();

  return useQuery({
    queryKey: ["bookings", filters ?? {}],
    queryFn: async () => {
      const res = await apiGet<{
        items: BookingListItem[];
        page: number;
        pageSize: number;
        total: number;
      }>(`/api/bookings${qs ? `?${qs}` : ""}`);
      return res;
    },
  });
}

function invalidateProjectUnitQueries(qc: ReturnType<typeof useQueryClient>, projectId: string) {
  void qc.invalidateQueries({ queryKey: ["projects", projectId, "units"] });
  void qc.invalidateQueries({ queryKey: ["projects", "list"] });
  void qc.invalidateQueries({ queryKey: ["bookings"] });
  void qc.invalidateQueries({ queryKey: ["leads"] });
}

export function useReserveProjectUnit(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ unitId, leadId }: { unitId: string; leadId: string }) => {
      const res = await apiPost<ProjectUnitRow>(
        `/api/projects/${projectId}/units/${unitId}/reserve`,
        { leadId },
      );
      return res;
    },
    onSuccess: () => invalidateProjectUnitQueries(qc, projectId),
  });
}

export function useBookProjectUnit(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      unitId,
      priceFinalRs,
    }: {
      unitId: string;
      priceFinalRs?: number;
    }) => {
      const res = await apiPost<ProjectUnitRow & { bookingDocument?: BookingDocumentSummary }>(
        `/api/projects/${projectId}/units/${unitId}/book`,
        priceFinalRs !== undefined ? { priceFinalRs } : {},
      );
      return res;
    },
    onSuccess: () => invalidateProjectUnitQueries(qc, projectId),
  });
}

export function useReleaseProjectUnit(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (unitId: string) => {
      const res = await apiPost<ProjectUnitRow>(
        `/api/projects/${projectId}/units/${unitId}/release`,
        {},
      );
      return res;
    },
    onSuccess: () => invalidateProjectUnitQueries(qc, projectId),
  });
}

export function useUpdateProjectUnit(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      unitId,
      ...body
    }: {
      unitId: string;
      status?: ProjectUnitRow["status"];
      priceFinalRs?: number | null;
      notes?: string | null;
    }) => {
      const res = await apiPatch<ProjectUnitRow>(
        `/api/projects/${projectId}/units/${unitId}`,
        body,
      );
      return res;
    },
    onSuccess: () => invalidateProjectUnitQueries(qc, projectId),
  });
}

export async function fetchBookingPdfUrl(projectId: string, unitId: string) {
  const result = await apiGet<{ signedUrl: string; bookingRef: string }>(
    `/api/projects/${projectId}/units/${unitId}/booking-pdf`,
  );
  return result;
}

export function currentMonthIsoRange(now = new Date()) {
  const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
  return { dateFrom, dateTo };
}
