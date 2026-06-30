import { apiGet } from "@/lib/apiClient";
import {
  ACTIVE_PIPELINE_STAGES,
  CLOSED_PIPELINE_STAGES,
  PIPELINE_STAGES,
  type PipelineStage,
} from "@/lib/pipeline";
import type { LeadStatus } from "@propninja/types/enums";
import { useQuery } from "@tanstack/react-query";

export type PipelineStageRow = {
  id: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  mapsToStatus: string | null;
};

function mapApiStage(row: PipelineStageRow): PipelineStage {
  const key = (row.mapsToStatus ?? row.name.toLowerCase().replace(/\s+/g, "_")) as LeadStatus;
  const collapsible = key === "won" || key === "lost";
  return { key, label: row.name, collapsible };
}

export function usePipelineStages() {
  return useQuery({
    queryKey: ["pipeline-stages"],
    queryFn: () => apiGet<PipelineStageRow[]>("/api/pipeline-stages"),
    staleTime: 60_000,
    select: (rows) => {
      if (!rows.length) {
        return {
          all: PIPELINE_STAGES,
          active: ACTIVE_PIPELINE_STAGES,
          closed: CLOSED_PIPELINE_STAGES,
        };
      }
      const all = rows
        .slice()
        .sort((a, b) => a.position - b.position)
        .map(mapApiStage);
      return {
        all,
        active: all.filter((stage) => !stage.collapsible),
        closed: all.filter((stage) => stage.collapsible),
      };
    },
  });
}
