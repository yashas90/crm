import { describe, expect, it } from "vitest";
import {
  LEAD_PURGE_AFTER_MS,
  NA_LEAD_PURGE_AFTER_MS,
  SOFT_DELETED_LEAD_PURGE_AFTER_MS,
} from "./purgeExpiredLeads.js";

describe("lead purge retention", () => {
  it("hard-deletes NA leads after 1 week in not_interested or dropped", () => {
    expect(NA_LEAD_PURGE_AFTER_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(LEAD_PURGE_AFTER_MS).toBe(NA_LEAD_PURGE_AFTER_MS);
  });

  it("hard-deletes soft-deleted leads after 48 hours", () => {
    expect(SOFT_DELETED_LEAD_PURGE_AFTER_MS).toBe(48 * 60 * 60 * 1000);
  });
});
