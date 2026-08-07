import { describe, expect, it } from "vitest";
import {
  compareSemver,
  isMobileAppVersionAtLeast,
  looksLikeNativeMobileClient,
  parseSemver,
} from "./mobileAppVersion.js";

describe("parseSemver", () => {
  it("parses plain and prefixed versions", () => {
    expect(parseSemver("1.0.5")).toEqual([1, 0, 5]);
    expect(parseSemver("v2.3.4")).toEqual([2, 3, 4]);
    expect(parseSemver("1.2.3-beta")).toEqual([1, 2, 3]);
  });

  it("rejects invalid versions", () => {
    expect(parseSemver("")).toBeNull();
    expect(parseSemver("1.0")).toBeNull();
    expect(parseSemver("abc")).toBeNull();
  });
});

describe("compareSemver / isMobileAppVersionAtLeast", () => {
  it("orders versions correctly", () => {
    expect(compareSemver("1.0.5", "1.0.4")).toBeGreaterThan(0);
    expect(compareSemver("1.0.4", "1.0.5")).toBeLessThan(0);
    expect(compareSemver("1.0.5", "1.0.5")).toBe(0);
    expect(isMobileAppVersionAtLeast("1.0.5", "1.0.5")).toBe(true);
    expect(isMobileAppVersionAtLeast("1.0.4", "1.0.5")).toBe(false);
  });
});

describe("looksLikeNativeMobileClient", () => {
  it("detects okhttp / expo / cfnetwork", () => {
    expect(looksLikeNativeMobileClient("okhttp/4.9.2")).toBe(true);
    expect(looksLikeNativeMobileClient("Expo/1.0")).toBe(true);
    expect(looksLikeNativeMobileClient("PropNinja/1.0 CFNetwork/1490.0.4")).toBe(true);
  });

  it("does not treat desktop browsers as native", () => {
    expect(
      looksLikeNativeMobileClient(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
      ),
    ).toBe(false);
  });
});
