import { describe, expect, it } from "vitest";
import { UNIT_STATUS_TRANSITIONS } from "../services/projectUnitService.js";

describe("unit summary aggregation", () => {
  it("aggregates status counts from a unit list", () => {
    const units = [
      { status: "available" },
      { status: "available" },
      { status: "reserved" },
      { status: "booked" },
      { status: "sold" },
      { status: "sold" },
      { status: "sold" },
    ];

    const summary = {
      total: units.length,
      available: units.filter((u) => u.status === "available").length,
      reserved: units.filter((u) => u.status === "reserved").length,
      booked: units.filter((u) => u.status === "booked").length,
      sold: units.filter((u) => u.status === "sold").length,
    };

    expect(summary).toEqual({
      total: 7,
      available: 2,
      reserved: 1,
      booked: 1,
      sold: 3,
    });
  });

  it("defines transitions for every inventory status", () => {
    expect(Object.keys(UNIT_STATUS_TRANSITIONS).sort()).toEqual(
      ["available", "booked", "reserved", "sold"].sort(),
    );
  });
});
