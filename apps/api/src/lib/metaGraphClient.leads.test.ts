import { describe, expect, it } from "vitest";
import { filterGraphLeadsSince, leadCreatedTimeUnix } from "./metaGraphClient.js";

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
