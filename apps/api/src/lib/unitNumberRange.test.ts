import { describe, expect, it } from "vitest";
import { expandUnitNumberRange } from "./unitNumberRange.js";

describe("expandUnitNumberRange", () => {
  it("expands a numeric suffix range with zero padding", () => {
    expect(expandUnitNumberRange("A-101", "A-105")).toEqual([
      "A-101",
      "A-102",
      "A-103",
      "A-104",
      "A-105",
    ]);
  });

  it("expands a single-unit range", () => {
    expect(expandUnitNumberRange("B-12", "B-12")).toEqual(["B-12"]);
  });

  it("rejects mismatched prefixes", () => {
    expect(() => expandUnitNumberRange("A-101", "B-101")).toThrow(/prefixes must match/i);
  });

  it("rejects inverted ranges", () => {
    expect(() => expandUnitNumberRange("A-110", "A-101")).toThrow(/start unit number/i);
  });
});
