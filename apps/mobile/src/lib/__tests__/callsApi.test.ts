import { mapCallRecordToLogItem } from "@/lib/callsApi";
import { describe, expect, it } from "@jest/globals";

describe("mapCallRecordToLogItem", () => {
  it("maps API call records to mobile list items", () => {
    const item = mapCallRecordToLogItem({
      id: "call-1",
      leadId: "lead-1",
      phoneNumber: "+919876543210",
      outcome: "answered",
      durationSeconds: 125,
      notes: "Interested",
      startedAt: "2026-06-16T10:00:00.000Z",
      userName: "Agent One",
      lead: { firstName: "Jane", lastName: "Doe" },
    });

    expect(item).toMatchObject({
      id: "call-1",
      leadId: "lead-1",
      leadName: "Jane Doe",
      phone: "+919876543210",
      outcome: "answered",
      duration: 2,
      durationSeconds: 125,
      notes: "Interested",
      calledAt: "2026-06-16T10:00:00.000Z",
      agentName: "Agent One",
    });
  });
});
