import { describe, expect, it } from "vitest";
import { enquiryProjectName } from "./leadService.js";

describe("enquiryProjectName", () => {
  it("keeps a stored project name", () => {
    expect(enquiryProjectName("Lake View", "Other")).toBe("Lake View");
  });

  it("falls back to the linked project when the lead only has a project id", () => {
    expect(enquiryProjectName("  ", "Palm Grove")).toBe("Palm Grove");
    expect(enquiryProjectName(null, "Palm Grove")).toBe("Palm Grove");
  });

  it("returns null when neither name is set", () => {
    expect(enquiryProjectName(null, null)).toBeNull();
    expect(enquiryProjectName(" ", " ")).toBeNull();
  });
});
