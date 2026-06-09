import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyMetaWebhookSignature } from "./facebook.js";

function signBody(rawBody: string, secret: string) {
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return `sha256=${digest}`;
}

describe("verifyMetaWebhookSignature", () => {
  const secret = "test-app-secret";
  const body = JSON.stringify({ object: "page", entry: [] });

  it("accepts a valid signature", () => {
    expect(verifyMetaWebhookSignature(body, signBody(body, secret), secret)).toBe(true);
  });

  it("rejects a missing header", () => {
    expect(verifyMetaWebhookSignature(body, undefined, secret)).toBe(false);
  });

  it("rejects a tampered body", () => {
    expect(verifyMetaWebhookSignature(`${body} `, signBody(body, secret), secret)).toBe(false);
  });

  it("rejects the wrong secret", () => {
    expect(verifyMetaWebhookSignature(body, signBody(body, "other-secret"), secret)).toBe(false);
  });
});
