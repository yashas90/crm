import { describe, expect, it } from "vitest";
import {
  type ApiResponse,
  type ApiSuccessResponse,
  isApiError,
  isApiSuccess,
} from "./api/common.js";
import { asLeadId, asOrgId, asUserId } from "./brands.js";
import type { Lead, Organization, User } from "./entities/index.js";
import { LEAD_STATUSES, LEAD_TEMPERATURES } from "./enums/index.js";
import { roleHasPermission } from "./permissions.js";

const orgId = asOrgId("11111111-1111-4111-8111-111111111111");
const userId = asUserId("22222222-2222-4222-8222-222222222222");
const leadId = asLeadId("33333333-3333-4333-8333-333333333333");

function sampleOrganization(): Organization {
  return {
    id: orgId,
    name: "PropNinja Demo",
    slug: "propninja-demo",
    settings: { timezone: "Asia/Kolkata" },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function sampleUser(): User {
  return {
    id: userId,
    orgId,
    username: "agent.one",
    email: "agent@demo.test",
    name: "Agent One",
    firstName: "Agent",
    lastName: "One",
    workEmail: null,
    workPhone: null,
    personalPhone: null,
    homeLocation: null,
    department: "Sales",
    designation: "Agent",
    timeZone: "Asia/Kolkata",
    brokerNumber: null,
    description: null,
    roleLabel: "Agent",
    generalManagerId: null,
    reportingToId: null,
    role: "agent",
    phone: null,
    passwordHash: null,
    isActive: true,
    isFirstLogin: false,
    sessionsRevokedAt: null,
    reportEmailEnabled: true,
    expoPushToken: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function sampleLead(): Lead {
  return {
    id: leadId,
    orgId,
    assignedTo: userId,
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: "+919999999999",
    secondaryPhone: null,
    city: "Mumbai",
    state: "MH",
    leadSource: "website",
    projectName: null,
    estimatedValue: null,
    leadStatus: "new",
    temperature: "warm",
    notes: null,
    tags: ["hot"],
    customFields: null,
    lastContactedAt: null,
    nextFollowupAt: null,
    followUpCount: 0,
    coldSince: null,
    score: 0,
    scoreUpdatedAt: null,
    whatsappRepliedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
    projectId: null,
    subStatus: null,
    locality: null,
    country: null,
    zone: null,
    propertyType: null,
    propertySubType: null,
    bhk: null,
    bhkType: null,
    propertyStatus: null,
    minBudget: null,
    maxBudget: null,
    carpetAreaSqft: null,
    builtUpAreaSqft: null,
    latitude: null,
    longitude: null,
    closeReason: null,
    closeReasonNote: null,
    lastActivityAt: null,
    slaBreachedAt: null,
  };
}

describe("@propninja/types exports", () => {
  it("accepts branded entity shapes", () => {
    const org = sampleOrganization();
    const user = sampleUser();
    const lead = sampleLead();

    expect(org.id).toBe(orgId);
    expect(user.role).toBe("agent");
    expect(lead.leadStatus).toBe("new");
    expect(lead.temperature).toBe("warm");
  });

  it("exports lead enums used across apps", () => {
    expect(LEAD_STATUSES).toContain("won");
    expect(LEAD_TEMPERATURES).toContain("hot");
  });

  it("narrows API responses", () => {
    const success: ApiResponse<{ count: number }> = {
      ok: true,
      data: { count: 3 },
    };
    const failure: ApiResponse<{ count: number }> = {
      ok: false,
      error: { code: "FORBIDDEN", message: "Denied" },
    };

    expect(isApiSuccess(success)).toBe(true);
    if (isApiSuccess(success)) {
      const typed: ApiSuccessResponse<{ count: number }> = success;
      expect(typed.data.count).toBe(3);
    }

    expect(isApiError(failure)).toBe(true);
  });

  it("evaluates role permissions", () => {
    expect(roleHasPermission("admin", "org_profile:update")).toBe(true);
    expect(roleHasPermission("manager", "org_profile:update")).toBe(true);
    expect(roleHasPermission("agent", "org_profile:update")).toBe(false);
  });
});
