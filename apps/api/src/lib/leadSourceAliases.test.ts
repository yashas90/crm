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

  it("expands Cold Call aliases including underscore form", () => {
    expect(expandLeadSourceFilter("Cold Call")).toEqual(["Cold Call", "cold-call", "cold_call"]);
    expect(expandLeadSourceFilter("cold_call")).toEqual(["Cold Call", "cold-call", "cold_call"]);
  });

  it("returns unknown sources unchanged", () => {
    expect(expandLeadSourceFilter("Billboard")).toEqual(["Billboard"]);
  });
});
