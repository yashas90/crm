import { describe, expect, it } from "vitest";
import {
  COLD_LEAD_DAYS,
  daysOverdue,
  daysSinceContact,
  isColdLead,
  isFollowUpDueToday,
  isFollowUpOverdue,
} from "./followUp.js";

describe("daysSinceContact", () => {
  it("uses lastContactedAt when set", () => {
    const now = new Date("2026-06-16T12:00:00Z");
    const last = new Date("2026-06-09T12:00:00Z");
    expect(daysSinceContact(last, "2026-01-01T00:00:00Z", now)).toBe(7);
  });

  it("falls back to createdAt when never contacted", () => {
    const now = new Date("2026-06-16T12:00:00Z");
    const created = new Date("2026-06-01T12:00:00Z");
    expect(daysSinceContact(null, created, now)).toBe(15);
  });
});

describe("isColdLead", () => {
  it("marks leads cold after threshold", () => {
    const now = new Date("2026-06-16T12:00:00Z");
    const last = new Date(now.getTime() - COLD_LEAD_DAYS * 86_400_000);
    expect(isColdLead(last, "2026-01-01T00:00:00Z", now)).toBe(true);
  });
});

describe("follow-up overdue helpers", () => {
  const now = new Date("2026-06-16T12:00:00Z");

  it("detects overdue follow-ups", () => {
    expect(isFollowUpOverdue("2026-06-15T10:00:00Z", now)).toBe(true);
    expect(isFollowUpOverdue("2026-06-17T10:00:00Z", now)).toBe(false);
  });

  it("detects due today", () => {
    expect(isFollowUpDueToday("2026-06-16T18:00:00Z", now)).toBe(true);
    expect(isFollowUpDueToday("2026-06-17T10:00:00Z", now)).toBe(false);
  });

  it("computes days overdue", () => {
    expect(daysOverdue("2026-06-14T10:00:00Z", now)).toBe(2);
  });
});
