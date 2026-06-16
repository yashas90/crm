import { describe, expect, it } from "vitest";
import {
  callsReportQuerySchema,
  leadsReportQuerySchema,
  overviewReportQuerySchema,
} from "./reports.js";

describe("overviewReportQuerySchema ad_leads", () => {
  it("parses ad_leads=true", () => {
    const parsed = overviewReportQuerySchema.safeParse({ ad_leads: "true" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.adLeadsOnly).toBe(true);
    }
  });
});

describe("leadsReportQuerySchema ad_leads", () => {
  it("suppresses source when ad_leads is set", () => {
    const parsed = leadsReportQuerySchema.safeParse({
      ad_leads: "true",
      source: "Facebook Ads",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.adLeadsOnly).toBe(true);
      expect(parsed.data.source).toBeUndefined();
    }
  });
});

describe("callsReportQuerySchema user_status", () => {
  it("defaults userStatus to all", () => {
    const parsed = callsReportQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.userStatus).toBe("all");
    }
  });

  it("maps user_status query param to userStatus", () => {
    const parsed = callsReportQuerySchema.safeParse({
      user_status: "inactive",
      group_by: "user",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.userStatus).toBe("inactive");
    }
  });

  it("parses with_team=true", () => {
    const parsed = callsReportQuerySchema.safeParse({ with_team: "true", group_by: "user" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.withTeam).toBe(true);
    }
  });
});
