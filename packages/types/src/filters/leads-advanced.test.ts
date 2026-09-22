import { describe, expect, it } from "vitest";
import {
  countActiveAdvancedFilters,
  defaultLeadsAdvancedFilters,
  normalizeFilterAssignTo,
} from "./leads-advanced.js";

describe("normalizeFilterAssignTo", () => {
  it("returns empty for missing values", () => {
    expect(normalizeFilterAssignTo(undefined)).toEqual([]);
    expect(normalizeFilterAssignTo("")).toEqual([]);
  });

  it("accepts a single UUID string", () => {
    expect(normalizeFilterAssignTo("550e8400-e29b-41d4-a716-446655440000")).toEqual([
      "550e8400-e29b-41d4-a716-446655440000",
    ]);
  });

  it("splits comma-separated ids and dedupes", () => {
    expect(
      normalizeFilterAssignTo(
        "550e8400-e29b-41d4-a716-446655440000, 550e8400-e29b-41d4-a716-446655440001,550e8400-e29b-41d4-a716-446655440000",
      ),
    ).toEqual(["550e8400-e29b-41d4-a716-446655440000", "550e8400-e29b-41d4-a716-446655440001"]);
  });

  it("accepts an array", () => {
    expect(normalizeFilterAssignTo(["a", "b", "a"])).toEqual(["a", "b"]);
  });
});

describe("countActiveAdvancedFilters", () => {
  it("does not count an empty assign-to list", () => {
    expect(countActiveAdvancedFilters(defaultLeadsAdvancedFilters())).toBe(0);
  });

  it("counts one or more selected agents as a single filter", () => {
    expect(
      countActiveAdvancedFilters({
        ...defaultLeadsAdvancedFilters(),
        filterAssignTo: ["a", "b"],
      }),
    ).toBe(1);
  });
});
