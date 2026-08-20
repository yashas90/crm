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
  getItem: jest.fn(),
  setItem: jest.fn(() => Promise.resolve()),
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

describe("Allow all the time gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    (hasCallLogPermission as jest.Mock).mockResolvedValue(true);
  });

  it("rejects While using the app (foreground only)", async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "denied" });

    expect(await hasAlwaysAllowLocationPermission()).toBe(false);
    const perms = await checkRequiredWorkPermissions();
    expect(perms.locationGranted).toBe(false);
    expect(perms.allGranted).toBe(false);
  });

  it("allows CRM only when Always / Allow all the time is granted", async () => {
    expect(await hasAlwaysAllowLocationPermission()).toBe(true);
    const perms = await checkRequiredWorkPermissions();
    expect(perms.locationGranted).toBe(true);
    expect(perms.allGranted).toBe(true);
  });

  it("requestLocationPermissionsOnce fails if background is denied", async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "granted",
    });
    (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "denied",
    });
    (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "denied" });

    expect(await requestLocationPermissionsOnce()).toBe(false);
  });

  it("does not start tracking without Always location", async () => {
    (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "denied" });

    await startLocationTracking();

    expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });
});

describe("startLocationTracking", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Location.hasStartedLocationUpdatesAsync as jest.Mock).mockResolvedValue(false);
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
  });

  it("starts background updates every 30 minutes even when stationary", async () => {
    expect(PING_INTERVAL_MS).toBe(30 * 60 * 1000);

    await startLocationTracking();

    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
      "PROPNINJA_LOCATION_TASK",
      expect.objectContaining({
        timeInterval: PING_INTERVAL_MS,
        distanceInterval: 0,
        deferredUpdatesInterval: PING_INTERVAL_MS,
        deferredUpdatesDistance: 0,
        pausesUpdatesAutomatically: false,
        foregroundService: expect.objectContaining({
          notificationTitle: "PropNinja",
        }),
      }),
    );
  });

  it("restarts tracking when a previous session was still marked running", async () => {
    (Location.hasStartedLocationUpdatesAsync as jest.Mock).mockResolvedValue(true);

    await startLocationTracking();

    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalled();
    expect(Location.startLocationUpdatesAsync).toHaveBeenCalled();
  });
});
