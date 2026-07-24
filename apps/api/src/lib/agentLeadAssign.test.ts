import { beforeEach, describe, expect, it, vi } from "vitest";

const { limit, where, from, select } = vi.hoisted(() => {
  const limitFn = vi.fn();
  const whereFn = vi.fn(() => ({ limit: limitFn }));
  const fromFn = vi.fn(() => ({ where: whereFn }));
  const selectFn = vi.fn(() => ({ from: fromFn }));
  return { limit: limitFn, where: whereFn, from: fromFn, select: selectFn };
});

vi.mock("./db.js", () => ({
  db: { select },
}));

vi.mock("@propninja/db", () => ({
  users: { id: "id", role: "role", isActive: "isActive", orgId: "orgId" },
}));

import { assertAgentAssigneeAllowed, assertAgentAssigneesAllowed } from "./agentLeadAssign.js";

const agent = {
  id: "agent-1",
  role: "agent" as const,
  name: "Agent",
  email: "a@x.com",
  orgId: "org",
};
const manager = {
  id: "mgr-1",
  role: "manager" as const,
  name: "Manager",
  email: "m@x.com",
  orgId: "org",
};

describe("assertAgentAssigneeAllowed", () => {
  beforeEach(() => {
    limit.mockReset();
    where.mockClear();
    from.mockClear();
    select.mockClear();
  });

  it("allows managers any assignee without DB lookup", async () => {
    await expect(assertAgentAssigneeAllowed(manager, "anyone")).resolves.toEqual({ ok: true });
    expect(select).not.toHaveBeenCalled();
  });

  it("allows agents to keep the lead on themselves", async () => {
    await expect(assertAgentAssigneeAllowed(agent, agent.id)).resolves.toEqual({ ok: true });
    expect(select).not.toHaveBeenCalled();
  });

  it("allows agents to assign to an active admin", async () => {
    limit.mockResolvedValueOnce([{ role: "admin", isActive: true }]);
    await expect(assertAgentAssigneeAllowed(agent, "admin-1")).resolves.toEqual({ ok: true });
  });

  it("rejects agents assigning to a non-admin", async () => {
    limit.mockResolvedValueOnce([{ role: "agent", isActive: true }]);
    await expect(assertAgentAssigneeAllowed(agent, "other-agent")).resolves.toMatchObject({
      ok: false,
    });
  });

  it("rejects inactive admins", async () => {
    limit.mockResolvedValueOnce([{ role: "admin", isActive: false }]);
    await expect(assertAgentAssigneeAllowed(agent, "admin-1")).resolves.toMatchObject({
      ok: false,
    });
  });

  it("checks every assignee in a bulk list", async () => {
    limit
      .mockResolvedValueOnce([{ role: "admin", isActive: true }])
      .mockResolvedValueOnce([{ role: "manager", isActive: true }]);
    await expect(assertAgentAssigneesAllowed(agent, ["admin-1", "mgr-1"])).resolves.toMatchObject({
      ok: false,
    });
  });
});
