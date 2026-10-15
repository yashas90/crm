import { istWallClockToDate } from "@propninja/types/ist";
import {
  checkInTooEarlyMessage,
  haversineMeters,
  mapVisitEventToLeadStatus,
  validateVisitSlot,
  withinRadius,
} from "@propninja/types/site-visit-tracking";
import { describe, expect, it } from "vitest";

describe("site visit tracking rules", () => {
  it("measures haversine distance and the default zone radius", () => {
    expect(haversineMeters(28.6139, 77.209, 28.6139, 77.209)).toBe(0);
    const nearby = haversineMeters(28.6139, 77.209, 28.6149, 77.209);
    expect(nearby).toBeGreaterThan(100);
    expect(nearby).toBeLessThan(130);
    expect(withinRadius(nearby, 200)).toBe(true);
    expect(withinRadius(nearby + 200, 200)).toBe(false);
  });

  it("rejects check-in earlier than 30 minutes before the visit", () => {
    const now = istWallClockToDate("2026-12-16", 9, 29);
    expect(checkInTooEarlyMessage("2026-12-16", "10:00", now)).toMatch(/30 minutes/);
    const open = istWallClockToDate("2026-12-16", 9, 30);
    expect(checkInTooEarlyMessage("2026-12-16", "10:00", open)).toBeNull();
  });

  it("only accepts 9:00–19:00 IST slots that are not in the past", () => {
    const now = istWallClockToDate("2026-12-16", 8, 0);
    expect(validateVisitSlot("2026-12-16", "08:30", now)).toMatch(/9:00/);
    expect(validateVisitSlot("2026-12-16", "10:15", now)).toMatch(/30-minute/);
    expect(validateVisitSlot("2026-12-16", "19:30", now)).toMatch(/9:00/);
    expect(validateVisitSlot("2026-12-16", "09:00", now)).toBeNull();
    expect(validateVisitSlot("2026-12-16", "19:00", now)).toBeNull();
    expect(validateVisitSlot("2026-12-15", "10:00", now)).toMatch(/past/);
  });

  it("maps visit outcomes onto existing lead statuses", () => {
    expect(mapVisitEventToLeadStatus("schedule")).toEqual({
      pipelineStage: "site_visit_scheduled",
      leadStatus: "qualified",
    });
    expect(mapVisitEventToLeadStatus("interested").pipelineStage).toBe("site_visit_done");
    expect(mapVisitEventToLeadStatus("needs_time").leadStatus).toBe("qualified");
    expect(mapVisitEventToLeadStatus("very_interested").leadStatus).toBe("negotiation");
    expect(mapVisitEventToLeadStatus("negotiating").pipelineStage).toBe("negotiation");
    expect(mapVisitEventToLeadStatus("wants_different_property").leadStatus).toBe("contacted");
    expect(mapVisitEventToLeadStatus("not_interested")).toEqual({
      pipelineStage: "closed_lost",
      leadStatus: "lost",
    });
    expect(mapVisitEventToLeadStatus("deal_closed")).toEqual({
      pipelineStage: "closed_won",
      leadStatus: "won",
    });
  });
});
