import { apiGet } from "@/lib/apiClient";
import {
  ACTIVE_PIPELINE_STAGES,
  CLOSED_PIPELINE_STAGES,
  PIPELINE_STAGES,
  type PipelineStage,
  isClosedPipelineStageKey,
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
  return {
    id: row.id,
    key,
    label: row.name,
    color: row.color,
    collapsible: isClosedPipelineStageKey(row.mapsToStatus ?? key),
  };
}

export type PipelineStageConfig = {
  all: PipelineStage[];
  active: PipelineStage[];
  closed: PipelineStage[];
  fromApi: boolean;
};

export function buildStageConfig(rows: PipelineStageRow[]): PipelineStageConfig {
  if (!rows.length) {
    return {
      all: PIPELINE_STAGES,
      active: ACTIVE_PIPELINE_STAGES,
      closed: CLOSED_PIPELINE_STAGES,
      fromApi: false,
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
    fromApi: true,
  };
}

export function usePipelineStages() {
  return useQuery({
    queryKey: ["pipeline-stages"],
    queryFn: () => apiGet<PipelineStageRow[]>("/api/pipeline-stages"),
    staleTime: 60_000,
    select: buildStageConfig,
  });
}
