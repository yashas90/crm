import { describe, expect, it } from "vitest";
import { loginIpRateLimiter, resetLoginBruteForceForTests } from "./loginBruteForce.js";

function runIpLimitCheck(ip: string): Promise<number> {
  return new Promise((resolve) => {
    const req = {
      ip,
      headers: {},
      method: "POST",
      socket: { remoteAddress: ip },
    } as Parameters<typeof loginIpRateLimiter>[0];

    const res = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      setHeader() {
        return this;
      },
      getHeader() {
        return undefined;
      },
      json() {
        resolve(this.statusCode);
      },
      send() {
        resolve(this.statusCode);
      },
      end() {
        resolve(this.statusCode);
      },
    } as Parameters<typeof loginIpRateLimiter>[1];

    loginIpRateLimiter(req, res, () => resolve(200));
  });
}

describe("loginIpRateLimiter", () => {
  it("allows 5 attempts then returns 429 for the same IP", async () => {
    resetLoginBruteForceForTests();
    const ip = "203.0.113.50";

    for (let i = 0; i < 5; i += 1) {
      await expect(runIpLimitCheck(ip)).resolves.toBe(200);
    }

    await expect(runIpLimitCheck(ip)).resolves.toBe(429);
  });
});
