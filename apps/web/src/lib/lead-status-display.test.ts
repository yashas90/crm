import { getLeadStatusDisplay } from "@/lib/lead-status-display";
import { describe, expect, it } from "vitest";

describe("getLeadStatusDisplay", () => {
  it("maps new status with violet styling", () => {
    const result = getLeadStatusDisplay({ leadStatus: "new" });
    expect(result.primary).toBe("New");
    expect(result.primaryClass).toContain("violet");
  });

  it("shows callback substatus from follow-up", () => {
    const result = getLeadStatusDisplay({
      leadStatus: "contacted",
      nextFollowupAt: "2026-06-10T10:00:00.000Z",
    });
    expect(result.primary).toBe("Pending");
    expect(result.secondary).toBe("Callback");
  });

  it("shows not interested from tags", () => {
    const result = getLeadStatusDisplay({
      leadStatus: "contacted",
      tags: ["not_interested"],
    });
    expect(result.primary).toBe("Not Interested");
  });
});
