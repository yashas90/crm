import { LEAD_STATUSES } from "@propninja/types/enums";

export const FUNNEL_STAGES = LEAD_STATUSES.filter((stage) => stage !== "lost" && stage !== "won");

export type RevenuePipelineResult = {
  totalPipelineValue: number;
  confirmedRevenue: number;
  projectedRevenue: number;
  byProject: Array<{
    projectId: string;
    projectName: string;
    availableUnits: number;
    reservedUnits: number;
    bookedUnits: number;
    soldUnits: number;
    totalListedValue: number;
    totalBookedValue: number;
    leads: number;
  }>;
  byStage: Array<{
    stage: string;
    leadCount: number;
    estimatedValue: number;
  }>;
  wonThisPeriod: number;
  lostThisPeriod: number;
  conversionRate: number | null;
};

type BuildInput = {
  pipelineTotal: number;
  confirmedTotal: number;
  projectedTotal: number;
  avgUnitPrice: number;
  wonCount: number;
  lostCount: number;
  projects: Array<{
    projectId: string;
    projectName: string;
    availableUnits: number;
    reservedUnits: number;
    bookedUnits: number;
    soldUnits: number;
    totalListedValue: number;
    totalBookedValue: number;
    leadIds: string[];
  }>;
  stageCounts: Partial<Record<string, number>>;
};

/** Pure aggregation helper — used by the service and unit tests. */
export function buildRevenuePipelineFromRows(input: BuildInput): RevenuePipelineResult {
  const byProject = input.projects.map((project) => ({
    projectId: project.projectId,
    projectName: project.projectName,
    availableUnits: project.availableUnits,
    reservedUnits: project.reservedUnits,
    bookedUnits: project.bookedUnits,
    soldUnits: project.soldUnits,
    totalListedValue: project.totalListedValue,
    totalBookedValue: project.totalBookedValue,
    leads: new Set(project.leadIds).size,
  }));

  const byStage = FUNNEL_STAGES.map((stage) => {
    const leadCount = input.stageCounts[stage] ?? 0;
    return {
      stage,
      leadCount,
      estimatedValue: Math.round(input.avgUnitPrice * leadCount),
    };
  });

  const wonThisPeriod = input.wonCount;
  const lostThisPeriod = input.lostCount;
  const conversionRate =
    wonThisPeriod + lostThisPeriod > 0
      ? Math.round((wonThisPeriod / (wonThisPeriod + lostThisPeriod)) * 1000) / 10
      : null;

  return {
    totalPipelineValue: input.pipelineTotal,
    confirmedRevenue: input.confirmedTotal,
    projectedRevenue: input.projectedTotal,
    byProject,
    byStage,
    wonThisPeriod,
    lostThisPeriod,
    conversionRate,
  };
}
