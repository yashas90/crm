import { describe, expect, it } from "vitest";
import {
  CALLS_LIST_MAX,
  LEADS_LIST_MAX,
  QueryLimitRequiredError,
  boundCallsPageSize,
  boundLeadsPageSize,
  requireQueryLimit,
} from "./pagination.js";

describe("pagination limits", () => {
  it("requires explicit limit", () => {
    expect(() => requireQueryLimit(undefined, 200)).toThrow(QueryLimitRequiredError);
  });

  it("clamps leads to 500 max", () => {
    expect(boundLeadsPageSize(500)).toBe(500);
    expect(boundLeadsPageSize(9999)).toBe(LEADS_LIST_MAX);
    expect(boundLeadsPageSize(50)).toBe(50);
  });

  it("clamps calls to 100 max", () => {
    expect(boundCallsPageSize(200)).toBe(CALLS_LIST_MAX);
    expect(boundCallsPageSize(25)).toBe(25);
  });
});
