import { describe, expect, it } from "vitest";
import { OrgScopeError, assertBelongsToOrg } from "./orgScope.js";

describe("assertBelongsToOrg", () => {
  it("passes when org matches", () => {
    expect(() => assertBelongsToOrg("org-1", { orgId: "org-1" })).not.toThrow();
  });

  it("throws OrgScopeError on mismatch", () => {
    expect(() => assertBelongsToOrg("org-2", { orgId: "org-1" })).toThrow(OrgScopeError);
  });
});
