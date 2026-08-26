import { describe, expect, it } from "vitest";
import { formatLeadCode } from "./leadCode.js";

describe("formatLeadCode", () => {
  it("zero-pads to 4 digits", () => {
    expect(formatLeadCode(1)).toBe("PROP-0001");
    expect(formatLeadCode(42)).toBe("PROP-0042");
    expect(formatLeadCode(9999)).toBe("PROP-9999");
  });
});
