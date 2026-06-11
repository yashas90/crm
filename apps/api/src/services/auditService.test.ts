import { describe, expect, it, vi } from "vitest";
import { logAudit } from "./auditService.js";

describe("logAudit", () => {
  it("inserts an audit row without throwing", async () => {
    const insert = vi.fn().mockResolvedValue(undefined);
    const db = {
      insert: vi.fn().mockReturnValue({ values: insert }),
    };

    await logAudit(db as never, {
      userId: "00000000-0000-0000-0000-000000000001",
      action: "LEAD_DELETED",
      entityType: "lead",
      entityId: "00000000-0000-0000-0000-0000000000aa",
      metadata: { name: "Test Lead" },
    });

    expect(db.insert).toHaveBeenCalledOnce();
    expect(insert).toHaveBeenCalledWith({
      userId: "00000000-0000-0000-0000-000000000001",
      action: "LEAD_DELETED",
      entityType: "lead",
      entityId: "00000000-0000-0000-0000-0000000000aa",
      metadata: { name: "Test Lead" },
    });
  });

  it("swallows insert errors so the main request is not blocked", async () => {
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error("db down")),
      }),
    };

    await expect(
      logAudit(db as never, {
        userId: "00000000-0000-0000-0000-000000000001",
        action: "PROJECT_CREATED",
        entityType: "project",
        entityId: "00000000-0000-0000-0000-0000000000bb",
      }),
    ).resolves.toBeUndefined();
  });
});
