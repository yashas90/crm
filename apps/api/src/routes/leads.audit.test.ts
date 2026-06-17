import { beforeEach, describe, expect, it, vi } from "vitest";

const auditMocks = vi.hoisted(() => ({
  auditFromContext: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/auditService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/auditService.js")>();
  return {
    ...actual,
    auditFromContext: auditMocks.auditFromContext,
  };
});

vi.mock("../services/leadService.js", () => ({
  leadService: {
    createLead: vi.fn().mockResolvedValue({
      id: "lead-new",
      firstName: "Ravi",
      lastName: "Kumar",
      phone: "+911234567890",
      leadStatus: "new",
    }),
    getLeadById: vi.fn(),
    updateLead: vi.fn(),
    softDeleteLead: vi.fn(),
    assignLead: vi.fn(),
  },
  LeadDuplicatePhoneError: class LeadDuplicatePhoneError extends Error {
    code = "LEAD_DUPLICATE_PHONE";
  },
}));

vi.mock("../services/leadAssignmentService.js", () => ({
  getAssignmentHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock("../services/notificationService.js", () => ({
  NOTIFICATION_TYPES: { LEAD_ASSIGNED: "lead_assigned" },
  createNotificationService: () => ({ createNotification: vi.fn() }),
}));

vi.mock("../services/documentService.js", () => ({
  documentService: { listLeadDocuments: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../services/whatsappService.js", () => ({
  whatsappService: { listMessagesForLead: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../middleware/rateLimit.js", () => ({
  leadsCreateRateLimit: async (_c: unknown, next: () => Promise<void>) => next(),
  leadsPatchRateLimit: async (_c: unknown, next: () => Promise<void>) => next(),
}));

describe("lead routes audit logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function leadsApp(role: "admin" | "agent" = "admin") {
    const { Hono } = await import("hono");
    const { leadsRoute } = await import("../routes/leads.js");
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("db", {});
      c.set("authUser", {
        id: "actor-1",
        role,
        email: "actor@test.com",
        name: "Actor",
      });
      await next();
    });
    app.route("/api/leads", leadsRoute);
    return app;
  }

  it("writes LEAD_CREATED audit on POST /api/leads", async () => {
    const app = await leadsApp();
    const res = await app.request("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.4" },
      body: JSON.stringify({
        firstName: "Ravi",
        lastName: "Kumar",
        phone: "+911234567890",
      }),
    });

    expect(res.status).toBe(201);
    expect(auditMocks.auditFromContext).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        action: "LEAD_CREATED",
        entityType: "lead",
        entityId: "lead-new",
        entityName: "Ravi Kumar",
      }),
    );
  });
});
