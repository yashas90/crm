import type { LeadRow } from "@/hooks/use-leads";
import type { LeadStatus } from "@propninja/types/enums";

export type PipelineStage = {
  key: LeadStatus;
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

export type PipelineBoard = Record<LeadStatus, LeadRow[]>;

const STAGE_KEYS = new Set(PIPELINE_STAGES.map((s) => s.key));

export function normalizePipelineStatus(status: string | null | undefined): LeadStatus {
  if (status && STAGE_KEYS.has(status as LeadStatus)) {
    return status as LeadStatus;
  }
  return "new";
}

/** Group leads into pipeline columns; unknown statuses fall into `new`. */
export function groupLeadsByStage(leads: LeadRow[]): PipelineBoard {
  const board = Object.fromEntries(
    PIPELINE_STAGES.map((stage) => [stage.key, [] as LeadRow[]]),
  ) as PipelineBoard;

  for (const lead of leads) {
    const key = normalizePipelineStatus(lead.leadStatus);
    board[key].push({ ...lead, leadStatus: key });
  }

  return board;
}

export function pipelineStageLabel(key: LeadStatus): string {
  return PIPELINE_STAGES.find((s) => s.key === key)?.label ?? key;
}
