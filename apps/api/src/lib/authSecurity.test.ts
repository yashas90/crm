import { describe, expect, it } from "vitest";
import {
  clearEmailLoginAttempts,
  hashEmailForAudit,
  isEmailLoginLimited,
  recordEmailLoginAttempt,
  resetLoginBruteForceForTests,
} from "./loginBruteForce.js";
import { validatePasswordPolicy } from "./passwordPolicy.js";

describe("validatePasswordPolicy", () => {
  it("accepts a strong password", () => {
    expect(validatePasswordPolicy("Secure1!pass")).toEqual({ valid: true });
  });

  it("returns specific errors for each failed rule", () => {
    const result = validatePasswordPolicy("weak");
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors).toContain("Password must be at least 8 characters.");
    expect(result.errors).toContain("Password must contain at least one uppercase letter.");
    expect(result.errors).toContain("Password must contain at least one number.");
    expect(result.errors).toContain("Password must contain at least one special character.");
  });
});

describe("loginBruteForce email limiter", () => {
  it("limits after 10 attempts per email", () => {
    resetLoginBruteForceForTests();
    const email = "agent@example.com";

    for (let i = 0; i < 10; i += 1) {
      const attempt = recordEmailLoginAttempt(email);
      expect(attempt.limited).toBe(false);
    }

    const blocked = recordEmailLoginAttempt(email);
    expect(blocked.limited).toBe(true);
    expect(isEmailLoginLimited(email)).toBe(true);

    clearEmailLoginAttempts(email);
    expect(isEmailLoginLimited(email)).toBe(false);
  });

  it("hashes emails consistently for audit metadata", () => {
    expect(hashEmailForAudit("Agent@Example.com")).toBe(hashEmailForAudit("agent@example.com"));
  });
});
