import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendTemplateMessage = vi.fn();
const listActiveTemplates = vi.fn();

vi.mock("../services/whatsappService.js", () => ({
  whatsappService: {
    isConfigured: () => true,
    listActiveTemplates,
    listAllTemplates: vi.fn(),
    syncTemplatesFromMeta: vi.fn(),
    sendTemplateMessage,
    listLeadMessages: vi.fn(),
    applyStatusUpdates: vi.fn(),
  },
}));

vi.mock("../services/leadService.js", () => ({
  leadService: {
    getLeadById: vi.fn().mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000099",
      assignedTo: "00000000-0000-4000-8000-000000000001",
    }),
  },
  LeadDuplicatePhoneError: class LeadDuplicatePhoneError extends Error {},
}));

const agentUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "agent@demo.test",
  name: "Agent",
  role: "agent" as const,
};

describe("POST /api/whatsapp/send", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { whatsappRoute } = await import("../routes/whatsapp.js");
    app = new Hono();
    app.use("*", async (c, next) => {
      c.set("authUser", agentUser);
      await next();
    });
    app.route("/api/whatsapp", whatsappRoute);
  });

  it("sends a template message for an assigned lead", async () => {
    sendTemplateMessage.mockResolvedValue({
      id: "msg-1",
      status: "sent",
      waMessageId: "wamid.abc",
    });
    listActiveTemplates.mockResolvedValue([]);

    const res = await app.request("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: "00000000-0000-4000-8000-000000000099",
        templateId: "00000000-0000-4000-8000-000000000010",
        variables: { property: "Sunrise Heights" },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(sendTemplateMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: "00000000-0000-4000-8000-000000000099",
        sentBy: agentUser.id,
      }),
    );
  });
});
