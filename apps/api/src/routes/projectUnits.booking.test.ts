import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpdateUnit = vi.fn();
const mockGenerateForBookedUnit = vi.fn();
const mockGetSignedDownloadUrl = vi.fn();

vi.mock("../services/projectUnitService.js", () => ({
  createProjectUnitService: () => ({
    listUnits: vi.fn(),
    getUnitSummary: vi.fn(),
    createUnits: vi.fn(),
    updateUnit: mockUpdateUnit,
    deleteUnit: vi.fn(),
    exportCsv: vi.fn(),
  }),
}));

vi.mock("../services/bookingDocumentService.js", () => ({
  createBookingDocumentService: () => ({
    generateForBookedUnit: mockGenerateForBookedUnit,
    getSignedDownloadUrl: mockGetSignedDownloadUrl,
    getLatestForUnit: vi.fn(),
    getBookingPdfAccessContext: vi.fn().mockResolvedValue({
      agentId: null,
      leadAssignedTo: null,
    }),
  }),
}));

vi.mock("../middleware/rateLimit.js", () => ({
  writeRateLimit: async (_c: unknown, next: () => Promise<void>) => next(),
}));

const adminUser = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "admin@propninja.local",
  name: "Admin",
  role: "admin" as const,
};

const agentUser = {
  id: "00000000-0000-0000-0000-000000000003",
  email: "agent1@demo.propninja",
  name: "Agent One",
  role: "agent" as const,
};

const projectId = "11111111-1111-4111-8111-111111111111";
const unitId = "22222222-2222-4222-8222-222222222222";
const leadId = "33333333-3333-4333-8333-333333333333";

function buildApp(user: typeof adminUser) {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("authUser", user);
    c.set("db", {} as never);
    await next();
  });
  return app;
}

describe("project unit booking PDF routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateForBookedUnit.mockResolvedValue({
      id: "doc-1",
      unitId,
      leadId,
      agentId: adminUser.id,
      fileKey: `bookings/${projectId}/${unitId}-booking-2026-06-16.pdf`,
      fileUrl: "https://cdn.example/bookings/test.pdf",
      bookingRef: "BOOK-2026-222222",
      generatedAt: new Date("2026-06-16T12:00:00.000Z"),
    });
    mockGetSignedDownloadUrl.mockResolvedValue({
      signedUrl: "https://signed.example/booking.pdf",
      expiresInSeconds: 3600,
      bookingRef: "BOOK-2026-222222",
      generatedAt: "2026-06-16T12:00:00.000Z",
    });
  });

  it("PATCH unit to booked triggers PDF generation", async () => {
    mockUpdateUnit.mockResolvedValue({
      id: unitId,
      projectId,
      unitNumber: "101",
      status: "booked",
      transitionedToBooked: true,
    });

    const { projectsRoutes } = await import("./projects.js");
    const app = buildApp(adminUser);
    app.route("/api/projects", projectsRoutes);

    const res = await app.request(`/api/projects/${projectId}/units/${unitId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "booked" }),
    });

    expect(res.status).toBe(200);
    expect(mockGenerateForBookedUnit).toHaveBeenCalledWith({
      projectId,
      unitId,
      actorUserId: adminUser.id,
    });

    const body = (await res.json()) as {
      data: { bookingDocument: { fileKey: string; bookingRef: string } };
    };
    expect(body.data.bookingDocument.fileKey).toBe(
      `bookings/${projectId}/${unitId}-booking-2026-06-16.pdf`,
    );
    expect(body.data.bookingDocument.bookingRef).toBe("BOOK-2026-222222");
  });

  it("does not generate PDF when unit was already booked", async () => {
    mockUpdateUnit.mockResolvedValue({
      id: unitId,
      status: "booked",
      transitionedToBooked: false,
    });

    const { projectsRoutes } = await import("./projects.js");
    const app = buildApp(adminUser);
    app.route("/api/projects", projectsRoutes);

    const res = await app.request(`/api/projects/${projectId}/units/${unitId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Updated note" }),
    });

    expect(res.status).toBe(200);
    expect(mockGenerateForBookedUnit).not.toHaveBeenCalled();
  });

  it("GET booking-pdf returns signed URL for admin", async () => {
    const { projectsRoutes } = await import("./projects.js");
    const app = buildApp(adminUser);
    app.route("/api/projects", projectsRoutes);

    const res = await app.request(`/api/projects/${projectId}/units/${unitId}/booking-pdf`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { signedUrl: string } };
    expect(body.data.signedUrl).toBe("https://signed.example/booking.pdf");
    expect(mockGetSignedDownloadUrl).toHaveBeenCalledWith(projectId, unitId);
  });

  it("GET booking-pdf rejects agents without access", async () => {
    const { projectsRoutes } = await import("./projects.js");
    const app = buildApp(agentUser);
    app.route("/api/projects", projectsRoutes);

    const res = await app.request(`/api/projects/${projectId}/units/${unitId}/booking-pdf`);
    expect(res.status).toBe(403);
    expect(mockGetSignedDownloadUrl).not.toHaveBeenCalled();
  });
});
