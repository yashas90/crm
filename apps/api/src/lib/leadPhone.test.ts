import { describe, expect, it } from "vitest";
import { normalizeStoredPhone, phoneMatchVariants } from "./leadPhone.js";

describe("leadPhone", () => {
  it("normalizes 10-digit Indian mobiles to +91", () => {
    expect(normalizeStoredPhone("9876543210")).toBe("+919876543210");
    expect(normalizeStoredPhone("91 98765 43210")).toBe("+919876543210");
  });

  it("generates matching variants for duplicate lookup", () => {
    expect(phoneMatchVariants("9876543210")).toEqual(
      expect.arrayContaining(["9876543210", "+919876543210", "919876543210"]),
    );
  });
});
