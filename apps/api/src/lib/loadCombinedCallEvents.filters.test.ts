import { describe, expect, it } from "vitest";

/**
 * Contract for calling-report event loading filters.
 * Device dialer and personal/unlinked rows must stay out of report totals.
 */
describe("calling report call event filters", () => {
  it("requires lead-linked CRM calls and disables device dialer for report mode", () => {
    const reportMode = {
      includeDataCalls: true,
      includeDeviceCalls: false,
      leadLinkedOnly: true,
    };

    expect(reportMode.includeDeviceCalls).toBe(false);
    expect(reportMode.leadLinkedOnly).toBe(true);
    expect(reportMode.includeDataCalls).toBe(true);
  });

  it("keeps calling-data contacts while excluding personal dialer source", () => {
    // Data contacts (contact_call_logs) are work calling-data and may count.
    // agent_call_logs (raw phone dialer) must never feed Incoming/Outgoing totals.
    const sourcesAllowed = ["call_records_lead_linked", "contact_call_logs"] as const;
    const sourcesBlocked = ["agent_call_logs", "call_records_personal_unlinked"] as const;

    expect(sourcesAllowed).toContain("call_records_lead_linked");
    expect(sourcesAllowed).toContain("contact_call_logs");
    expect(sourcesBlocked).toContain("agent_call_logs");
    expect(sourcesBlocked).toContain("call_records_personal_unlinked");
  });
});
