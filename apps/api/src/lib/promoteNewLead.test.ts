import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const returning = vi.fn();
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const insertValues = vi.fn(async () => undefined);
  const insert = vi.fn(() => ({ values: insertValues }));

  return { returning, where, set, update, insert, insertValues };
});

vi.mock("./db.js", () => ({
  db: {
    update: mocks.update,
    insert: mocks.insert,
  },
}));

describe("promoteNewLeadToContacted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when lead is not new", async () => {
    mocks.returning.mockResolvedValueOnce([]);
    const { promoteNewLeadToContacted } = await import("./promoteNewLead.js");

    await expect(
      promoteNewLeadToContacted("lead-1", { userId: "user-1", reason: "call_logged" }),
    ).resolves.toBe(false);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("promotes new lead and logs status_change when userId provided", async () => {
    mocks.returning.mockResolvedValueOnce([{ id: "lead-1" }]);
    const { promoteNewLeadToContacted } = await import("./promoteNewLead.js");

    await expect(
      promoteNewLeadToContacted("lead-1", { userId: "user-1", reason: "call_logged" }),
    ).resolves.toBe(true);

    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        leadStatus: "contacted",
      }),
    );
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: "lead-1",
        userId: "user-1",
        type: "status_change",
        metadata: expect.objectContaining({
          from: "new",
          to: "contacted",
          reason: "call_logged",
          auto: true,
        }),
      }),
    );
  });
});
