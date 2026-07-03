import { describe, expect, it } from "vitest";
import {
  DEFAULT_SITE_VISIT_REMINDER_MINUTES,
  appendReminderTier,
  hasReminderTierSent,
  parseSiteVisitReminderMinutes,
} from "./siteVisitReminders.js";

describe("siteVisitReminders", () => {
  it("returns defaults when org setting missing", () => {
    expect(parseSiteVisitReminderMinutes(null)).toEqual([...DEFAULT_SITE_VISIT_REMINDER_MINUTES]);
  });

  it("parses custom reminder minutes", () => {
    expect(parseSiteVisitReminderMinutes({ siteVisitReminderMinutes: [60, 15] })).toEqual([60, 15]);
  });

  it("tracks sent reminder tiers", () => {
    const next = appendReminderTier([], 120);
    expect(hasReminderTierSent(next, 120)).toBe(true);
    expect(hasReminderTierSent(next, 30)).toBe(false);
  });
});
