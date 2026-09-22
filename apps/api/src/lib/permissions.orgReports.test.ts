import { describe, expect, it } from "vitest";
import { canViewOrgWideReports } from "./permissions.js";

const baseUser = {
  id: "00000000-0000-0000-0000-000000000004",
  email: "manager@demo.propninja",
  name: "Manager",
  orgId: "00000000-0000-0000-0000-000000000001",
  isFirstLogin: false,
};

describe("canViewOrgWideReports", () => {
  it("is true for managers with reportee report access", () => {
    expect(canViewOrgWideReports({ ...baseUser, role: "manager" })).toBe(true);
  });

  it("is true for admins", () => {
    expect(canViewOrgWideReports({ ...baseUser, role: "admin" })).toBe(true);
  });

  it("is false for agents", () => {
    expect(canViewOrgWideReports({ ...baseUser, role: "agent" })).toBe(false);
  });
});
