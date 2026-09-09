import { describe, expect, it } from "vitest";
import { normalizeStoredPhone, phoneLast10Digits, phoneMatchVariants } from "./leadPhone.js";

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

  it("extracts last 10 digits from local and +91 numbers", () => {
    expect(phoneLast10Digits("9480008899")).toBe("9480008899");
    expect(phoneLast10Digits("+91 94800 08899")).toBe("9480008899");
    expect(phoneLast10Digits("123")).toBeNull();
  });
});
