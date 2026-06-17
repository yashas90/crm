import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

const applyStatusUpdates = vi.fn();

vi.mock("../services/whatsappService.js", () => ({
  whatsappService: {
    applyStatusUpdates,
  },
}));

describe("POST /api/integrations/whatsapp/webhook", () => {
  it("acknowledges status updates", async () => {
    applyStatusUpdates.mockResolvedValue(1);
    const { whatsappIntegrationsRoute } = await import("../routes/integrationsWhatsApp.js");
    const app = new Hono();
    app.route("/api/integrations/whatsapp", whatsappIntegrationsRoute);

    const res = await app.request("/api/integrations/whatsapp/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                field: "messages",
                value: {
                  statuses: [{ id: "wamid.abc", status: "read", timestamp: "1710000001" }],
                },
              },
            ],
          },
        ],
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("EVENT_RECEIVED");
    expect(applyStatusUpdates).toHaveBeenCalled();
  });
});
