import type { LeadRow } from "@/hooks/use-leads";
import { useIsManager } from "@/hooks/use-role";
import { apiGet, apiPatch } from "@/lib/apiClient";
import { getCurrentUserId } from "@/lib/auth";
import { useAuth } from "@/providers/auth-provider";
import type { LeadStatus } from "@propninja/types/enums";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const PIPELINE_LIMIT = 200;

export type PipelineFilter = "mine" | "all" | string;

function useAuthReady() {
  const { status } = useAuth();
  return status === "authenticated" && Boolean(getCurrentUserId());
}

function buildPipelineParams(filter: PipelineFilter) {
  const params = new URLSearchParams({
    scope: "pipeline",
    stage: "all",
    page: "1",
    pageSize: String(PIPELINE_LIMIT),
    excludeDuplicates: "true",
  });

  if (filter === "mine") {
    const userId = getCurrentUserId();
    if (userId) params.set("assignedTo", userId);
  } else if (filter !== "all") {
    params.set("assignedTo", filter);
  }

  return params.toString();
}

export function usePipelineLeads(filter: PipelineFilter) {
  const ready = useAuthReady();
  const isManager = useIsManager();
  const effectiveFilter = isManager ? filter : "mine";

  return useQuery({
    queryKey: ["pipeline", effectiveFilter],
    queryFn: () =>
      apiGet<{ items: LeadRow[]; page: number; pageSize: number; total: number }>(
        `/api/leads?${buildPipelineParams(effectiveFilter)}`,
      ),
    enabled: ready,
  });
}

type PipelineCache = { items: LeadRow[]; page: number; pageSize: number; total: number };

export function useUpdateLeadStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, stage }: { leadId: string; stage: LeadStatus }) =>
      apiPatch(`/api/leads/${leadId}`, { stage }),
    onMutate: async ({ leadId, stage }) => {
      await queryClient.cancelQueries({ queryKey: ["pipeline"] });
      const snapshots = queryClient.getQueriesData<PipelineCache>({ queryKey: ["pipeline"] });

      for (const [key, data] of snapshots) {
        if (!data) continue;
        queryClient.setQueryData<PipelineCache>(key, {
          ...data,
          items: data.items.map((lead) =>
            lead.id === leadId ? { ...lead, leadStatus: stage } : lead,
          ),
        });
      }

      return { snapshots };
    },
    onError: (_error, _vars, context) => {
      for (const [key, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}
