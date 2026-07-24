import { describe, expect, it } from "vitest";
import {
  maskEmail,
  maskLeadContactFields,
  maskPhone,
  shouldMaskLeadContact,
  stripMaskedContactUpdates,
} from "./leadMasking.js";

const agent = {
  id: "agent-1",
  orgId: "org-1",
  role: "agent" as const,
  email: "a@test.com",
  name: "Agent",
};

const manager = { ...agent, role: "manager" as const };

describe("leadMasking", () => {
  it("masks phone keeping first 2 and last 3 digits", () => {
    expect(maskPhone("9876543210")).toBe("98XXXXX210");
  });

  it("masks email local part", () => {
    expect(maskEmail("rahul@gmail.com")).toBe("r***@gmail.com");
  });

  it("masks contact for unassigned lead viewed by agent", () => {
    const lead = {
      phone: "9876543210",
      email: "rahul@gmail.com",
      assignedTo: "other-agent",
    };
    expect(shouldMaskLeadContact(agent, lead)).toBe(true);
    const masked = maskLeadContactFields(agent, lead);
    expect(masked.phone).toBe("98XXXXX210");
    expect(masked.email).toBe("r***@gmail.com");
  });

  it("does not mask for assigned agent", () => {
    const lead = {
      phone: "9876543210",
      email: "rahul@gmail.com",
      assignedTo: agent.id,
    };
    expect(maskLeadContactFields(agent, lead).phone).toBe("9876543210");
  });

  it("masks for managers (only admins download full numbers)", () => {
    const lead = {
      phone: "9876543210",
      email: "rahul@gmail.com",
      assignedTo: null,
    };
    expect(shouldMaskLeadContact(manager, lead)).toBe(true);
    expect(maskLeadContactFields(manager, lead).phone).toBe("98XXXXX210");
  });

  it("does not mask for admins", () => {
    const admin = { ...agent, role: "admin" as const };
    const lead = {
      phone: "9876543210",
      email: "rahul@gmail.com",
      assignedTo: null,
    };
    expect(maskLeadContactFields(admin, lead).phone).toBe("9876543210");
  });

  it("strips masked contact fields from update payloads", () => {
    const cleaned = stripMaskedContactUpdates({
      phone: "98XXXXX210",
      secondaryPhone: "91XXXXX000",
      email: "r***@gmail.com",
      assignedTo: "x",
    });
    expect(cleaned.phone).toBeUndefined();
    expect(cleaned.secondaryPhone).toBeUndefined();
    expect(cleaned.email).toBeUndefined();
    expect(cleaned.assignedTo).toBe("x");
  });
});
