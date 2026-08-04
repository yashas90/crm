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

import { isLocationCollectionAllowed, isWorkHours } from "@/lib/locationTracking";

describe("isLocationCollectionAllowed", () => {
  it("allows weekday mid-day IST", () => {
    expect(isLocationCollectionAllowed(new Date("2026-07-29T04:30:00.000Z"))).toBe(true);
  });

  it("allows Sunday", () => {
    expect(isLocationCollectionAllowed(new Date("2026-07-26T06:30:00.000Z"))).toBe(true);
  });

  it("allows before 9 AM IST", () => {
    expect(isLocationCollectionAllowed(new Date("2026-07-27T03:00:00.000Z"))).toBe(true);
  });

  it("allows after 7 PM IST", () => {
    expect(isLocationCollectionAllowed(new Date("2026-07-27T13:30:00.000Z"))).toBe(true);
  });
});

describe("isWorkHours (compat)", () => {
  it("always returns true after all-day policy", () => {
    expect(isWorkHours(new Date("2026-07-26T06:30:00.000Z"))).toBe(true);
  });
});
