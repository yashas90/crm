import { describe, expect, it } from "vitest";
import { buildOrgSettingsPatch, mergeOrgSettings } from "./orgSettings.js";

describe("orgSettings", () => {
  it("merges top-level website and timezone into settings patch", () => {
    expect(
      buildOrgSettingsPatch({
        website: "https://propninja.example",
        timezone: "Asia/Kolkata",
      }),
    ).toEqual({
      website: "https://propninja.example",
      timezone: "Asia/Kolkata",
    });
  });

  it("only picks whitelisted nested settings keys", () => {
    expect(
      buildOrgSettingsPatch({
        settings: {
          website: "https://a.example",
          locale: "en-IN",
          secretKey: "nope",
        },
      }),
    ).toEqual({
      website: "https://a.example",
      locale: "en-IN",
    });
  });

  it("removes cleared settings values", () => {
    expect(
      mergeOrgSettings(
        { website: "https://old.example", timezone: "UTC", keepMe: true },
        { website: "", timezone: null },
      ),
    ).toEqual({ keepMe: true });
  });
});
