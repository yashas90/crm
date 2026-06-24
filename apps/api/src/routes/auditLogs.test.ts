import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  list: vi.fn(),
  exportCsv: vi.fn(),
}));

vi.mock("../lib/permissions.js", () => ({
  isAdmin: mocks.isAdmin,
}));

vi.mock("../services/auditService.js", () => ({
  createAuditService: () => ({
    list: mocks.list,
    exportCsv: mocks.exportCsv,
  }),
}));

vi.mock("../middleware/auth.js", () => ({
  authMiddleware: async (
    c: { set: (k: string, v: unknown) => void },
    next: () => Promise<void>,
  ) => {
    c.set("authUser", {
      id: "user-1",
      role: "agent",
      email: "a@test.com",
      name: "Agent",
      orgId: "00000000-0000-0000-0000-0000000000aa",
      isFirstLogin: false,
    });
    await next();
  },
}));

describe("GET /api/audit-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue({ items: [], nextCursor: null });
  });

  async function appWithRoutes() {
    const { Hono } = await import("hono");
    const { auditLogsRoutes } = await import("../routes/auditLogs.js");
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("db", {});
      c.set("authUser", {
        id: "user-1",
        role: "agent",
        email: "a@test.com",
        name: "Agent",
        orgId: "00000000-0000-0000-0000-0000000000aa",
        isFirstLogin: false,
      });
      await next();
    });
    app.route("/api/audit-logs", auditLogsRoutes);
    return app;
  }

  it("returns 403 for non-admin users", async () => {
    mocks.isAdmin.mockReturnValue(false);
    const app = await appWithRoutes();
    const res = await app.request("/api/audit-logs");
    expect(res.status).toBe(403);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("returns audit log data for admins", async () => {
    mocks.isAdmin.mockReturnValue(true);
    mocks.list.mockResolvedValue({
      items: [
        {
          id: "log-1",
          userId: "admin-1",
          userName: "Admin",
          userEmail: "admin@test.com",
          action: "LEAD_CREATED",
          entityType: "lead",
          entityId: "lead-1",
          metadata: {},
          createdAt: new Date().toISOString(),
        },
      ],
      nextCursor: null,
    });

    const app = await appWithRoutes();
    const res = await app.request("/api/audit-logs?page=1&pageSize=50");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { items: unknown[] } };
    expect(body.ok).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(mocks.list).toHaveBeenCalledOnce();
  });
});
