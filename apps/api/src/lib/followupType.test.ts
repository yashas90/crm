import { describe, expect, it } from "vitest";
import { inferFollowupType } from "./followupType.js";

describe("inferFollowupType", () => {
  it("defaults to callback", () => {
    expect(inferFollowupType({})).toBe("callback");
  });

  it("reads explicit custom field", () => {
    expect(inferFollowupType({ customFields: { followup_type: "meeting" } })).toBe("meeting");
  });

  it("infers site visit from tags", () => {
    expect(inferFollowupType({ tags: ["site_visit"] })).toBe("site_visit");
  });
});
