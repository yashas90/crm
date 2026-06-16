import { describe, expect, it } from "vitest";
import { expandLeadSourceFilter } from "./leadSourceAliases.js";

describe("expandLeadSourceFilter", () => {
  it("expands Meta Ads to canonical and legacy values", () => {
    expect(expandLeadSourceFilter("Meta Ads")).toEqual(["Meta Ads", "Facebook Ads", "facebook"]);
    expect(expandLeadSourceFilter("Facebook Ads")).toEqual([
      "Meta Ads",
      "Facebook Ads",
      "facebook",
    ]);
    expect(expandLeadSourceFilter("facebook")).toEqual(["Meta Ads", "Facebook Ads", "facebook"]);
  });

  it("expands Google Ads aliases", () => {
    expect(expandLeadSourceFilter("google-ads")).toEqual(["Google Ads", "google-ads", "google"]);
  });

  it("returns unknown sources unchanged", () => {
    expect(expandLeadSourceFilter("Billboard")).toEqual(["Billboard"]);
  });
});
