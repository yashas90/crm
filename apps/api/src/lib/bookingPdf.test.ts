import { describe, expect, it } from "vitest";
import { buildBookingFileKey, buildBookingRef } from "./bookingPdf.js";

describe("buildBookingRef", () => {
  it("formats BOOK-{year}-{last6 of unit id}", () => {
    const unitId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    expect(buildBookingRef(unitId, new Date("2026-06-16T10:00:00.000Z"))).toBe("BOOK-2026-567890");
  });
});

describe("buildBookingFileKey", () => {
  it("uses bookings/{projectId}/{unitId}-booking-{date}.pdf", () => {
    const key = buildBookingFileKey(
      "proj-1111-1111-1111-111111111111",
      "unit-2222-2222-2222-222222222222",
      new Date("2026-06-16T10:00:00.000Z"),
    );
    expect(key).toBe(
      "bookings/proj-1111-1111-1111-111111111111/unit-2222-2222-2222-222222222222-booking-2026-06-16.pdf",
    );
  });
});
