import { describe, expect, it } from "vitest";
import { appraisalContribution, appraisalResult } from "./appraisalMath.js";

const agent = "agent";
const leader = "leader";

describe("appraisalResult", () => {
  it("recommends no hike below the minimum", () => {
    const result = appraisalResult({
      agentId: agent,
      designation: "Real Estate Consultant",
      monthlyBasic: 50_000,
      deals: [
        {
          agentId: agent,
          status: "approved",
          invoiceStatus: "collected",
          sharePercent: 100,
        },
      ],
    });
    expect(result.mapped).toBe(true);
    expect(result.eligible).toBe(false);
    expect(result.hikeAmount).toBe(0);
    expect(result.recommendedBasic).toBe(50_000);
  });

  it("recommends a 10% hike when both minimums are met on collected invoices", () => {
    const deals = Array.from({ length: 5 }, () => ({
      agentId: agent,
      status: "approved" as const,
      invoiceStatus: "collected" as const,
      sharePercent: 100,
    }));
    const result = appraisalResult({
      agentId: agent,
      designation: "Real Estate Consultant",
      monthlyBasic: 40_000,
      deals,
    });
    expect(result.countedSales).toBe(5);
    expect(result.countedUnits).toBe(5);
    expect(result.eligible).toBe(true);
    expect(result.hikeAmount).toBe(4_000);
    expect(result.recommendedBasic).toBe(44_000);
  });

  it("does not count an unapproved or uncollected TCF", () => {
    const contribution = appraisalContribution(
      [
        {
          agentId: agent,
          status: "pending_approval",
          invoiceStatus: "collected",
          sharePercent: 100,
        },
        { agentId: agent, status: "approved", invoiceStatus: "raised", sharePercent: 100 },
        { agentId: agent, status: "approved", invoiceStatus: "not_raised", sharePercent: 100 },
      ],
      agent,
    );
    expect(contribution.countedUnits).toBe(0);
    expect(contribution.countedSales).toBe(0);
  });

  it("counts a 50% share as half a unit and ignores the leader's team", () => {
    const deals = [
      {
        agentId: agent,
        status: "approved" as const,
        invoiceStatus: "collected" as const,
        sharePercent: 50,
      },
      {
        agentId: leader,
        status: "approved" as const,
        invoiceStatus: "collected" as const,
        sharePercent: 100,
      },
    ];
    const agentCount = appraisalContribution(deals, agent);
    const leaderResult = appraisalResult({
      agentId: leader,
      designation: "Sales Manager",
      monthlyBasic: 80_000,
      deals,
    });
    expect(agentCount.countedUnits).toBe(0.5);
    expect(agentCount.countedSales).toBe(0.5);
    expect(leaderResult.countedUnits).toBe(1);
    expect(leaderResult.eligible).toBe(false);
  });

  it("does not map an unknown designation", () => {
    const result = appraisalResult({
      agentId: agent,
      designation: "Intern",
      monthlyBasic: 20_000,
      deals: [],
    });
    expect(result.mapped).toBe(false);
    expect(result.hikeAmount).toBe(0);
  });
});
