import { describe, expect, it } from "vitest";
import { scrubObject, scrubQueryParams } from "../middleware/scrubLogger.js";

describe("scrubObject", () => {
  it("redacts sensitive top-level fields", () => {
    const scrubbed = scrubObject({
      email: "user@example.com",
      password: "secret",
      phone: "+919876543210",
      token: "jwt-value",
      otp: "123456",
      name: "Jane",
    });

    expect(scrubbed).toEqual({
      email: "[REDACTED]",
      password: "[REDACTED]",
      phone: "[REDACTED]",
      token: "[REDACTED]",
      otp: "[REDACTED]",
      name: "Jane",
    });
  });

  it("redacts nested sensitive fields", () => {
    const scrubbed = scrubObject({
      lead: {
        id: "lead-1",
        contactEmail: "hidden@example.com",
      },
    });

    expect(scrubbed).toEqual({
      lead: {
        id: "lead-1",
        contactEmail: "[REDACTED]",
      },
    });
  });
});

describe("scrubQueryParams", () => {
  it("redacts token and secret query params", () => {
    expect(
      scrubQueryParams({
        page: "1",
        token: "abc",
        apiKey: "secret-value",
      }),
    ).toEqual({
      page: "1",
      token: "[REDACTED]",
      apiKey: "[REDACTED]",
    });
  });
});
