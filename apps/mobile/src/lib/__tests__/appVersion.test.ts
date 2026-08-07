import { isAppVersionAtLeast, parseSemver } from "@/lib/appVersion";

describe("appVersion", () => {
  it("parses semver", () => {
    expect(parseSemver("1.0.5")).toEqual([1, 0, 5]);
    expect(parseSemver("v2.3.4-beta")).toEqual([2, 3, 4]);
    expect(parseSemver("1.0")).toBeNull();
  });

  it("compares versions for force-update", () => {
    expect(isAppVersionAtLeast("1.0.5", "1.0.5")).toBe(true);
    expect(isAppVersionAtLeast("1.0.6", "1.0.5")).toBe(true);
    expect(isAppVersionAtLeast("1.0.4", "1.0.5")).toBe(false);
  });
});
