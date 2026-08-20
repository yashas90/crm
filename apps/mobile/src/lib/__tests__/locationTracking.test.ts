jest.mock("expo-task-manager", () => ({
  defineTask: jest.fn(),
}));

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted" })),
  getBackgroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted" })),
  hasStartedLocationUpdatesAsync: jest.fn(() => Promise.resolve(false)),
  startLocationUpdatesAsync: jest.fn(() => Promise.resolve()),
  stopLocationUpdatesAsync: jest.fn(() => Promise.resolve()),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: { latitude: 13.05, longitude: 77.62, accuracy: 18 },
      timestamp: Date.now(),
    }),
  ),
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted" })),
  requestBackgroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted" })),
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));
jest.mock("@react-native-community/netinfo", () => ({
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));
jest.mock("@/lib/apiClient", () => ({
  apiPost: jest.fn(() => Promise.resolve({ ok: true })),
}));
jest.mock("@/lib/auth", () => ({
  ensureAuthCacheLoaded: jest.fn(() => Promise.resolve()),
  getRefreshToken: jest.fn(() => null),
  getToken: jest.fn(() => "token"),
  updateTokens: jest.fn(),
}));
jest.mock("@/lib/jwt", () => ({
  isTokenExpired: jest.fn(() => false),
}));
jest.mock("@/lib/callLogNative", () => ({
  hasCallLogPermission: jest.fn(() => Promise.resolve(true)),
  requestCallLogPermission: jest.fn(() => Promise.resolve(true)),
}));

import { hasCallLogPermission } from "@/lib/callLogNative";
import {
  PING_INTERVAL_MS,
  checkRequiredWorkPermissions,
  hasAlwaysAllowLocationPermission,
  isLocationCollectionAllowed,
  isWorkHours,
  requestLocationPermissionsOnce,
  startLocationTracking,
} from "@/lib/locationTracking";
import * as Location from "expo-location";

describe("isLocationCollectionAllowed", () => {
  it("allows weekday mid-day IST", () => {
    expect(isLocationCollectionAllowed(new Date("2026-08-20T06:30:00.000Z"))).toBe(true);
  });

  it("allows Sunday inside window", () => {
    expect(isLocationCollectionAllowed(new Date("2026-08-16T04:30:00.000Z"))).toBe(true);
  });

  it("rejects before 9:30 AM IST", () => {
    expect(isLocationCollectionAllowed(new Date("2026-08-20T03:30:00.000Z"))).toBe(false);
  });

  it("rejects after 8:30 PM IST", () => {
    expect(isLocationCollectionAllowed(new Date("2026-08-20T15:00:00.000Z"))).toBe(false);
  });
});

describe("isWorkHours (compat)", () => {
  it("matches tracking window", () => {
    expect(isWorkHours(new Date("2026-08-20T06:30:00.000Z"))).toBe(true);
    expect(isWorkHours(new Date("2026-08-20T03:00:00.000Z"))).toBe(false);
  });
});

describe("Allow all the time gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    (hasCallLogPermission as jest.Mock).mockResolvedValue(true);
  });

  it("rejects While using the app (foreground only)", async () => {
    (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "denied" });
    expect(await hasAlwaysAllowLocationPermission()).toBe(false);
    const perms = await checkRequiredWorkPermissions();
    expect(perms.allGranted).toBe(false);
  });

  it("requestLocationPermissionsOnce fails if background is denied", async () => {
    (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "denied",
    });
    (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "denied" });
    expect(await requestLocationPermissionsOnce()).toBe(false);
  });
});

describe("startLocationTracking", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Location.hasStartedLocationUpdatesAsync as jest.Mock).mockResolvedValue(false);
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
  });

  it("starts background updates every 30 minutes when inside hours", async () => {
    expect(PING_INTERVAL_MS).toBe(30 * 60 * 1000);
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-20T06:30:00.000Z"));

    await startLocationTracking();

    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
      "PROPNINJA_LOCATION_TASK",
      expect.objectContaining({
        timeInterval: PING_INTERVAL_MS,
        distanceInterval: 0,
      }),
    );
    jest.useRealTimers();
  });

  it("does not start tracking outside working hours", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-20T16:00:00.000Z"));

    await startLocationTracking();

    expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
