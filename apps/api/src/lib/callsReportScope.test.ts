import { describe, expect, it } from "vitest";
import { resolveCallsReportUserScope } from "./callsReportScope.js";

const manager = { id: "manager-1", role: "manager" as const };
const agent = { id: "agent-1", role: "agent" as const };
const admin = { id: "admin-1", role: "admin" as const };

const team = ["manager-1", "agent-a", "agent-b"];

describe("resolveCallsReportUserScope", () => {
  it("forces agents to their own id", () => {
    expect(
      resolveCallsReportUserScope({
        viewer: agent,
        canViewAllReports: false,
        teamUserIds: team,
        userId: "someone-else",
      }),
    ).toEqual({ userId: undefined, userIds: ["agent-1"] });
  });

  it("scopes managers to their team when no user filter is set", () => {
    expect(
      resolveCallsReportUserScope({
        viewer: manager,
        canViewAllReports: false,
        teamUserIds: team,
      }),
    ).toEqual({ userId: undefined, userIds: team });
  });

  it("keeps manager user filters that belong to the team", () => {
    expect(
      resolveCallsReportUserScope({
        viewer: manager,
        canViewAllReports: false,
        teamUserIds: team,
        userIds: ["agent-a"],
      }),
    ).toEqual({ userId: undefined, userIds: ["agent-a"] });
  });

  it("rejects manager user filters outside the team", () => {
    expect(
      resolveCallsReportUserScope({
        viewer: manager,
        canViewAllReports: false,
        teamUserIds: team,
        userIds: ["other-org-agent"],
      }),
    ).toEqual({ forbidden: "User filter is outside your team" });
  });

  it("does not restrict admins with org-wide report access", () => {
    expect(
      resolveCallsReportUserScope({
        viewer: admin,
        canViewAllReports: true,
        teamUserIds: [],
      }),
    ).toEqual({ userId: undefined, userIds: undefined });
  });
});
