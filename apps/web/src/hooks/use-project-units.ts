"use client";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type UnitStatus = "available" | "reserved" | "booked" | "sold";

export type ProjectUnitRow = {
  id: string;
  projectId: string;
  unitNumber: string;
  floor: number;
  bedrooms: number;
  areaSqFt: string;
  status: UnitStatus;
  priceListedRs: number;
  priceFinalRs: number | null;
  assignedLeadId: string | null;
  notes: string | null;
  assignedLead?: { id: string; name: string } | null;
  bookingDocument?: BookingDocumentSummary | null;
  createdAt: string;
  updatedAt: string;
};

export type BookingDocumentSummary = {
  id: string;
  bookingRef: string;
  fileKey: string;
  fileUrl: string;
  generatedAt: string;
};

export type UnitSummary = {
  total: number;
  available: number;
  reserved: number;
  booked: number;
  sold: number;
};

export type UnitFilters = {
  status?: UnitStatus;
  bedrooms?: number;
  floor?: number;
};

function unitsKey(projectId: string, filters?: UnitFilters) {
  return ["projects", projectId, "units", filters ?? {}] as const;
}

export function useProjectUnits(projectId: string, filters?: UnitFilters) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.bedrooms !== undefined) params.set("bedrooms", String(filters.bedrooms));
  if (filters?.floor !== undefined) params.set("floor", String(filters.floor));
  const qs = params.toString();

  return useQuery({
    queryKey: unitsKey(projectId, filters),
    queryFn: async () => {
      const rows = await apiGet<ProjectUnitRow[]>(
        `/api/projects/${projectId}/units${qs ? `?${qs}` : ""}`,
      );
      return rows ?? [];
    },
    enabled: Boolean(projectId),
  });
}

export function useProjectUnitSummary(projectId: string) {
  return useQuery({
    queryKey: ["projects", projectId, "units", "summary"],
    queryFn: async () => {
      const summary = await apiGet<UnitSummary>(`/api/projects/${projectId}/units/summary`);
      return summary;
    },
    enabled: Boolean(projectId),
  });
}

export type BulkAddUnitsInput = {
  unitNumberFrom: string;
  unitNumberTo: string;
  floor: number;
  bedrooms: 1 | 2 | 3 | 4;
  areaSqFt: number;
  priceListedRs: number;
  notes?: string;
};

export function useBulkAddProjectUnits(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BulkAddUnitsInput) => {
      const units = await apiPost<ProjectUnitRow[]>(`/api/projects/${projectId}/units`, {
        bulk: input,
      });
      return units ?? [];
    },
    onSuccess: (units) => {
      void qc.invalidateQueries({ queryKey: ["projects", projectId, "units"] });
      toast.success(`Added ${units.length} unit${units.length === 1 ? "" : "s"}`);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add units"),
  });
}

export type UpdateProjectUnitInput = {
  status?: UnitStatus;
  priceListedRs?: number;
  priceFinalRs?: number | null;
  assignedLeadId?: string | null;
  notes?: string | null;
};

export function useUpdateProjectUnit(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ unitId, ...body }: UpdateProjectUnitInput & { unitId: string }) => {
      const unit = await apiPatch<ProjectUnitRow>(
        `/api/projects/${projectId}/units/${unitId}`,
        body,
      );
      return unit;
    },
    onSuccess: (unit) => {
      void qc.invalidateQueries({ queryKey: ["projects", projectId, "units"] });
      if (unit.bookingDocument) {
        toast.success("Unit booked ✓  Booking summary PDF generated");
      } else {
        toast.success("Unit updated");
      }
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update unit"),
  });
}

export function useDeleteProjectUnit(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (unitId: string) => {
      await apiDelete(`/api/projects/${projectId}/units/${unitId}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["projects", projectId, "units"] });
      toast.success("Unit removed");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete unit"),
  });
}

export function projectUnitsExportUrl(projectId: string) {
  return `/api/projects/${projectId}/units/export`;
}

export function useBookingPdfUrl(projectId: string, unitId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["projects", projectId, "units", unitId, "booking-pdf"],
    queryFn: async () =>
      apiGet<{ signedUrl: string; expiresInSeconds: number; bookingRef: string }>(
        `/api/projects/${projectId}/units/${unitId}/booking-pdf`,
      ),
    enabled: enabled && Boolean(projectId && unitId),
    staleTime: 30 * 60 * 1000,
  });
}

export async function openBookingPdf(projectId: string, unitId: string) {
  const result = await apiGet<{ signedUrl: string }>(
    `/api/projects/${projectId}/units/${unitId}/booking-pdf`,
  );
  if (result?.signedUrl) {
    window.open(result.signedUrl, "_blank", "noopener,noreferrer");
  }
}
