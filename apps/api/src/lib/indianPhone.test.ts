import { describe, expect, it } from "vitest";
import { isValidIndianMobile } from "./indianPhone.js";

describe("isValidIndianMobile", () => {
  it("accepts 10-digit numbers starting with 6-9", () => {
    expect(isValidIndianMobile("9876543210")).toBe(true);
    expect(isValidIndianMobile("8765432109")).toBe(true);
    expect(isValidIndianMobile("7654321098")).toBe(true);
    expect(isValidIndianMobile("6123456789")).toBe(true);
  });

  it("accepts +91 prefix", () => {
    expect(isValidIndianMobile("+919876543210")).toBe(true);
    expect(isValidIndianMobile("919876543210")).toBe(true);
  });

  it("rejects invalid numbers", () => {
    expect(isValidIndianMobile("5876543210")).toBe(false);
    expect(isValidIndianMobile("987654321")).toBe(false);
    expect(isValidIndianMobile("abcdefghij")).toBe(false);
  });
});
