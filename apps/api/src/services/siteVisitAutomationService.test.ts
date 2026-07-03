import { beforeEach, describe, expect, it, vi } from "vitest";

const syncGoogle = vi.fn();
const cancelGoogle = vi.fn();
const insertActivity = vi.fn();

vi.mock("./googleCalendarService.js", () => ({
  syncSiteVisitToGoogleCalendar: (...args: unknown[]) => syncGoogle(...args),
  cancelSiteVisitGoogleCalendar: (...args: unknown[]) => cancelGoogle(...args),
}));

vi.mock("@propninja/db", () => ({
  leadActivities: { id: "leadActivities" },
  leads: {
    id: "leads",
    firstName: "firstName",
    lastName: "lastName",
    phone: "phone",
    email: "email",
  },
  projectUnits: { id: "projectUnits", unitNumber: "unitNumber" },
  projects: { id: "projects", name: "name" },
  siteVisits: {
    id: "id",
    leadId: "leadId",
    agentId: "agentId",
    visitDate: "visitDate",
    visitTime: "visitTime",
    duration: "duration",
    status: "status",
    notes: "notes",
    propertyAddress: "propertyAddress",
    meetingLocation: "meetingLocation",
    mapsLink: "mapsLink",
    tower: "tower",
    customerEmail: "customerEmail",
    publicToken: "publicToken",
    orgId: "orgId",
  },
  users: {
    id: "id",
    name: "name",
    phone: "phone",
    personalPhone: "personalPhone",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => args,
  eq: (a: unknown, b: unknown) => [a, b],
  lte: (a: unknown, b: unknown) => [a, b],
}));

const visitRow = {
  id: "visit-1",
  publicToken: "SV-2026-A1B2C3D4",
  leadId: "lead-1",
  agentId: "agent-1",
  visitDate: "2026-07-15",
  visitTime: "10:00:00",
  duration: 60,
  status: "scheduled",
  notes: null,
  propertyAddress: null,
  meetingLocation: "Sales office",
  mapsLink: "https://maps.google.com/?q=test",
  tower: "Tower A",
  customerEmail: null,
  leadFirst: "Priya",
  leadLast: "Sharma",
  leadPhone: "9876543210",
  leadEmail: null,
  projectName: "Sunrise Heights",
  unitNumber: "1204",
  agentName: "Ravi Kumar",
  agentPhone: "9111223344",
  agentPersonalPhone: null,
};

function mockDatabase() {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            leftJoin: vi.fn(() => ({
              leftJoin: vi.fn(() => ({
                where: vi.fn(() => ({
                  limit: vi.fn(async () => [visitRow]),
                })),
              })),
            })),
          })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (payload: { metadata?: Record<string, unknown> }) => {
        insertActivity(payload);
      }),
    })),
  };
}

describe("siteVisitAutomationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertActivity.mockResolvedValue(undefined);
    syncGoogle.mockResolvedValue({ eventId: "gcal-1" });
    cancelGoogle.mockResolvedValue(undefined);
  });

  it("prepares WhatsApp links and syncs Google Calendar on schedule", async () => {
    const database = mockDatabase();
    const { runSiteVisitAutomation } = await import("./siteVisitAutomationService.js");

    await runSiteVisitAutomation("visit-1", "scheduled", {
      actorUserId: "agent-1",
      database: database as never,
    });

    expect(syncGoogle).toHaveBeenCalledWith(
      "visit-1",
      expect.objectContaining({ status: "scheduled" }),
    );
    expect(cancelGoogle).not.toHaveBeenCalled();
    expect(insertActivity).toHaveBeenCalled();
    const activityPayload = insertActivity.mock.calls.find(
      (call) => call[0]?.metadata?.kind === "visit_scheduled",
    )?.[0];
    expect(activityPayload?.metadata?.customerWhatsappUrl).toContain("wa.me/");
    expect(activityPayload?.metadata?.whatsappCustomer).toBe("prepared");
  });

  it("cancels Google Calendar and prepares cancellation WhatsApp links", async () => {
    const database = mockDatabase();
    const { runSiteVisitAutomation } = await import("./siteVisitAutomationService.js");

    await runSiteVisitAutomation("visit-1", "cancelled", {
      actorUserId: "agent-1",
      database: database as never,
    });

    expect(cancelGoogle).toHaveBeenCalledWith("visit-1", database);
    expect(syncGoogle).not.toHaveBeenCalled();
  });

  it("exposes wa.me links for a visit", async () => {
    const database = mockDatabase();
    const { getSiteVisitWhatsAppLinks } = await import("./siteVisitAutomationService.js");

    const links = await getSiteVisitWhatsAppLinks("visit-1", "scheduled", database as never);
    expect(links?.customer.prepared).toBe(true);
    expect(links?.customer.whatsappUrl).toContain("wa.me/");
    expect(links?.customer.body).toContain("Priya Sharma");
  });
});
