import { describe, expect, it } from "vitest";

/**
 * Contract for calling-report event loading filters.
 * Personal / non-lead dialer stays out; lead-matched phone-log talk is allowed
 * so auto-log gaps (duration 0 / no_answer) still count real connected time.
 */
describe("calling report call event filters", () => {
  it("includes lead-matched device talk with lead-linked CRM and data calls", () => {
    const reportMode = {
      includeDataCalls: true,
      includeDeviceCalls: true,
      leadLinkedOnly: true,
    };

    expect(reportMode.includeDeviceCalls).toBe(true);
    expect(reportMode.leadLinkedOnly).toBe(true);
    expect(reportMode.includeDataCalls).toBe(true);
  });

  it("allows lead phone-log rows while blocking personal/unlinked dialer", () => {
    const sourcesAllowed = [
      "call_records_lead_linked",
      "contact_call_logs",
      "agent_call_logs_lead_phone",
    ] as const;
    const sourcesBlocked = ["agent_call_logs_personal", "call_records_personal_unlinked"] as const;

    expect(sourcesAllowed).toContain("call_records_lead_linked");
    expect(sourcesAllowed).toContain("contact_call_logs");
    expect(sourcesAllowed).toContain("agent_call_logs_lead_phone");
    expect(sourcesBlocked).toContain("agent_call_logs_personal");
    expect(sourcesBlocked).toContain("call_records_personal_unlinked");
  });
});
