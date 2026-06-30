import type { LeadRow } from "@/hooks/use-leads";
import type { LeadStatus } from "@propninja/types/enums";

export type PipelineStage = {
  key: string;
  label: string;
  collapsible?: boolean;
};

/** Pipeline columns — qualified slug displays as Site Visit (product terminology). */
export const PIPELINE_STAGES: PipelineStage[] = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "qualified", label: "Site Visit" },
  { key: "negotiation", label: "Negotiation" },
  { key: "won", label: "Won", collapsible: true },
  { key: "lost", label: "Lost", collapsible: true },
];

export const ACTIVE_PIPELINE_STAGES = PIPELINE_STAGES.filter((s) => !s.collapsible);
export const CLOSED_PIPELINE_STAGES = PIPELINE_STAGES.filter((s) => s.collapsible);

export type PipelineBoard = Record<string, LeadRow[]>;

export function buildStageKeySet(stages: PipelineStage[]) {
  return new Set(stages.map((stage) => stage.key));
}

export function normalizePipelineStatus(
  status: string | null | undefined,
  stageKeys?: Set<string>,
): LeadStatus {
  const keys = stageKeys ?? buildStageKeySet(PIPELINE_STAGES);
  if (status && keys.has(status)) {
    return status as LeadStatus;
  }
  return "new";
}

/** Group leads into pipeline columns; unknown statuses fall into `new`. */
export function groupLeadsByStage(
  leads: LeadRow[],
  stages: PipelineStage[] = PIPELINE_STAGES,
): PipelineBoard {
  const board = Object.fromEntries(
    stages.map((stage) => [stage.key, [] as LeadRow[]]),
  ) as PipelineBoard;

  for (const lead of leads) {
    const key = normalizePipelineStatus(lead.leadStatus, buildStageKeySet(stages));
    if (!board[key]) board[key] = [];
    board[key].push({ ...lead, leadStatus: key });
  }

  return board;
}

export function pipelineStageLabel(
  key: LeadStatus,
  stages: PipelineStage[] = PIPELINE_STAGES,
): string {
  return stages.find((stage) => stage.key === key)?.label ?? key;
}
