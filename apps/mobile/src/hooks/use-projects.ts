import { apiGet, apiPatch } from "@/lib/apiClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type UnitSummary = {
  total: number;
  available: number;
  reserved: number;
  booked: number;
  sold: number;
};

export type ProjectRow = {
  id: string;
  name: string;
  status: string;
  projectType: string;
  availability: boolean;
  unitSummary?: UnitSummary;
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

export function useReserveProjectUnit(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ unitId, leadId }: { unitId: string; leadId: string }) => {
      const res = await apiPatch<ProjectUnitRow>(`/api/projects/${projectId}/units/${unitId}`, {
        status: "reserved",
        assignedLeadId: leadId,
      });
      return res;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["projects", projectId, "units"] });
      void qc.invalidateQueries({ queryKey: ["projects", "list"] });
      void qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}
