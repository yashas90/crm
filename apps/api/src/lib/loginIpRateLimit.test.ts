import { describe, expect, it } from "vitest";
import {
  clearAllLoginRateLimits,
  isEmailLoginLimited,
  recordEmailLoginAttempt,
  resetLoginBruteForceForTests,
} from "./loginBruteForce.js";

describe("login email rate limit", () => {
  it("allows many failed attempts per email before lockout", () => {
    resetLoginBruteForceForTests();
    const email = "agent@propninja.com";

    for (let i = 0; i < 30; i += 1) {
      const result = recordEmailLoginAttempt(email);
      expect(result.limited).toBe(false);
    }

    const blocked = recordEmailLoginAttempt(email);
    expect(blocked.limited).toBe(true);
    expect(isEmailLoginLimited(email)).toBe(true);
  });

  it("clears all counters", () => {
    recordEmailLoginAttempt("blocked@propninja.com");
    expect(clearAllLoginRateLimits()).toBeGreaterThan(0);
    expect(isEmailLoginLimited("blocked@propninja.com")).toBe(false);
  });
});
