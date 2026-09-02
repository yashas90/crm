import { describe, expect, it } from "vitest";
import { formatLeadCode, isLeadCodeUniqueViolation } from "./leadCode.js";

describe("formatLeadCode", () => {
  it("zero-pads to 4 digits", () => {
    expect(formatLeadCode(1)).toBe("PROP-0001");
    expect(formatLeadCode(42)).toBe("PROP-0042");
    expect(formatLeadCode(9999)).toBe("PROP-9999");
  });
});

describe("isLeadCodeUniqueViolation", () => {
  it("detects the org lead-code unique constraint", () => {
    expect(
      isLeadCodeUniqueViolation({
        code: "23505",
        constraint: "leads_org_lead_code_uidx",
      }),
    ).toBe(true);
  });

  it("walks Error.cause from a wrapped driver error", () => {
    const cause = { code: "23505", constraint: "leads_org_lead_code_uidx" };
    const wrapped = new Error("insert failed");
    (wrapped as Error & { cause: unknown }).cause = cause;
    expect(isLeadCodeUniqueViolation(wrapped)).toBe(true);
  });

  it("ignores other unique violations", () => {
    expect(
      isLeadCodeUniqueViolation({
        code: "23505",
        constraint: "ad_leads_source_external_lead_id_unique",
      }),
    ).toBe(false);
    expect(isLeadCodeUniqueViolation(new Error("boom"))).toBe(false);
  });
});
