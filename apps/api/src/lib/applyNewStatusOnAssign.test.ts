import { describe, expect, it } from "vitest";
import {
  buildApplyNewStatusFields,
  shouldApplyNewStatusOnAssign,
} from "./applyNewStatusOnAssign.js";

describe("shouldApplyNewStatusOnAssign", () => {
  it("resets Pending (contacted) and NA statuses", () => {
    expect(shouldApplyNewStatusOnAssign("contacted")).toBe(true);
    expect(shouldApplyNewStatusOnAssign("not_interested")).toBe(true);
    expect(shouldApplyNewStatusOnAssign("dropped")).toBe(true);
    expect(shouldApplyNewStatusOnAssign("new")).toBe(true);
  });

  it("does not reset won/lost/qualified", () => {
    expect(shouldApplyNewStatusOnAssign("won")).toBe(false);
    expect(shouldApplyNewStatusOnAssign("lost")).toBe(false);
    expect(shouldApplyNewStatusOnAssign("qualified")).toBe(false);
  });
});

describe("buildApplyNewStatusFields", () => {
  it("sets new + refreshes createdAt for the New window", () => {
    const now = new Date("2026-08-26T10:00:00.000Z");
    expect(buildApplyNewStatusFields(now)).toEqual({
      leadStatus: "new",
      naSinceAt: null,
      nextFollowupAt: null,
      createdAt: now,
      updatedAt: now,
    });
  });
});
