import { getIstDateKey, istWallClockToDate } from "@propninja/types/ist";
import { describe, expect, it } from "vitest";
import {
  aggregateCombinedCalls,
  classifyDataCall,
  classifyDeviceCall,
  classifyLeadCall,
} from "./combinedCallStats.js";

const agentId = "agent-poornesh";

describe("combined call stats", () => {
  it("counts a lead call and a data call on the same IST day, and sums talk time", () => {
    const morning = istWallClockToDate("2026-10-15", 9, 15);
    const evening = istWallClockToDate("2026-10-15", 21, 40);
    expect(getIstDateKey(morning)).toBe("2026-10-15");
    expect(getIstDateKey(evening)).toBe("2026-10-15");

    const lead = classifyLeadCall({
      userId: agentId,
      phone: "+91 98765 43210",
      startedAt: morning,
      direction: "outgoing",
      status: "completed",
      outcome: "answered",
      disposition: "answered",
      durationSeconds: 40,
    });
    const data = classifyDataCall({
      userId: agentId,
      phone: "9123456780",
      calledAt: evening,
      outcome: "interested",
      durationSeconds: 25,
    });

    const stats = aggregateCombinedCalls([lead, data]).byUser.get(agentId);

    expect(stats?.totalCalls).toBe(2);
    expect(stats?.outgoingAnswered).toBe(2);
    expect(stats?.outgoingTotal).toBe(2);
    expect(stats?.connected).toBe(2);
    expect(stats?.totalTalkTimeSeconds).toBe(65);
    expect(stats?.totalDurationSeconds).toBe(65);
    expect(stats?.outgoingDurationSeconds).toBe(65);
  });

  it("counts one phone event once when lead, data, and device logs match", () => {
    const started = istWallClockToDate("2026-10-15", 11, 0);
    const lead = classifyLeadCall({
      userId: agentId,
      phone: "9876543210",
      startedAt: started,
      direction: "outgoing",
      status: "completed",
      outcome: "answered",
      disposition: "answered",
      durationSeconds: 40,
    });
    const data = classifyDataCall({
      userId: agentId,
      phone: "+91-98765-43210",
      calledAt: new Date(started.getTime() + 30_000),
      outcome: "interested",
      durationSeconds: 0,
    });
    const device = classifyDeviceCall({
      userId: agentId,
      phone: "09876543210",
      callType: "OUTGOING",
      startedAt: new Date(started.getTime() + 20_000),
      durationSeconds: 45,
    });

    const stats = aggregateCombinedCalls([lead, data, device]).byUser.get(agentId);

    expect(stats?.totalCalls).toBe(1);
    expect(stats?.outgoingAnswered).toBe(1);
    expect(stats?.totalTalkTimeSeconds).toBe(45);
    expect(stats?.connected).toBe(1);
  });

  it("keeps incoming calls and does not drop them beside an outgoing call", () => {
    const started = istWallClockToDate("2026-10-15", 14, 5);
    const outgoing = classifyLeadCall({
      userId: agentId,
      phone: "9876543210",
      startedAt: started,
      direction: "outgoing",
      status: "completed",
      outcome: "answered",
      disposition: "answered",
      durationSeconds: 12,
    });
    const incoming = classifyDeviceCall({
      userId: agentId,
      phone: "9000000001",
      callType: "INCOMING",
      startedAt: new Date(started.getTime() + 15_000),
      durationSeconds: 18,
    });
    const missed = classifyDeviceCall({
      userId: agentId,
      phone: "9000000002",
      callType: "MISSED",
      startedAt: new Date(started.getTime() + 40_000),
      durationSeconds: 0,
    });
    const leadIncoming = classifyLeadCall({
      userId: agentId,
      phone: "9000000003",
      startedAt: new Date(started.getTime() + 50_000),
      direction: "incoming",
      status: "completed",
      outcome: "answered",
      disposition: "answered",
      durationSeconds: 7,
    });

    const stats = aggregateCombinedCalls([outgoing, incoming, missed, leadIncoming]).byUser.get(
      agentId,
    );

    expect(stats?.incomingTotal).toBe(3);
    expect(stats?.incomingAnswered).toBe(2);
    expect(stats?.incomingMissed).toBe(1);
    expect(stats?.incomingDurationSeconds).toBe(25);
    expect(stats?.outgoingTotal).toBe(1);
    expect(stats?.totalCalls).toBe(4);
    expect(stats?.totalTalkTimeSeconds).toBe(37);
  });
});
