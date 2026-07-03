import type { LeadRow } from "@/hooks/use-leads";
import type { LeadStatus } from "@propninja/types/enums";

export type PipelineStage = {
  id?: string;
  key: string;
  label: string;
  /** Hex color from /api/pipeline-stages */
  color?: string;
  collapsible?: boolean;
};

const CLOSED_STAGE_KEYS = new Set<string>(["won", "lost"]);

/** Default columns when org has no pipeline_stages rows (matches web fallbacks). */
export const PIPELINE_STAGES: PipelineStage[] = [
  { key: "new", label: "New", color: "#64748b" },
  { key: "contacted", label: "Contacted", color: "#3b82f6" },
  { key: "qualified", label: "Site Visit", color: "#8b5cf6" },
  { key: "negotiation", label: "Negotiation", color: "#f59e0b" },
  { key: "won", label: "Won", color: "#10b981", collapsible: true },
  { key: "lost", label: "Lost", color: "#ef4444", collapsible: true },
];

export const ACTIVE_PIPELINE_STAGES = PIPELINE_STAGES.filter((s) => !s.collapsible);
export const CLOSED_PIPELINE_STAGES = PIPELINE_STAGES.filter((s) => s.collapsible);

export type PipelineBoard = Record<string, LeadRow[]>;

export function isClosedPipelineStage(stage: PipelineStage): boolean {
  return Boolean(stage.collapsible);
}

export function isClosedPipelineStageKey(key: string): boolean {
  return CLOSED_STAGE_KEYS.has(key);
}

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

/** Group leads into pipeline columns (exact status match, unknown → first column). */
export function groupLeadsByStage(
  leads: LeadRow[],
  stages: PipelineStage[] = PIPELINE_STAGES,
): PipelineBoard {
  const board = Object.fromEntries(
    stages.map((stage) => [stage.key, [] as LeadRow[]]),
  ) as PipelineBoard;
  const keys = buildStageKeySet(stages);
  const fallbackKey = stages[0]?.key ?? "new";

  for (const lead of leads) {
    const status = lead.leadStatus;
    const columnKey =
      status && board[status] !== undefined
        ? status
        : normalizePipelineStatus(status, keys) || fallbackKey;

    if (!board[columnKey]) {
      board[columnKey] = [];
    }
    board[columnKey].push(lead);
  }

  return board;
}

export function pipelineStageLabel(
  key: LeadStatus,
  stages: PipelineStage[] = PIPELINE_STAGES,
): string {
  return stages.find((stage) => stage.key === key)?.label ?? key;
}

export function sumPipelineColumnValue(leads: LeadRow[]): number {
  return leads.reduce((sum, lead) => {
    const value = lead.estimatedValue ? Number(lead.estimatedValue) : 0;
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

export function formatPipelineValue(total: number): string | null {
  if (total <= 0) return null;
  return `₹${total.toLocaleString("en-IN")}`;
}

export function pipelineStageHeaderStyle(stage: PipelineStage) {
  if (!stage.color) return undefined;
  return {
    borderColor: stage.color,
    backgroundColor: `${stage.color}18`,
  };
}
