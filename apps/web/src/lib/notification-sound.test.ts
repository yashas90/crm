import { describe, expect, it } from "vitest";
import { LEAD_ALERT_NOTIFICATION_TYPES } from "./notification-sound";

describe("LEAD_ALERT_NOTIFICATION_TYPES", () => {
  it("includes lead assignment and new ad lead types", () => {
    expect(LEAD_ALERT_NOTIFICATION_TYPES.has("lead_assigned")).toBe(true);
    expect(LEAD_ALERT_NOTIFICATION_TYPES.has("new_ad_lead")).toBe(true);
  });
});
