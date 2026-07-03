import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getByToken = vi.fn();
const reschedule = vi.fn();
const cancel = vi.fn();

vi.mock("../services/siteVisitPublicService.js", () => ({
  siteVisitPublicService: { getByToken, reschedule, cancel },
  CustomerPortalActionError: class CustomerPortalActionError extends Error {
    constructor(
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

vi.mock("../middleware/rateLimit.js", () => ({
  writeRateLimit: async (_c: unknown, next: () => Promise<void>) => next(),
}));

describe("public site visits API", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { publicSiteVisitsRoutes } = await import("../routes/publicSiteVisits.js");
    app = new Hono();
    app.route("/api/public/site-visits", publicSiteVisitsRoutes);
  });

  const sample = {
    reference: "SV-2026-A1B2C3D4",
    status: "scheduled" as const,
    projectName: "Nikoo 9",
    unitLabel: null,
    tower: null,
    visitDate: "2026-07-12",
    visitTime: "11:00:00",
    duration: 60,
    customerFirstName: "Priya",
    agentName: "Rahul",
    agentPhone: "9876543210",
    mapsLink: null,
    meetingLocation: null,
    propertyLabel: null,
    canReschedule: true,
    canCancel: true,
  };

  it("GET returns public visit view", async () => {
    getByToken.mockResolvedValue(sample);
    const res = await app.request("/api/public/site-visits/SV-2026-A1B2C3D4");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.reference).toBe("SV-2026-A1B2C3D4");
  });

  it("POST reschedule updates visit", async () => {
    reschedule.mockResolvedValue({ ...sample, visitTime: "14:00:00" });
    const res = await app.request("/api/public/site-visits/SV-2026-A1B2C3D4/reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitDate: "2026-07-13", visitTime: "14:00" }),
    });
    expect(res.status).toBe(200);
    expect(reschedule).toHaveBeenCalled();
  });

  it("POST cancel cancels visit", async () => {
    cancel.mockResolvedValue({ ...sample, status: "cancelled", canCancel: false });
    const res = await app.request("/api/public/site-visits/SV-2026-A1B2C3D4/cancel", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    expect(cancel).toHaveBeenCalled();
  });
});
