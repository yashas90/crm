import { describe, expect, it } from "vitest";
import {
  type IncentiveDeal,
  slabIncentive,
  splitEsop,
  summarizeAgentIncentive,
} from "./incentiveMath.js";

const basic = 100_000;

function deal(
  overrides: Partial<IncentiveDeal> & Pick<IncentiveDeal, "id" | "shares">,
): IncentiveDeal {
  return {
    tcfCode: overrides.id,
    status: "approved",
    invoiceStatus: "collected",
    netRevenue: 0,
    convertible: false,
    ...overrides,
  };
}

describe("slabIncentive", () => {
  it("pays nothing at or below the eligibility target", () => {
    const atTarget = slabIncentive({
      achievedNr: basic * 5,
      monthlyBasic: basic,
      multiplier: 5,
      tillRate: 0.05,
      aboveRate: 0.15,
    });
    expect(atTarget.incentive).toBe(0);
    expect(atTarget.eligibilityTarget).toBe(500_000);
  });

  it("pays the above-target percent only on the excess", () => {
    const result = slabIncentive({
      achievedNr: 600_000,
      monthlyBasic: basic,
      multiplier: 5,
      tillRate: 0.05,
      aboveRate: 0.15,
    });
    expect(result.incentive).toBe(15_000);
    expect(result.aboveIncentive).toBe(15_000);
    expect(result.tillIncentive).toBe(0);
    const split = splitEsop(result.incentive);
    expect(split.esop).toBe(3_000);
    expect(split.cash).toBe(12_000);
  });

  it("uses the base percent for convertible excess", () => {
    const result = slabIncentive({
      achievedNr: 600_000,
      convertibleNr: 600_000,
      monthlyBasic: basic,
      multiplier: 5,
      tillRate: 0.05,
      aboveRate: 0.15,
    });
    expect(result.incentive).toBe(5_000);
    expect(result.tillIncentive).toBe(5_000);
    expect(result.aboveIncentive).toBe(0);
  });
});

describe("summarizeAgentIncentive", () => {
  it("ignores a TCF that is not admin-approved", () => {
    const payout = summarizeAgentIncentive({
      agentId: "agent",
      band: "NE",
      monthlyBasic: basic,
      deals: [
        deal({
          id: "draft",
          status: "pending_approval",
          netRevenue: 2_000_000,
          shares: [{ userId: "agent", sharePercent: 100 }],
        }),
      ],
    });
    expect(payout.countedSelfNr).toBe(0);
    expect(payout.earned).toBe(0);
    expect(payout.provisional).toBe(0);
    expect(payout.due).toBe(0);
  });

  it("keeps an approved but uncollected deal provisional", () => {
    const payout = summarizeAgentIncentive({
      agentId: "agent",
      band: "NE",
      monthlyBasic: basic,
      deals: [
        deal({
          id: "open",
          invoiceStatus: "raised",
          netRevenue: 600_000,
          shares: [{ userId: "agent", sharePercent: 100 }],
        }),
      ],
    });
    expect(payout.countedSelfNr).toBe(600_000);
    expect(payout.confirmSelfNr).toBe(0);
    expect(payout.provisional).toBe(15_000);
    expect(payout.earned).toBe(0);
    expect(payout.due).toBe(0);
  });

  it("excludes a shared deal from a leader's self-business incentive", () => {
    const payout = summarizeAgentIncentive({
      agentId: "leader",
      band: "N1",
      monthlyBasic: basic,
      deals: [
        deal({
          id: "shared",
          netRevenue: 1_000_000,
          shares: [
            { userId: "leader", sharePercent: 50 },
            { userId: "agent", sharePercent: 50 },
          ],
        }),
      ],
    });
    expect(payout.countedSelfNr).toBe(500_000);
    expect(payout.earned).toBe(0);
    expect(payout.deals[0]?.exclusive).toBe(false);
  });

  it("earns the excess once the invoice is collected", () => {
    const payout = summarizeAgentIncentive({
      agentId: "agent",
      band: "N0",
      monthlyBasic: basic,
      deals: [
        deal({
          id: "won",
          netRevenue: 600_000,
          shares: [{ userId: "agent", sharePercent: 100 }],
        }),
      ],
    });
    expect(payout.earned).toBe(15_000);
    expect(payout.esop).toBe(3_000);
    expect(payout.cash).toBe(12_000);
    expect(payout.due).toBe(15_000);
    expect(payout.provisional).toBe(0);
  });
});
