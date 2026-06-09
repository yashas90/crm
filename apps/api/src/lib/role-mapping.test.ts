import { describe, expect, it } from "vitest";
import { defaultRoleLabel, mapRoleLabelToRole, resolveUserRoleFields } from "./role-mapping.js";

describe("mapRoleLabelToRole", () => {
  it("maps display labels to permission enums", () => {
    expect(mapRoleLabelToRole("Admin")).toBe("admin");
    expect(mapRoleLabelToRole("Manager")).toBe("manager");
    expect(mapRoleLabelToRole("Basic")).toBe("agent");
    expect(mapRoleLabelToRole("Agent")).toBe("agent");
  });
});

describe("resolveUserRoleFields", () => {
  it("prefers roleLabel over role on write", () => {
    expect(resolveUserRoleFields({ roleLabel: "Basic", role: "manager" })).toEqual({
      roleLabel: "Basic",
      role: "agent",
    });
  });

  it("falls back to role when only role is provided", () => {
    expect(resolveUserRoleFields({ role: "manager" })).toEqual({
      roleLabel: "Manager",
      role: "manager",
    });
  });

  it("returns null when neither field is provided", () => {
    expect(resolveUserRoleFields({})).toBeNull();
  });
});

describe("defaultRoleLabel", () => {
  it("returns display labels for enums", () => {
    expect(defaultRoleLabel("admin")).toBe("Admin");
    expect(defaultRoleLabel("manager")).toBe("Manager");
    expect(defaultRoleLabel("agent")).toBe("Basic");
  });
});
