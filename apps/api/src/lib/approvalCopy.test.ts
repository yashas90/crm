import { formatINR } from "@propninja/types/money";
import { describe, expect, it } from "vitest";
import {
  incentiveApprovedMessage,
  incentiveRejectedMessage,
  monthlyIncentiveAdminMessage,
  staleIncentiveReminder,
} from "./approvalCopy.js";

describe("approval copy", () => {
  it("formats incentive amounts in Indian rupees", () => {
    const message = incentiveApprovedMessage({
      total: 1_000_000,
      cash: 800_000,
      esop: 200_000,
      quarterName: "JAS 2026",
    });
    expect(message).toContain(formatINR(1_000_000));
    expect(message).toContain("JAS 2026");
    expect(message).not.toContain("1,000,000");
  });

  it("requires the admin reason in a rejection", () => {
    const message = incentiveRejectedMessage({ monthKey: "2026-09", reason: "NR not collected" });
    expect(message).toContain("September 2026");
    expect(message).toContain("NR not collected");
    expect(message).toContain("Contact HR");
  });

  it("tells the admin how many employees are eligible", () => {
    const message = monthlyIncentiveAdminMessage({
      monthKey: "2026-09",
      eligibleEmployees: 4,
      totalPayout: 500_000,
    });
    expect(message).toContain("4 employees eligible");
    expect(message).toContain(formatINR(500_000));
    expect(staleIncentiveReminder(3)).toContain("3 incentive approvals pending");
  });
});
