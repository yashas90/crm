import { describe, expect, it } from "vitest";
import {
  META_FAILED_LEAD_FAST_ATTEMPTS,
  META_FAILED_LEAD_MAX_ATTEMPTS,
  META_STUCK_LEAD_MS,
  isMetaLeadRetryDue,
} from "./metaFailedLeadRetry.js";

const now = Date.parse("2026-10-23T12:00:00.000Z");

function row(
  status: string,
  retryCount: number,
  ageMs: number,
): { status: string; retryCount: number; createdAt: Date } {
  return { status, retryCount, createdAt: new Date(now - ageMs) };
}

describe("isMetaLeadRetryDue", () => {
  it("re-pulls a lead whose ingest failed", () => {
    expect(isMetaLeadRetryDue(row("failed", 1, 60_000), now)).toBe(true);
  });

  it("leaves a freshly queued webhook to the worker", () => {
    expect(isMetaLeadRetryDue(row("queued", 0, 30_000), now)).toBe(false);
  });

  it("re-pulls a webhook that stayed queued", () => {
    expect(isMetaLeadRetryDue(row("processing", 0, META_STUCK_LEAD_MS), now)).toBe(true);
  });

  it("stops the fast loop after the fast attempt cap and continues on a deep pull", () => {
    const exhausted = row("failed", META_FAILED_LEAD_FAST_ATTEMPTS, 60_000);
    expect(isMetaLeadRetryDue(exhausted, now)).toBe(false);
    expect(isMetaLeadRetryDue(exhausted, now, true)).toBe(true);
  });

  it("gives up after the hard attempt cap or two weeks", () => {
    expect(
      isMetaLeadRetryDue(row("failed", META_FAILED_LEAD_MAX_ATTEMPTS, 60_000), now, true),
    ).toBe(false);
    expect(isMetaLeadRetryDue(row("failed", 1, 15 * 24 * 60 * 60 * 1000), now, true)).toBe(false);
  });

  it("does not retry a lead that already landed", () => {
    expect(isMetaLeadRetryDue(row("processed", 0, 60_000), now, true)).toBe(false);
  });
});
