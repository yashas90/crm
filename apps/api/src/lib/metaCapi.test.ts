import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildCapiUserData,
  generateEventId,
  hashCity,
  hashCountry,
  hashEmail,
  hashFirstName,
  hashLastName,
  hashPhone,
  hashState,
  hashZip,
} from "./metaCapi.js";

describe("metaCapi hashing", () => {
  it("hashes email as lowercase trimmed SHA-256", () => {
    const expected = createHash("sha256").update("user@example.com", "utf8").digest("hex");
    expect(hashEmail("  User@Example.COM  ")).toBe(expected);
  });

  it("hashes phone as digits-only SHA-256", () => {
    const expected = createHash("sha256").update("919876543210", "utf8").digest("hex");
    expect(hashPhone("+91 98765-43210")).toBe(expected);
  });

  it("hashes names and geo fields", () => {
    expect(hashFirstName("Rahul")).toBe(createHash("sha256").update("rahul", "utf8").digest("hex"));
    expect(hashLastName("Sharma")).toBe(
      createHash("sha256").update("sharma", "utf8").digest("hex"),
    );
    expect(hashCity("New Delhi")).toBe(
      createHash("sha256").update("newdelhi", "utf8").digest("hex"),
    );
    expect(hashState("Maharashtra")).toBe(
      createHash("sha256").update("maharashtra", "utf8").digest("hex"),
    );
    expect(hashCountry("IN")).toBe(createHash("sha256").update("in", "utf8").digest("hex"));
    expect(hashZip("400001")).toBe(createHash("sha256").update("40000", "utf8").digest("hex"));
  });

  it("omits empty fields from user_data", () => {
    const userData = buildCapiUserData({
      email: "a@b.com",
      phone: null,
      fbp: "fb.1.123",
      fbc: "  ",
    });
    expect(userData.em).toEqual([createHash("sha256").update("a@b.com", "utf8").digest("hex")]);
    expect(userData.ph).toBeUndefined();
    expect(userData.fbp).toBe("fb.1.123");
    expect(userData.fbc).toBeUndefined();
  });

  it("includes unhashed Meta lead_id for CRM matching", () => {
    const userData = buildCapiUserData({
      email: "a@b.com",
      metaLeadId: "1234567890123456",
    });
    expect(userData.lead_id).toBe("1234567890123456");
    expect(userData.em?.[0]).toHaveLength(64);
  });

  it("generates unique event ids", () => {
    const a = generateEventId("lead");
    const b = generateEventId("lead");
    expect(a).toMatch(/^lead:/);
    expect(a).not.toBe(b);
  });
});
