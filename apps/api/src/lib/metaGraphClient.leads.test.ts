import { describe, expect, it } from "vitest";
import {
  collectGraphLeadPage,
  filterGraphLeadsSince,
  leadCreatedTimeUnix,
} from "./metaGraphClient.js";

describe("filterGraphLeadsSince", () => {
  it("keeps leads on or after the unix cutoff and rows without a timestamp", () => {
    const sinceUnix = leadCreatedTimeUnix("2026-09-20T00:00:00.000Z")!;
    const filtered = filterGraphLeadsSince(
      [
        { id: "new", created_time: "2026-09-21T12:00:00.000Z" },
        { id: "old", created_time: "2026-09-01T12:00:00.000Z" },
        { id: "unknown" },
      ],
      sinceUnix,
    );
    expect(filtered.map((lead) => lead.id)).toEqual(["new", "unknown"]);
  });

  it("returns all leads when no cutoff is provided", () => {
    const leads = [{ id: "a", created_time: "2020-01-01T00:00:00.000Z" }];
    expect(filterGraphLeadsSince(leads)).toEqual(leads);
  });
});

describe("collectGraphLeadPage", () => {
  const sinceUnix = leadCreatedTimeUnix("2026-09-22T00:00:00.000Z")!;

  it("stops at the first older lead when the page is newest-first", () => {
    const collected = collectGraphLeadPage(
      [
        { id: "new", created_time: "2026-09-23T01:00:00.000Z" },
        { id: "also-new", created_time: "2026-09-22T12:00:00.000Z" },
        { id: "old", created_time: "2026-09-01T00:00:00.000Z" },
        { id: "older", created_time: "2026-08-01T00:00:00.000Z" },
      ],
      sinceUnix,
    );
    expect(collected.reachedCutoff).toBe(true);
    expect(collected.leads.map((lead) => lead.id)).toEqual(["new", "also-new"]);
  });

  it("keeps paging when a newer lead appears after an older one", () => {
    const collected = collectGraphLeadPage(
      [
        { id: "old", created_time: "2026-09-01T00:00:00.000Z" },
        { id: "new", created_time: "2026-09-23T01:00:00.000Z" },
      ],
      sinceUnix,
    );
    expect(collected.reachedCutoff).toBe(false);
    expect(collected.leads.map((lead) => lead.id)).toEqual(["new"]);
  });

  it("keeps the whole page when every lead is inside the window", () => {
    const page = [{ id: "new", created_time: "2026-09-23T01:00:00.000Z" }];
    expect(collectGraphLeadPage(page, sinceUnix)).toEqual({ leads: page, reachedCutoff: false });
  });
});
