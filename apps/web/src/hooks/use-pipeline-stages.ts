"use client";

import { apiGet } from "@/lib/apiClient";
import { useQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";

export type PipelineStageRow = {
  id: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  mapsToStatus: string | null;
};

export type PipelineStageView = {
  key: string;
  label: string;
  color: string;
  colorStyle?: CSSProperties;
};

export const DEFAULT_PIPELINE_STAGES: PipelineStageView[] = [
  { key: "new", label: "New", color: "bg-slate-100 border-slate-200 dark:bg-slate-800/60" },
  { key: "contacted", label: "Contacted", color: "bg-blue-50 border-blue-200 dark:bg-blue-900/20" },
  {
    key: "qualified",
    label: "Qualified",
    color: "bg-violet-50 border-violet-200 dark:bg-violet-900/20",
  },
  {
    key: "negotiation",
    label: "Negotiation",
    color: "bg-amber-50 border-amber-200 dark:bg-amber-900/20",
  },
  { key: "won", label: "Won", color: "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20" },
  { key: "lost", label: "Lost", color: "bg-rose-50 border-rose-200 dark:bg-rose-900/20" },
];

function mapApiStage(stage: PipelineStageRow): PipelineStageView {
  const key = stage.mapsToStatus ?? stage.name.toLowerCase().replace(/\s+/g, "_");
  return {
    key,
    label: stage.name,
    color: "border-2",
    colorStyle: { borderColor: stage.color, backgroundColor: `${stage.color}18` },
  };
}

export function usePipelineStages() {
  return useQuery({
    queryKey: ["pipeline-stages"],
    queryFn: () => apiGet<PipelineStageRow[]>("/api/pipeline-stages"),
    staleTime: 60_000,
    select: (rows) => {
      if (!rows.length) return DEFAULT_PIPELINE_STAGES;
      return rows
        .slice()
        .sort((a, b) => a.position - b.position)
        .map(mapApiStage);
    },
  });
}
