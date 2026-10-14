import { describe, expect, it } from "vitest";
import { formatINR, parseINR } from "./money.js";

function digits(value: string) {
  return value.replace(/[^\d,]/g, "");
}

describe("formatINR", () => {
  it("uses Indian grouping and the rupee symbol", () => {
    expect(formatINR(500).startsWith("₹")).toBe(true);
    expect(digits(formatINR(500))).toBe("500");
    expect(digits(formatINR(50000))).toBe("50,000");
    expect(digits(formatINR(500000))).toBe("5,00,000");
    expect(digits(formatINR(1000000))).toBe("10,00,000");
    expect(digits(formatINR(10000000))).toBe("1,00,00,000");
    expect(formatINR(100000)).not.toContain("100,000");
  });
});

describe("parseINR", () => {
  it("accepts plain digits and Indian commas", () => {
    expect(parseINR("500000")).toBe(500000);
    expect(parseINR("5,00,000")).toBe(500000);
    expect(parseINR("₹1,00,000")).toBe(100000);
    expect(parseINR("")).toBeUndefined();
    expect(parseINR("abc")).toBeUndefined();
  });
});
