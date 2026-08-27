jest.mock("expo-battery", () => ({
  getBatteryLevelAsync: jest.fn(() => Promise.resolve(0.82)),
  isLowPowerModeEnabledAsync: jest.fn(() => Promise.resolve(false)),
}));
jest.mock("expo-task-manager", () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(() => Promise.resolve(false)),
}));

jest.mock("expo-background-fetch", () => ({
  BackgroundFetchResult: { NewData: 2, NoData: 1, Failed: 3 },
  BackgroundFetchStatus: { Denied: 1, Restricted: 2, Available: 3 },
  getStatusAsync: jest.fn(() => Promise.resolve(3)),
  registerTaskAsync: jest.fn(() => Promise.resolve()),
  unregisterTaskAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  ActivityType: { OtherNavigation: 4 },
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
  refreshAccessToken: jest.fn(() => Promise.resolve(true)),
}));
jest.mock("@/lib/auth", () => ({
  ensureAuthCacheLoaded: jest.fn(() => Promise.resolve()),
  getToken: jest.fn(() => "token"),
}));
jest.mock("@/lib/jwt", () => ({
  isTokenExpired: jest.fn(() => false),
}));
jest.mock("@/lib/callLogNative", () => ({
  hasCallLogPermission: jest.fn(() => Promise.resolve(true)),
  requestCallLogPermission: jest.fn(() => Promise.resolve(true)),
}));
jest.mock("@/lib/callLogSync", () => ({
  getOsCallLogPermissionStatus: jest.fn(() => "granted"),
  syncOsCallLogMetadata: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/lib/trackingNative", () => ({
  isIgnoringBatteryOptimizations: jest.fn(() => Promise.resolve(true)),
  requestIgnoreBatteryOptimizations: jest.fn(() => Promise.resolve()),
  getLastBootAtIso: jest.fn(() => Promise.resolve(null)),
  scheduleNativeTrackingWatchdog: jest.fn(() => Promise.resolve()),
}));

import { hasCallLogPermission } from "@/lib/callLogNative";
import {
  LOCATION_DISTANCE_FILTER_M,
  LOCATION_OS_INTERVAL_MS,
  LOCATION_OVERDUE_RESTART_MS,
  PING_INTERVAL_MS,
  checkRequiredWorkPermissions,
  hasAlwaysAllowLocationPermission,
  isLocationCollectionAllowed,
  isWorkHours,
  registerLocationWatchdog,
  requestLocationPermissionsOnce,
  resetForegroundSyncDebounceForTests,
  runClosedAppWatchdog,
  startLocationTracking,
} from "@/lib/locationTracking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as BackgroundFetch from "expo-background-fetch";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

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
    resetForegroundSyncDebounceForTests();
    (Location.hasStartedLocationUpdatesAsync as jest.Mock).mockResolvedValue(false);
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(false);
    (BackgroundFetch.getStatusAsync as jest.Mock).mockResolvedValue(
      BackgroundFetch.BackgroundFetchStatus.Available,
    );
  });

  it("starts OS updates every 30m with 50m distance filter (spec Rule 2)", async () => {
    expect(PING_INTERVAL_MS).toBe(30 * 60 * 1000);
    expect(LOCATION_OS_INTERVAL_MS).toBe(30 * 60 * 1000);
    expect(LOCATION_DISTANCE_FILTER_M).toBe(50);
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-20T06:30:00.000Z"));

    await startLocationTracking();

    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
      "PROPNINJA_LOCATION_TASK",
      expect.objectContaining({
        timeInterval: LOCATION_OS_INTERVAL_MS,
        distanceInterval: LOCATION_DISTANCE_FILTER_M,
        deferredUpdatesInterval: LOCATION_OS_INTERVAL_MS,
        deferredUpdatesDistance: LOCATION_DISTANCE_FILTER_M,
        foregroundService: expect.objectContaining({ killServiceOnDestroy: false }),
      }),
    );
    expect(BackgroundFetch.registerTaskAsync).toHaveBeenCalledWith(
      "PROPNINJA_LOCATION_WATCHDOG",
      expect.objectContaining({
        stopOnTerminate: false,
        startOnBoot: true,
        minimumInterval: 15 * 60,
      }),
    );
    jest.useRealTimers();
  });

  it("does not stop/restart an already-running location task when last ping is fresh", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-20T06:30:00.000Z"));
    (Location.hasStartedLocationUpdatesAsync as jest.Mock).mockResolvedValue(true);
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === "propninja_last_location_ping_at") {
        return new Date(Date.now() - 5 * 60 * 1000).toISOString();
      }
      return null;
    });

    await startLocationTracking();

    expect(Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("restarts a running location task when the last ping is overdue", async () => {
    expect(LOCATION_OVERDUE_RESTART_MS).toBe(35 * 60 * 1000);
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-20T06:30:00.000Z"));
    (Location.hasStartedLocationUpdatesAsync as jest.Mock).mockResolvedValue(true);
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === "propninja_last_location_ping_at") {
        return new Date(Date.now() - LOCATION_OVERDUE_RESTART_MS).toISOString();
      }
      return null;
    });

    await startLocationTracking();

    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalled();
    expect(Location.startLocationUpdatesAsync).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("keeps the foreground service running outside working hours (uploads still gated)", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-20T16:00:00.000Z"));

    await startLocationTracking();

    expect(Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
      "PROPNINJA_LOCATION_TASK",
      expect.objectContaining({
        timeInterval: LOCATION_OS_INTERVAL_MS,
        distanceInterval: LOCATION_DISTANCE_FILTER_M,
        deferredUpdatesInterval: LOCATION_OS_INTERVAL_MS,
      }),
    );
    jest.useRealTimers();
  });
});

describe("closed-app watchdog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetForegroundSyncDebounceForTests();
    (Location.hasStartedLocationUpdatesAsync as jest.Mock).mockResolvedValue(false);
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    (Location.startLocationUpdatesAsync as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(false);
    (BackgroundFetch.getStatusAsync as jest.Mock).mockResolvedValue(
      BackgroundFetch.BackgroundFetchStatus.Available,
    );
  });

  it("registers the background-fetch watchdog once", async () => {
    await registerLocationWatchdog();
    expect(BackgroundFetch.registerTaskAsync).toHaveBeenCalledWith(
      "PROPNINJA_LOCATION_WATCHDOG",
      expect.objectContaining({ stopOnTerminate: false, startOnBoot: true }),
    );

    (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(true);
    await registerLocationWatchdog();
    expect(BackgroundFetch.registerTaskAsync).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent startLocationTracking calls into one native start", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-20T06:30:00.000Z"));

    const first = startLocationTracking();
    const second = startLocationTracking();
    expect(first).toBe(second);

    await Promise.all([first, second]);
    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("catch-up GPS when last ping is stale during hours", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-20T06:30:00.000Z"));
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === "propninja_last_location_ping_at") {
        return new Date(Date.now() - 30 * 60 * 1000).toISOString();
      }
      if (key === "propninja_tracking_device_id") return "dev_test";
      return null;
    });

    await runClosedAppWatchdog();

    expect(Location.startLocationUpdatesAsync).toHaveBeenCalled();
    expect(Location.getCurrentPositionAsync).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
