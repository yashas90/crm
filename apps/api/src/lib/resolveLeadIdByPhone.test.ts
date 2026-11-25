import { describe, expect, it } from "vitest";
import { phoneLast10Digits } from "./leadPhone.js";

describe("resolveLeadIdByPhone matching key", () => {
  it("aligns dial-pad local numbers with +91 stored leads", () => {
    expect(phoneLast10Digits("9738103851")).toBe("9738103851");
    expect(phoneLast10Digits("+919738103851")).toBe("9738103851");
    expect(phoneLast10Digits("919738103851")).toBe("9738103851");
  });
});
