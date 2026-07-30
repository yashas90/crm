jest.mock("expo-task-manager", () => ({
  defineTask: jest.fn(),
}));
jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  getBackgroundPermissionsAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock("@/lib/apiClient", () => ({
  apiPost: jest.fn(),
}));

import { isWorkHours } from "@/lib/locationTracking";

describe("isWorkHours", () => {
  it("is true for weekday mid-day IST", () => {
    // Wednesday 2026-07-29 10:00 IST = 04:30 UTC
    expect(isWorkHours(new Date("2026-07-29T04:30:00.000Z"))).toBe(true);
  });

  it("is false on Sunday", () => {
    // Sunday 2026-07-26 12:00 IST = 06:30 UTC
    expect(isWorkHours(new Date("2026-07-26T06:30:00.000Z"))).toBe(false);
  });

  it("is false before 9 AM IST", () => {
    // Mon 08:30 IST = 03:00 UTC
    expect(isWorkHours(new Date("2026-07-27T03:00:00.000Z"))).toBe(false);
  });

  it("is false at/after 7 PM IST", () => {
    // Mon 19:00 IST = 13:30 UTC
    expect(isWorkHours(new Date("2026-07-27T13:30:00.000Z"))).toBe(false);
  });
});
