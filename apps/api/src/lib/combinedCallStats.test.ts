import { CALL_CROSS_SOURCE_WINDOW_MS, MIN_TALK_SECONDS } from "@propninja/types/call-metrics";
import { getIstDateKey, istDateKeyBounds, istWallClockToDate } from "@propninja/types/ist";
import { describe, expect, it } from "vitest";
import {
  aggregateCombinedCalls,
  classifyDataCall,
  classifyDeviceCall,
  classifyLeadCall,
  sumCallCountTotals,
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
      calledAt: new Date(started.getTime() + 1_000),
      outcome: "interested",
      durationSeconds: 0,
    });
    const device = classifyDeviceCall({
      userId: agentId,
      phone: "09876543210",
      callType: "OUTGOING",
      startedAt: new Date(started.getTime() + 1_500),
      durationSeconds: 45,
    });

    const stats = aggregateCombinedCalls([lead, data, device]).byUser.get(agentId);

    expect(stats?.totalCalls).toBe(1);
    expect(stats?.outgoingAnswered).toBe(1);
    expect(stats?.totalTalkTimeSeconds).toBe(45);
    expect(stats?.connected).toBe(1);
  });

  it("counts one dial when the app log and the phone log are a ring apart", () => {
    const dialed = istWallClockToDate("2026-10-21", 11, 0);
    const device = classifyDeviceCall({
      userId: agentId,
      phone: "9876543210",
      callType: "OUTGOING",
      startedAt: dialed,
      durationSeconds: 40,
      callLogId: "os-200",
    });
    // App stamps talk-start: dial time plus ring, not the phone-log clock.
    const lead = classifyLeadCall({
      userId: agentId,
      phone: "+91 98765 43210",
      startedAt: new Date(dialed.getTime() + 45_000),
      direction: "outgoing",
      status: "completed",
      outcome: "answered",
      disposition: "answered",
      durationSeconds: 40,
    });
    const data = classifyDataCall({
      userId: agentId,
      phone: "09876543210",
      calledAt: new Date(dialed.getTime() + 50_000),
      outcome: "interested",
      durationSeconds: 40,
    });

    const stats = aggregateCombinedCalls([device, lead, data]).byUser.get(agentId);

    expect(stats?.totalCalls).toBe(1);
    expect(stats?.outgoingAnswered).toBe(1);
    expect(stats?.outgoingNotConnected).toBe(0);
    expect(stats?.totalTalkTimeSeconds).toBe(40);
  });

  it("keeps a redial as a second call when each attempt is on the phone log", () => {
    const first = istWallClockToDate("2026-10-21", 11, 5);
    const second = new Date(first.getTime() + 45_000);
    const missed = classifyDeviceCall({
      userId: agentId,
      phone: "9876543210",
      callType: "OUTGOING",
      startedAt: first,
      durationSeconds: 0,
      callLogId: "os-301",
    });
    const missedLog = classifyLeadCall({
      userId: agentId,
      phone: "9876543210",
      startedAt: new Date(first.getTime() + 20_000),
      direction: "outgoing",
      status: "missed",
      outcome: "no_answer",
      disposition: "no_answer",
      durationSeconds: 0,
    });
    const answered = classifyDeviceCall({
      userId: agentId,
      phone: "9876543210",
      callType: "OUTGOING",
      startedAt: second,
      durationSeconds: 18,
      callLogId: "os-302",
    });
    const answeredLog = classifyLeadCall({
      userId: agentId,
      phone: "9876543210",
      startedAt: new Date(second.getTime() + 12_000),
      direction: "outgoing",
      status: "completed",
      outcome: "answered",
      disposition: "answered",
      durationSeconds: 18,
    });

    const stats = aggregateCombinedCalls([missed, missedLog, answered, answeredLog]).byUser.get(
      agentId,
    );

    expect(stats?.totalCalls).toBe(2);
    expect(stats?.outgoingAnswered).toBe(1);
    expect(stats?.outgoingNotConnected).toBe(1);
    expect(stats?.totalTalkTimeSeconds).toBe(18);
  });

  it("counts one unanswered dial when the app log is written after the agent returns", () => {
    const dialed = istWallClockToDate("2026-10-22", 11, 0);
    const phone = classifyDeviceCall({
      userId: agentId,
      phone: "9876543210",
      callType: "OUTGOING",
      startedAt: dialed,
      durationSeconds: 0,
      callLogId: "os-500",
    });
    const returned = classifyLeadCall({
      userId: agentId,
      phone: "+91 98765 43210",
      startedAt: new Date(dialed.getTime() + 20 * 60 * 1000),
      direction: "outgoing",
      status: "missed",
      outcome: "no_answer",
      disposition: "no_answer",
      durationSeconds: 0,
    });

    const stats = aggregateCombinedCalls([phone, returned]).byUser.get(agentId);

    expect(stats?.totalCalls).toBe(1);
    expect(stats?.outgoingNotConnected).toBe(1);
    expect(stats?.outgoingAnswered).toBe(0);
  });

  it("keeps an app call that has no phone-log row, and a copy written after the match window", () => {
    const started = istWallClockToDate("2026-10-21", 12, 0);
    const web = classifyLeadCall({
      userId: agentId,
      phone: "9000001111",
      startedAt: started,
      direction: "outgoing",
      status: "completed",
      outcome: "answered",
      disposition: "answered",
      durationSeconds: 22,
    });
    const phoneOnly = classifyDeviceCall({
      userId: agentId,
      phone: "9000002222",
      callType: "MISSED",
      startedAt: new Date(started.getTime() + 30_000),
      durationSeconds: 0,
      callLogId: "os-400",
    });
    const sameCallLoggedOnReturn = classifyLeadCall({
      userId: agentId,
      phone: "9000002222",
      startedAt: new Date(phoneOnly.startedAtMs + 3 * 60 * 1000),
      direction: "incoming",
      status: "missed",
      outcome: "missed",
      disposition: "missed",
      durationSeconds: 0,
    });
    const loggedMuchLater = classifyLeadCall({
      userId: agentId,
      phone: "9000002222",
      startedAt: new Date(phoneOnly.startedAtMs + CALL_CROSS_SOURCE_WINDOW_MS + 60_000),
      direction: "incoming",
      status: "missed",
      outcome: "missed",
      disposition: "missed",
      durationSeconds: 0,
    });
    const earlierDeskCall = classifyLeadCall({
      userId: agentId,
      phone: "9000002222",
      startedAt: new Date(phoneOnly.startedAtMs - 60 * 60 * 1000),
      direction: "outgoing",
      status: "completed",
      outcome: "answered",
      disposition: "answered",
      durationSeconds: 15,
    });

    const stats = aggregateCombinedCalls([
      web,
      phoneOnly,
      sameCallLoggedOnReturn,
      loggedMuchLater,
      earlierDeskCall,
    ]).byUser.get(agentId);

    expect(stats?.totalCalls).toBe(4);
    expect(stats?.outgoingAnswered).toBe(2);
    expect(stats?.incomingMissed).toBe(2);
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

  it("counts the shared sample once and keeps the footer equal to the user rows", () => {
    expect(MIN_TALK_SECONDS).toBe(3);
    const start = istWallClockToDate("2026-10-16", 10, 0);
    const agentB = "agent-kesav";

    const oneSecond = classifyLeadCall({
      userId: agentId,
      phone: "9876543210",
      startedAt: start,
      direction: "outgoing",
      status: "completed",
      outcome: "answered",
      disposition: "answered",
      durationSeconds: 1,
    });
    const ringing = classifyLeadCall({
      userId: agentId,
      phone: "9876543213",
      startedAt: new Date(start.getTime() + 5_000),
      direction: "outgoing",
      status: "completed",
      outcome: "answered",
      disposition: "answered",
      durationSeconds: 2,
    });
    const noAnswer = classifyLeadCall({
      userId: agentId,
      phone: "9876543211",
      startedAt: new Date(start.getTime() + 60_000),
      direction: "outgoing",
      status: "missed",
      outcome: "no_answer",
      disposition: "no_answer",
      durationSeconds: 0,
    });
    const answered = classifyLeadCall({
      userId: agentId,
      phone: "9876543212",
      startedAt: new Date(start.getTime() + 120_000),
      direction: "outgoing",
      status: "completed",
      outcome: "answered",
      disposition: "answered",
      durationSeconds: 30,
    });
    const duplicate = classifyLeadCall({
      userId: agentId,
      phone: "+91 98765 43212",
      startedAt: new Date(answered.startedAtMs + 1_500),
      direction: "outgoing",
      status: "completed",
      outcome: "answered",
      disposition: "answered",
      durationSeconds: 30,
    });
    const device = classifyDeviceCall({
      userId: agentId,
      phone: "9000000099",
      callType: "OUTGOING",
      startedAt: new Date(start.getTime() + 300_000),
      durationSeconds: 40,
      callLogId: "os-100",
    });
    const deviceRetry = classifyDeviceCall({
      userId: agentId,
      phone: "9000000099",
      callType: "OUTGOING",
      startedAt: new Date(start.getTime() + 315_000),
      durationSeconds: 40,
      callLogId: "os-100",
    });
    const missed = classifyDeviceCall({
      userId: agentId,
      phone: "9000000002",
      callType: "MISSED",
      startedAt: new Date(start.getTime() + 400_000),
      durationSeconds: 0,
    });
    const otherAgent = classifyLeadCall({
      userId: agentB,
      phone: "9111111111",
      startedAt: start,
      direction: "outgoing",
      status: "completed",
      outcome: "answered",
      disposition: "answered",
      durationSeconds: 10,
    });

    const { byUser, totals } = aggregateCombinedCalls([
      oneSecond,
      ringing,
      noAnswer,
      answered,
      duplicate,
      device,
      deviceRetry,
      missed,
      otherAgent,
    ]);
    const poornesh = byUser.get(agentId);
    const kesav = byUser.get(agentB);

    expect(poornesh).toMatchObject({
      outgoingAnswered: 2,
      outgoingNotConnected: 3,
      outgoingTotal: 5,
      incomingAnswered: 0,
      incomingMissed: 1,
      incomingTotal: 1,
      totalCalls: 6,
      totalTalkTimeSeconds: 70,
      avgTalkTimeSeconds: 35,
      minTalkTimeSeconds: 30,
      maxTalkTimeSeconds: 40,
    });
    expect(kesav).toMatchObject({
      outgoingAnswered: 1,
      outgoingTotal: 1,
      totalCalls: 1,
      totalTalkTimeSeconds: 10,
      avgTalkTimeSeconds: 10,
    });

    const footer = sumCallCountTotals([poornesh!, kesav!]);
    expect(footer.incomingAnswered).toBe(totals.incomingAnswered);
    expect(footer.incomingMissed).toBe(totals.incomingMissed);
    expect(footer.incomingTotal).toBe(footer.incomingAnswered + footer.incomingMissed);
    expect(footer.outgoingAnswered).toBe(totals.outgoingAnswered);
    expect(footer.outgoingNotConnected).toBe(totals.outgoingNotConnected);
    expect(footer.outgoingTotal).toBe(footer.outgoingAnswered + footer.outgoingNotConnected);
    expect(footer.totalCalls).toBe(footer.incomingTotal + footer.outgoingTotal);
    expect(footer.totalCalls).toBe(7);
    expect(footer.totalTalkTimeSeconds).toBe(80);
    expect(footer.avgTalkTimeSeconds).toBe(
      Math.round(footer.totalTalkTimeSeconds / (footer.incomingAnswered + footer.outgoingAnswered)),
    );
    expect(footer.minTalkTimeSeconds).toBe(10);
    expect(footer.maxTalkTimeSeconds).toBe(40);

    const day = istDateKeyBounds("2026-10-16");
    const justBefore = new Date("2026-10-15T18:29:59.000Z");
    const justAfterMidnight = new Date("2026-10-15T18:30:01.000Z");
    const endOfDay = new Date("2026-10-16T18:29:59.000Z");
    expect(justBefore.getTime()).toBeLessThan(day.start.getTime());
    expect(justAfterMidnight.getTime()).toBeGreaterThanOrEqual(day.start.getTime());
    expect(justAfterMidnight.getTime()).toBeLessThanOrEqual(day.end.getTime());
    expect(endOfDay.getTime()).toBeLessThanOrEqual(day.end.getTime());
    expect(getIstDateKey(justBefore)).toBe("2026-10-15");
    expect(getIstDateKey(justAfterMidnight)).toBe("2026-10-16");
    expect(getIstDateKey(endOfDay)).toBe("2026-10-16");
  });
});
