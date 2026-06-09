import { describe, expect, it } from "vitest";
import { resolveGoogleAdsSyncSince } from "./integrationSyncState.js";

describe("resolveGoogleAdsSyncSince", () => {
  it("uses lookback on first sync when no watermark exists", () => {
    const now = Date.now();
    const since = resolveGoogleAdsSyncSince(undefined, 70, 5);
    const diffMinutes = (now - since.getTime()) / 60_000;

    expect(diffMinutes).toBeGreaterThanOrEqual(69);
    expect(diffMinutes).toBeLessThanOrEqual(71);
  });

  it("resumes from watermark minus overlap on subsequent syncs", () => {
    const lastSuccessAt = new Date("2025-06-01T12:00:00.000Z");
    const since = resolveGoogleAdsSyncSince(lastSuccessAt, 70, 5);

    expect(since.toISOString()).toBe("2025-06-01T11:55:00.000Z");
  });
});
