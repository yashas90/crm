import { buildPerformanceShareText } from "@/lib/performanceShare";

describe("buildPerformanceShareText", () => {
  it("formats monthly performance summary", () => {
    const text = buildPerformanceShareText({
      today: {
        callsMade: 5,
        callsAnswered: 3,
        callsAnsweredPercent: 60,
        leadsContacted: 4,
        tasksCompleted: 2,
        newLeadsAssigned: 1,
        followUpsDone: 1,
      },
      thisMonth: {
        totalCalls: 42,
        answeredPercent: 78,
        avgCallDurationMinutes: 3,
        leadsConverted: 3,
        leadsAssigned: 10,
        leadsContacted: 8,
        leadsAssignedVsContactedRatio: 80,
        tasksCompleted: 12,
        tasksOverdue: 1,
        bestDay: null,
      },
      callsLast7Days: [],
      leaderboard: { rank: 2, totalAgents: 8, metric: "callsThisMonth", entries: [] },
    });

    expect(text).toContain("PropNinja Performance");
    expect(text).toContain("Calls: 42");
    expect(text).toContain("Answered: 78%");
    expect(text).toContain("Won: 3 leads");
  });
});
