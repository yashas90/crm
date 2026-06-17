import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./env.js", () => ({
  env: {
    AUTH_JWT_SECRET: "test-secret-key-min-16-chars",
    WEB_APP_URL: "https://www.ninjamarketing.in",
    API_PUBLIC_URL: "https://api.example.com",
  },
}));

describe("reportUnsubscribe token", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("creates and verifies a valid unsubscribe token", async () => {
    const { createReportUnsubscribeToken, verifyReportUnsubscribeToken } = await import(
      "./reportUnsubscribe.js"
    );

    const userId = "00000000-0000-4000-8000-000000000099";
    const token = createReportUnsubscribeToken(userId);
    expect(verifyReportUnsubscribeToken(token)).toBe(userId);
  });

  it("rejects tampered tokens", async () => {
    const { createReportUnsubscribeToken, verifyReportUnsubscribeToken } = await import(
      "./reportUnsubscribe.js"
    );

    const token = createReportUnsubscribeToken("00000000-0000-4000-8000-000000000099");
    const tampered = `${token}x`;
    expect(verifyReportUnsubscribeToken(tampered)).toBeNull();
    expect(verifyReportUnsubscribeToken("not-a-valid-token")).toBeNull();
  });

  it("builds unsubscribe URL on API public base", async () => {
    const { buildReportUnsubscribeUrl } = await import("./reportUnsubscribe.js");
    const url = buildReportUnsubscribeUrl("00000000-0000-4000-8000-000000000099");
    expect(url).toContain("https://api.example.com/api/auth/unsubscribe-reports?token=");
  });
});
