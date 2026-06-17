import { describe, expect, it } from "vitest";
import { canAccessCall, canAccessTask } from "./resourceScope.js";

const orgId = "00000000-0000-0000-0000-000000000001";

const agent = {
  id: "agent-1",
  orgId,
  role: "agent" as const,
  email: "a@test.com",
  name: "Agent",
};

const manager = { ...agent, id: "mgr-1", role: "manager" as const };

describe("resourceScope", () => {
  it("allows agent to access own task", () => {
    expect(canAccessTask(agent, { orgId, assignedTo: agent.id })).toBe(true);
  });

  it("denies agent access to another assignee task", () => {
    expect(canAccessTask(agent, { orgId, assignedTo: "other" })).toBe(false);
  });

  it("allows manager to access any org task", () => {
    expect(canAccessTask(manager, { orgId, assignedTo: "other" })).toBe(true);
  });

  it("denies cross-org call access", () => {
    expect(canAccessCall(agent, { orgId: "other-org", userId: agent.id })).toBe(false);
  });
});
