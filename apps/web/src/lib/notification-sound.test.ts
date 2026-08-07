import { describe, expect, it } from "vitest";
import { LEAD_ALERT_NOTIFICATION_TYPES } from "./notification-sound";

describe("LEAD_ALERT_NOTIFICATION_TYPES", () => {
  it("includes lead, callback, and related alert types", () => {
    expect(LEAD_ALERT_NOTIFICATION_TYPES.has("lead_assigned")).toBe(true);
    expect(LEAD_ALERT_NOTIFICATION_TYPES.has("leads_bulk_assigned")).toBe(true);
    expect(LEAD_ALERT_NOTIFICATION_TYPES.has("new_ad_lead")).toBe(true);
    expect(LEAD_ALERT_NOTIFICATION_TYPES.has("callback_requested")).toBe(true);
  });
});
