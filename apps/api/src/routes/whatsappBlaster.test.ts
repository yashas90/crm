import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/whatsappBlasterService.js", () => ({
  whatsappBlasterService: {
    providerInfo: () => ({ provider: "meta", configured: true, label: "WhatsApp Business API" }),
    listCampaigns: vi.fn().mockResolvedValue([]),
  },
}));

const adminUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "admin@demo.test",
  name: "Admin",
  role: "admin" as const,
};

const agentUser = {
  ...adminUser,
  id: "00000000-0000-4000-8000-000000000002",
  email: "agent@demo.test",
  name: "Agent",
  role: "agent" as const,
};

const managerUser = {
  ...adminUser,
  id: "00000000-0000-4000-8000-000000000003",
  email: "manager@demo.test",
  name: "Manager",
  role: "manager" as const,
};

describe("WhatsApp Blaster admin-only routes", () => {
  async function mount(user: typeof adminUser | typeof agentUser | typeof managerUser) {
    const { whatsappBlasterRoute } = await import("./whatsappBlaster.js");
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("authUser", user);
      await next();
    });
    app.route("/api/whatsapp/blaster", whatsappBlasterRoute);
    return app;
  }

  beforeEach(() => {
    vi.resetModules();
  });

  it("allows admins to read campaigns", async () => {
    const app = await mount(adminUser);
    const res = await app.request("/api/whatsapp/blaster/campaigns");
    expect(res.status).toBe(200);
  });

  it("rejects agents", async () => {
    const app = await mount(agentUser);
    const res = await app.request("/api/whatsapp/blaster/campaigns");
    expect(res.status).toBe(403);
  });

  it("rejects managers", async () => {
    const app = await mount(managerUser);
    const res = await app.request("/api/whatsapp/blaster/campaigns");
    expect(res.status).toBe(403);
  });
});
