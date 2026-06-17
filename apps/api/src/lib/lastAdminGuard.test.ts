import { describe, expect, it } from "vitest";
import {
  LAST_ADMIN_MESSAGE,
  isLastActiveAdmin,
  isRemovingAdminPrivileges,
} from "../lib/lastAdminGuard.js";

describe("lastAdminGuard", () => {
  describe("isRemovingAdminPrivileges", () => {
    it("returns true when demoting an active admin", () => {
      expect(
        isRemovingAdminPrivileges({ role: "admin", isActive: true }, { role: "manager" }),
      ).toBe(true);
    });

    it("returns true when deactivating an active admin", () => {
      expect(
        isRemovingAdminPrivileges({ role: "admin", isActive: true }, { isActive: false }),
      ).toBe(true);
    });

    it("returns false for non-admin users", () => {
      expect(
        isRemovingAdminPrivileges({ role: "agent", isActive: true }, { isActive: false }),
      ).toBe(false);
    });

    it("returns false when admin role is unchanged", () => {
      expect(
        isRemovingAdminPrivileges({ role: "admin", isActive: true }, { name: "Updated" } as {
          role?: string;
          isActive?: boolean;
        }),
      ).toBe(false);
    });
  });

  describe("isLastActiveAdmin", () => {
    it("identifies sole active admin", () => {
      expect(isLastActiveAdmin({ role: "admin", isActive: true }, 1)).toBe(true);
      expect(isLastActiveAdmin({ role: "admin", isActive: true }, 2)).toBe(false);
    });
  });

  it("uses the expected user-facing message", () => {
    expect(LAST_ADMIN_MESSAGE).toContain("last admin");
  });
});
