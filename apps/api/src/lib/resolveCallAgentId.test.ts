import { describe, expect, it, vi } from "vitest";
import { resolveCallAgentId } from "../lib/resolveCallAgentId.js";

const agentUser = {
  id: "00000000-0000-0000-0000-000000000001",
  role: "agent" as const,
  email: "agent@test.com",
  name: "Agent",
};

const adminUser = {
  id: "00000000-0000-0000-0000-000000000002",
  role: "admin" as const,
  email: "admin@test.com",
  name: "Admin",
};

describe("resolveCallAgentId", () => {
  it("always returns the agent's own id for agent role", () => {
    expect(
      resolveCallAgentId(agentUser, {
        agentId: "00000000-0000-0000-0000-000000000099",
      }),
    ).toBe(agentUser.id);
  });

  it("returns auth user id when manager passes agentId=me", () => {
    expect(resolveCallAgentId(adminUser, { agentId: "me" })).toBe(adminUser.id);
  });

  it("returns specific agent uuid for manager/admin", () => {
    const other = "00000000-0000-4000-8000-000000000099";
    expect(resolveCallAgentId(adminUser, { agentId: other })).toBe(other);
  });

  it("returns undefined for manager when agentId omitted (all calls)", () => {
    expect(resolveCallAgentId(adminUser, {})).toBeUndefined();
  });
});
