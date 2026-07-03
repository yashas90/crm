import { describe, expect, it } from "vitest";
import { buildOrgSettingsPatch, listOrgUpdateFields, mergeOrgSettings } from "./orgSettings.js";
import type { UpdateOrgBody } from "./validators/org.js";

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
      } as UpdateOrgBody),
    ).toEqual({
      website: "https://a.example",
      locale: "en-IN",
    });
  });

  it("merges leadScoringEnabled boolean setting", () => {
    expect(mergeOrgSettings({}, { leadScoringEnabled: true })).toEqual({
      leadScoringEnabled: true,
    });
    expect(mergeOrgSettings({ leadScoringEnabled: true }, { leadScoringEnabled: false })).toEqual({
      leadScoringEnabled: false,
    });
    expect(
      buildOrgSettingsPatch({
        settings: { leadScoringEnabled: false },
      } as UpdateOrgBody),
    ).toEqual({ leadScoringEnabled: false });
  });

  it("merges reportEmailEnabled boolean setting", () => {
    expect(mergeOrgSettings({}, { reportEmailEnabled: true })).toEqual({
      reportEmailEnabled: true,
    });
    expect(mergeOrgSettings({ reportEmailEnabled: true }, { reportEmailEnabled: false })).toEqual({
      reportEmailEnabled: false,
    });
  });

  it("lists updated fields for audit metadata", () => {
    expect(
      listOrgUpdateFields({
        name: "Acme",
        settings: { locale: "en-IN", reportEmailEnabled: true },
      }),
    ).toEqual(["name", "locale", "reportEmailEnabled"]);
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
