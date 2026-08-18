import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMobileHealth, resolveApiBaseUrl, resolveMobileApkUrl } from "./mobile-download";

describe("resolveApiBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns configured NEXT_PUBLIC_API_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com/");
    expect(resolveApiBaseUrl()).toBe("https://api.example.com");
  });

  it("returns localhost in non-production when unset", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    expect(resolveApiBaseUrl()).toBe("http://localhost:3001");
  });
});

describe("resolveMobileApkUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns trimmed APK URL when set", () => {
    vi.stubEnv("NEXT_PUBLIC_MOBILE_APK_URL", " https://cdn.example.com/propninja.apk ");
    expect(resolveMobileApkUrl()).toBe("https://cdn.example.com/propninja.apk");
  });

  it("returns null when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_MOBILE_APK_URL", "");
    expect(resolveMobileApkUrl()).toBeNull();
  });
});

describe("fetchMobileHealth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("parses min version from health payload", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          minMobileAppVersion: "1.0.7",
          mobileUpdateUrl: "https://www.ninjamarketing.in/download",
        }),
      }),
    );

    const result = await fetchMobileHealth();
    expect(result).toEqual({
      minVersion: "1.0.7",
      updateUrl: "https://www.ninjamarketing.in/download",
      error: null,
    });
  });
});
