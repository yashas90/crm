import { describe, expect, it } from "vitest";
import {
  FUNNEL_STAGES,
  type RevenuePipelineResult,
  buildRevenuePipelineFromRows,
} from "./revenuePipelineCalculations.js";

describe("buildRevenuePipelineFromRows", () => {
  const baseInput = {
    pipelineTotal: 5_000_000,
    confirmedTotal: 2_500_000,
    projectedTotal: 1_200_000,
    avgUnitPrice: 2_500_000,
    wonCount: 3,
    lostCount: 1,
    projects: [
      {
        projectId: "p1",
        projectName: "Sunrise Towers",
        availableUnits: 10,
        reservedUnits: 2,
        bookedUnits: 1,
        soldUnits: 0,
        totalListedValue: 25_000_000,
        totalBookedValue: 2_500_000,
        leadIds: ["l1", "l2"],
      },
      {
        projectId: "p2",
        projectName: "Green Valley",
        availableUnits: 5,
        reservedUnits: 1,
        bookedUnits: 0,
        soldUnits: 0,
        totalListedValue: 8_000_000,
        totalBookedValue: 0,
        leadIds: ["l3"],
      },
    ],
    stageCounts: {
      new: 2,
      contacted: 1,
      qualified: 0,
      negotiation: 1,
    },
  };

  it("calculates revenue totals and conversion rate", () => {
    const result = buildRevenuePipelineFromRows(baseInput);

    expect(result.totalPipelineValue).toBe(5_000_000);
    expect(result.confirmedRevenue).toBe(2_500_000);
    expect(result.projectedRevenue).toBe(1_200_000);
    expect(result.wonThisPeriod).toBe(3);
    expect(result.lostThisPeriod).toBe(1);
    expect(result.conversionRate).toBe(75);
  });

  it("builds project breakdown with lead counts", () => {
    const result = buildRevenuePipelineFromRows(baseInput);
    expect(result.byProject).toHaveLength(2);
    expect(result.byProject[0]).toMatchObject({
      projectName: "Sunrise Towers",
      bookedUnits: 1,
      totalBookedValue: 2_500_000,
      leads: 2,
    });
    expect(result.byProject[1]?.bookedUnits).toBe(0);
    expect(result.byProject[1]?.leads).toBe(1);
  });

  it("builds stage funnel with estimated values from avg unit price", () => {
    const result = buildRevenuePipelineFromRows(baseInput);
    expect(result.byStage).toHaveLength(FUNNEL_STAGES.length);

    const negotiation = result.byStage.find((s) => s.stage === "negotiation");
    expect(negotiation).toEqual({
      stage: "negotiation",
      leadCount: 1,
      estimatedValue: 2_500_000,
    });

    const qualified = result.byStage.find((s) => s.stage === "qualified");
    expect(qualified?.leadCount).toBe(0);
    expect(qualified?.estimatedValue).toBe(0);
  });

  it("returns null conversion when no won or lost in period", () => {
    const result = buildRevenuePipelineFromRows({
      ...baseInput,
      wonCount: 0,
      lostCount: 0,
    });
    expect(result.conversionRate).toBeNull();
  });

  it("handles empty booked units (zero confirmed revenue)", () => {
    const result = buildRevenuePipelineFromRows({
      ...baseInput,
      confirmedTotal: 0,
      projects: baseInput.projects.map((p) => ({
        ...p,
        bookedUnits: 0,
        totalBookedValue: 0,
      })),
    });
    expect(result.confirmedRevenue).toBe(0);
    expect(result.byProject.every((p) => p.bookedUnits === 0)).toBe(true);
  });
});

describe("FUNNEL_STAGES", () => {
  it("excludes won and lost from funnel", () => {
    expect(FUNNEL_STAGES).not.toContain("won");
    expect(FUNNEL_STAGES).not.toContain("lost");
  });
});
