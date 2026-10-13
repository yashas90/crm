import { describe, expect, it } from "vitest";
import { userForeignKeyAction } from "./userDeleteReferences.js";

describe("userForeignKeyAction", () => {
  it("clears nullable links", () => {
    expect(
      userForeignKeyAction({
        tableName: "leads",
        isNotNull: false,
        isPrimary: false,
      }),
    ).toBe("null");
  });

  it("deletes a user's own calling rows", () => {
    expect(
      userForeignKeyAction({
        tableName: "contact_call_logs",
        isNotNull: true,
        isPrimary: false,
      }),
    ).toBe("delete");
  });

  it("deletes a primary-key link", () => {
    expect(
      userForeignKeyAction({
        tableName: "agent_calling_limits",
        isNotNull: true,
        isPrimary: true,
      }),
    ).toBe("delete");
  });

  it("moves required shared links onto the acting admin", () => {
    expect(
      userForeignKeyAction({
        tableName: "audit_logs",
        isNotNull: true,
        isPrimary: false,
      }),
    ).toBe("reassign");
  });
});
