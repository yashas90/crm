import { describe, expect, it } from "vitest";
import { normalizeLeadStageInput } from "../lib/leadStage.js";

describe("normalizeLeadStageInput", () => {
  it("accepts API slugs", () => {
    expect(normalizeLeadStageInput("negotiation")).toBe("negotiation");
    expect(normalizeLeadStageInput("qualified")).toBe("qualified");
  });

  it("maps display labels", () => {
    expect(normalizeLeadStageInput("Site Visit")).toBe("qualified");
    expect(normalizeLeadStageInput("Negotiation")).toBe("negotiation");
    expect(normalizeLeadStageInput("Not Interested")).toBe("not_interested");
    expect(normalizeLeadStageInput("Booked")).toBe("won");
  });

  it("rejects unknown values", () => {
    expect(normalizeLeadStageInput("invalid")).toBeNull();
  });
});
