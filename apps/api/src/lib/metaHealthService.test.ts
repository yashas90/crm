import { describe, expect, it } from "vitest";
import { META_LEAD_PULL_INTERVAL_MS } from "../jobs/metaLeadContinuityJob.js";
import {
  META_POLL_HEALTHY_MS,
  type MetaWebhookHealthSignals,
  classifyMetaWebhookHealth,
} from "./metaHealthService.js";

const QUIET: MetaWebhookHealthSignals = {
  successAgeMs: null,
  receivedAgeMs: null,
  receivedLast15m: 0,
  reconciliationAgeMs: null,
  reconciliationUseful: false,
  reconciliationFailed: false,
  hasAnySignal: false,
};

describe("classifyMetaWebhookHealth", () => {
  it("stays healthy while webhooks are processing", () => {
    const health = classifyMetaWebhookHealth({
      ...QUIET,
      successAgeMs: 60_000,
      hasAnySignal: true,
    });
    expect(health).toMatchObject({ status: "healthy", intake: "webhook" });
  });

  it("stays healthy from the continuous pull when Meta has not pushed recently", () => {
    const health = classifyMetaWebhookHealth({
      ...QUIET,
      successAgeMs: 3 * 60 * 60 * 1000,
      reconciliationAgeMs: 60_000,
      reconciliationUseful: true,
      hasAnySignal: true,
    });
    expect(health).toMatchObject({ status: "healthy", intake: "polling" });
  });

  it("does not call a failed pull healthy", () => {
    const health = classifyMetaWebhookHealth({
      ...QUIET,
      reconciliationAgeMs: 60_000,
      reconciliationUseful: false,
      reconciliationFailed: true,
      hasAnySignal: true,
    });
    expect(health.status).toBe("delayed");
  });

  it("goes offline only when both the webhook and the pull have gone stale", () => {
    const health = classifyMetaWebhookHealth({
      ...QUIET,
      successAgeMs: 6 * 60 * 60 * 1000,
      reconciliationAgeMs: 2 * 60 * 60 * 1000,
      reconciliationUseful: true,
      hasAnySignal: true,
    });
    expect(health).toMatchObject({ status: "offline", intake: "stale" });
  });

  it("keeps the pull interval inside the healthy window so one slow scan is not offline", () => {
    expect(META_LEAD_PULL_INTERVAL_MS * 3).toBeLessThanOrEqual(META_POLL_HEALTHY_MS);
  });
});
