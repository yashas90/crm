import { isWithinTrackingHours } from "@propninja/types/tracking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as BackgroundFetch from "expo-background-fetch";
import Constants from "expo-constants";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { AppState, Linking, Platform } from "react-native";
import { ApiRequestError, apiPost, refreshAccessToken } from "./apiClient";
import { getMobileAppVersion } from "./appVersion";
import { ensureAuthCacheLoaded, getToken } from "./auth";
import { hasCallLogPermission, requestCallLogPermission } from "./callLogNative";
import { getOsCallLogPermissionStatus, syncOsCallLogMetadata } from "./callLogSync";
import { isTokenExpired } from "./jwt";

export const LOCATION_CONSENT_GIVEN_KEY = "location_consent_given";
/** Bumped when required-permission gate / schedule copy changes. */
export const LOCATION_CONSENT_PROMPTED_KEY = "location_consent_prompted_v6";

const TASK_NAME = "PROPNINJA_LOCATION_TASK";
/** Closed-app recovery: WorkManager-style wake even when the UI process is dead. */
const WATCHDOG_TASK_NAME = "PROPNINJA_LOCATION_WATCHDOG";
/** Office wants a position at least every 30 minutes during working hours. */
export const PING_INTERVAL_MS = 30 * 60 * 1000;
/**
 * Ask the OS for deliveries more often than the SLA. Android Fused Location + OEM
 * battery savers routinely stretch `timeInterval`; 15m requests keep us under 30m.
 */
export const LOCATION_OS_INTERVAL_MS = 15 * 60 * 1000;
/** Background-fetch minimum interval (seconds) — OS may coalesce further. */
export const WATCHDOG_MINIMUM_INTERVAL_SECONDS = 15 * 60;
/** Lightweight device heartbeat while the UI process is alive. */
export const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000;
/** Skip duplicate closed-app heartbeats closer than this (Fused can wake often). */
export const HEARTBEAT_MIN_GAP_MS = 5 * 60 * 1000;
/** Force a catch-up GPS ping when the last successful upload is this old. */
export const LOCATION_CATCHUP_AFTER_MS = 25 * 60 * 1000;
/** Restart the native FGS task if no ping landed within interval + grace (OS often stalls). */
export const LOCATION_OVERDUE_RESTART_MS = 35 * 60 * 1000;
/** Avoid re-POSTing full device registration on every AppState bounce. */
const DEVICE_REGISTER_MIN_GAP_MS = 30 * 60 * 1000;
const LOCATION_PING_QUEUE_KEY = "propninja_pending_location_pings";
const LAST_PING_AT_KEY = "propninja_last_location_ping_at";
const DEVICE_ID_KEY = "propninja_tracking_device_id";
const INSTALLATION_ID_KEY = "propninja_tracking_installation_id";
const MAX_QUEUED_PINGS = 200;

let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
let cachedDeviceId: string | null = null;
let cachedInstallationId: string | null = null;
let lastHeartbeatAtMs = 0;
let lastDeviceRegisterAtMs = 0;
let startTrackingInFlight: Promise<void> | null = null;
let watchdogRegisterInFlight: Promise<void> | null = null;

type LocationPingBody = {
  eventId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
  deviceId: string;
  networkStatus: "online" | "offline" | "unknown";
  source: string;
};

function createEventId(): string {
  return `loc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function getOrCreateDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    cachedDeviceId = existing;
    return existing;
  }
  const next = `dev_${Platform.OS}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, next);
  cachedDeviceId = next;
  return next;
}

async function getOrCreateInstallationId(): Promise<string> {
  if (cachedInstallationId) return cachedInstallationId;
  const existing = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
  if (existing) {
    cachedInstallationId = existing;
    return existing;
  }
  const next = `inst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  await AsyncStorage.setItem(INSTALLATION_ID_KEY, next);
  cachedInstallationId = next;
  return next;
}

function clearTrackingCaches(): void {
  cachedDeviceId = null;
  cachedInstallationId = null;
  lastHeartbeatAtMs = 0;
  lastDeviceRegisterAtMs = 0;
}

function deviceHardwareInfo(): {
  manufacturer: string | null;
  model: string | null;
  osVersion: string | null;
} {
  const platform = Constants.platform;
  return {
    manufacturer: Platform.OS === "android" ? "Android" : Platform.OS === "ios" ? "Apple" : null,
    model: Constants.deviceName ?? platform?.ios?.model ?? null,
    osVersion: String(Platform.Version ?? ""),
  };
}

async function currentNetworkStatus(): Promise<"online" | "offline" | "unknown"> {
  try {
    const state = await NetInfo.fetch();
    if (state.isConnected == null) return "unknown";
    return state.isConnected ? "online" : "offline";
  } catch {
    return "unknown";
  }
}

/**
 * Location is collected Mon–Sun 09:30–20:30 Asia/Kolkata only.
 */
export function isLocationCollectionAllowed(now: Date = new Date()): boolean {
  return isWithinTrackingHours(now);
}

/** @deprecated Prefer isLocationCollectionAllowed. */
export function isWorkHours(now: Date = new Date()): boolean {
  return isLocationCollectionAllowed(now);
}

async function readPingQueue(): Promise<LocationPingBody[]> {
  const raw = await AsyncStorage.getItem(LOCATION_PING_QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as LocationPingBody[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writePingQueue(queue: LocationPingBody[]): Promise<void> {
  await AsyncStorage.setItem(LOCATION_PING_QUEUE_KEY, JSON.stringify(queue));
}

async function enqueueLocationPing(body: LocationPingBody): Promise<void> {
  const queue = await readPingQueue();
  queue.push(body);
  while (queue.length > MAX_QUEUED_PINGS) {
    queue.shift();
  }
  await writePingQueue(queue);
}

async function markLastPingAt(iso: string): Promise<void> {
  await AsyncStorage.setItem(LAST_PING_AT_KEY, iso);
}

async function readLastPingAgeMs(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(LAST_PING_AT_KEY);
  if (!raw) return null;
  const at = Date.parse(raw);
  if (Number.isNaN(at)) return null;
  return Math.max(0, Date.now() - at);
}

async function prepareAuthForBackgroundPing(): Promise<boolean> {
  await ensureAuthCacheLoaded();
  const token = getToken();
  if (token && !isTokenExpired(token)) return true;

  try {
    return await refreshAccessToken();
  } catch {
    return false;
  }
}

async function postLocationPing(body: LocationPingBody): Promise<void> {
  const ready = await prepareAuthForBackgroundPing();
  if (!ready) {
    throw new Error("NO_AUTH");
  }
  await apiPost("/api/locations/ping", body, { skipSessionLogout: true });
  await markLastPingAt(body.capturedAt);
}

type BulkPingResult = {
  inserted: number;
  duplicates: number;
  outsideHours: number;
  disabled?: number;
  acceptedEventIds?: string[];
  rejectedOutsideHoursEventIds?: string[];
  rejectedDisabledEventIds?: string[];
};

/** Flush queued location pings (network restore / app foreground). Prefer bulk when possible. */
export async function flushLocationPingQueue(): Promise<number> {
  const queue = await readPingQueue();
  if (queue.length === 0) return 0;

  try {
    const ready = await prepareAuthForBackgroundPing();
    if (!ready) throw new Error("NO_AUTH");

    const result = await apiPost<BulkPingResult>(
      "/api/locations/ping/bulk",
      { items: queue },
      { skipSessionLogout: true },
    );

    // Only dequeue pings the server actually accepted (inserted or duplicate).
    // Drop outside-hours samples — they are intentionally not stored and must not
    // clog the offline queue forever.
    if (Array.isArray(result.acceptedEventIds)) {
      const accepted = new Set(result.acceptedEventIds);
      const rejectedOutside = new Set(result.rejectedOutsideHoursEventIds ?? []);
      const rejectedDisabled = new Set(result.rejectedDisabledEventIds ?? []);
      const remaining = queue.filter(
        (item) =>
          !accepted.has(item.eventId) &&
          !rejectedOutside.has(item.eventId) &&
          !rejectedDisabled.has(item.eventId),
      );
      await writePingQueue(remaining);
      const lastAccepted = [...queue].reverse().find((item) => accepted.has(item.eventId));
      if (lastAccepted) await markLastPingAt(lastAccepted.capturedAt);
      return accepted.size;
    }

    // Legacy API without acceptedEventIds — never clear the queue if any item was outside hours.
    if ((result.outsideHours ?? 0) > 0) {
      throw new Error("BULK_PARTIAL_OUTSIDE_HOURS");
    }
    await writePingQueue([]);
    const last = queue[queue.length - 1];
    if (last) await markLastPingAt(last.capturedAt);
    return queue.length;
  } catch {
    // Fall back to serial flush.
  }

  let synced = 0;
  const remaining: LocationPingBody[] = [];
  for (let i = 0; i < queue.length; i += 1) {
    const item = queue[i];
    if (!item) continue;
    try {
      await postLocationPing(item);
      synced += 1;
    } catch (err) {
      const discardable =
        err instanceof ApiRequestError &&
        (err.code === "OUTSIDE_TRACKING_HOURS" || err.code === "TRACKING_DISABLED");
      if (discardable) {
        continue;
      }
      remaining.push(...queue.slice(i));
      break;
    }
  }
  await writePingQueue(remaining);
  return synced;
}

async function sendLocationObject(
  loc: Location.LocationObject,
  source = "mobile_background",
): Promise<void> {
  if (!isLocationCollectionAllowed(new Date(loc.timestamp))) return;

  const [deviceId, networkStatus] = await Promise.all([
    getOrCreateDeviceId(),
    currentNetworkStatus(),
  ]);

  const body: LocationPingBody = {
    eventId: createEventId(),
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: loc.coords.accuracy ?? null,
    capturedAt: new Date(loc.timestamp).toISOString(),
    deviceId,
    networkStatus,
    source,
  };

  try {
    await postLocationPing(body);
    // Successful live ping — drain any backlog without blocking the next GPS wake.
    void flushLocationPingQueue();
  } catch {
    await enqueueLocationPing(body);
  }
}

function locationUpdateOptions(): Location.LocationTaskOptions {
  return {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: LOCATION_OS_INTERVAL_MS,
    distanceInterval: 0,
    deferredUpdatesInterval: 0,
    deferredUpdatesDistance: 0,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "PropNinja",
      notificationBody: "Sharing location with your office every 30 minutes (9:30 AM–8:30 PM IST)",
      notificationColor: "#204060",
      killServiceOnDestroy: false,
    },
    pausesUpdatesAutomatically: false,
  };
}

async function pingCurrentPositionOnce(source = "mobile_catchup"): Promise<void> {
  if (!isLocationCollectionAllowed()) return;
  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    await sendLocationObject(loc, source);
  } catch {
    // Best-effort
  }
}

export async function sendDeviceHeartbeat(options?: { force?: boolean }): Promise<void> {
  const force = options?.force === true;
  if (!force && Date.now() - lastHeartbeatAtMs < HEARTBEAT_MIN_GAP_MS) return;

  const [deviceId, networkStatus] = await Promise.all([
    getOrCreateDeviceId(),
    currentNetworkStatus(),
  ]);
  try {
    await apiPost(
      "/api/locations/device/heartbeat",
      {
        deviceId,
        platform: Platform.OS === "ios" ? "ios" : "android",
        appVersion: getMobileAppVersion(),
        networkStatus,
      },
      { skipSessionLogout: true },
    );
    lastHeartbeatAtMs = Date.now();
  } catch {
    // Best-effort
  }
}

TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  if (error) return;

  // Throttled heartbeat so closed-app "last communication" stays fresh without
  // burning radio on every Fused micro-wake.
  await sendDeviceHeartbeat();

  if (!isLocationCollectionAllowed()) {
    await flushLocationPingQueue().catch(() => 0);
    return;
  }

  const payload = data as { locations?: Location.LocationObject[] } | undefined;
  const loc = payload?.locations?.[0];
  if (loc) {
    await sendLocationObject(loc, "mobile_background");
    return;
  }
  await pingCurrentPositionOnce("mobile_background_fallback");
});

TaskManager.defineTask(WATCHDOG_TASK_NAME, async () => {
  try {
    await runClosedAppWatchdog();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export type RequiredWorkPermissions = {
  /** True only for OS “Allow all the time” / Always. */
  locationGranted: boolean;
  callLogGranted: boolean;
  allGranted: boolean;
};

export async function hasAlwaysAllowLocationPermission(): Promise<boolean> {
  const [foreground, background] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);
  return foreground.status === "granted" && background.status === "granted";
}

export async function checkRequiredWorkPermissions(): Promise<RequiredWorkPermissions> {
  const [locationGranted, callLogGranted] = await Promise.all([
    hasAlwaysAllowLocationPermission(),
    hasCallLogPermission(),
  ]);
  return {
    locationGranted,
    callLogGranted,
    allGranted: locationGranted && callLogGranted,
  };
}

export async function requestLocationPermissionsOnce(): Promise<boolean> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") return false;
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== "granted") return false;
  return hasAlwaysAllowLocationPermission();
}

export async function registerTrackingDevice(): Promise<void> {
  const [deviceId, installationId, perms, networkStatus] = await Promise.all([
    getOrCreateDeviceId(),
    getOrCreateInstallationId(),
    checkRequiredWorkPermissions(),
    currentNetworkStatus(),
  ]);
  const hw = deviceHardwareInfo();
  try {
    await apiPost(
      "/api/locations/device",
      {
        deviceId,
        installationId,
        platform: Platform.OS === "ios" ? "ios" : "android",
        appVersion: getMobileAppVersion(),
        manufacturer: hw.manufacturer,
        model: hw.model,
        osVersion: hw.osVersion,
        locationPermissionStatus: perms.locationGranted ? "granted" : "denied",
        callLogPermissionStatus: getOsCallLogPermissionStatus(perms.callLogGranted),
        trackingEnabled: perms.locationGranted,
        networkStatus,
        heartbeat: true,
      },
      { skipSessionLogout: true },
    );
    lastDeviceRegisterAtMs = Date.now();
    lastHeartbeatAtMs = Date.now();
  } catch {
    // Best-effort registration.
  }
}

function startHeartbeatLoop() {
  if (heartbeatTimer) return;
  void sendDeviceHeartbeat({ force: true });
  heartbeatTimer = setInterval(() => {
    if (AppState.currentState === "active") {
      void sendDeviceHeartbeat({ force: true });
    }
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeatLoop() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = undefined;
  }
}

export async function requestRequiredWorkPermissions(): Promise<RequiredWorkPermissions> {
  const locationGranted = await requestLocationPermissionsOnce();
  const callLogGranted = await requestCallLogPermission({ allowSkip: false });
  const allGranted = locationGranted && callLogGranted;
  await markLocationConsentPrompted(allGranted);
  if (locationGranted) {
    await startLocationTracking();
  }
  return { locationGranted, callLogGranted, allGranted };
}

export async function openAppPermissionSettings(): Promise<void> {
  await Linking.openSettings();
}

export async function hasLocationConsentPromptBeenShown(): Promise<boolean> {
  const prompted = await AsyncStorage.getItem(LOCATION_CONSENT_PROMPTED_KEY);
  return prompted === "true";
}

export async function markLocationConsentPrompted(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(LOCATION_CONSENT_PROMPTED_KEY, "true");
  await AsyncStorage.setItem(LOCATION_CONSENT_GIVEN_KEY, enabled ? "true" : "false");
}

/**
 * Restart or (re)start the native location FGS when missing or overdue.
 * Safe to call from background-fetch when the UI is not open.
 */
export async function ensureLocationUpdatesRunning(): Promise<void> {
  if (!(await hasAlwaysAllowLocationPermission())) return;

  const lastAgeMs = await readLastPingAgeMs();
  const ageMs = lastAgeMs ?? Number.POSITIVE_INFINITY;
  const overdueForRestart = ageMs >= LOCATION_OVERDUE_RESTART_MS;

  const isRunning = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
  if (isRunning && overdueForRestart) {
    await Location.stopLocationUpdatesAsync(TASK_NAME).catch(() => undefined);
    await Location.startLocationUpdatesAsync(TASK_NAME, locationUpdateOptions());
  } else if (!isRunning) {
    await Location.startLocationUpdatesAsync(TASK_NAME, locationUpdateOptions());
  }
}

/**
 * Closed-app path: heartbeat + queue flush + ensure FGS + catch-up GPS if overdue.
 * Invoked by BackgroundFetch (~15m) even when the user never opens the app.
 */
export async function runClosedAppWatchdog(): Promise<void> {
  if (!(await hasAlwaysAllowLocationPermission())) return;

  await ensureAuthCacheLoaded();
  await sendDeviceHeartbeat({ force: true });
  await flushLocationPingQueue().catch(() => 0);
  await ensureLocationUpdatesRunning();

  if (!isLocationCollectionAllowed()) return;

  const ageMs = (await readLastPingAgeMs()) ?? Number.POSITIVE_INFINITY;
  if (ageMs >= LOCATION_CATCHUP_AFTER_MS) {
    await pingCurrentPositionOnce("mobile_watchdog_catchup");
  }
}

export function registerLocationWatchdog(): Promise<void> {
  if (Platform.OS === "web") return Promise.resolve();
  if (watchdogRegisterInFlight) return watchdogRegisterInFlight;

  watchdogRegisterInFlight = (async () => {
    try {
      const status = await BackgroundFetch.getStatusAsync();
      if (
        status === BackgroundFetch.BackgroundFetchStatus.Denied ||
        status === BackgroundFetch.BackgroundFetchStatus.Restricted
      ) {
        return;
      }
      const registered = await TaskManager.isTaskRegisteredAsync(WATCHDOG_TASK_NAME);
      if (registered) return;
      await BackgroundFetch.registerTaskAsync(WATCHDOG_TASK_NAME, {
        minimumInterval: WATCHDOG_MINIMUM_INTERVAL_SECONDS,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    } catch {
      // Best-effort — OEM may still kill WorkManager jobs under extreme battery modes.
    } finally {
      watchdogRegisterInFlight = null;
    }
  })();

  return watchdogRegisterInFlight;
}

/** Skip duplicate GPS + OS call-log sync when AppState "active" fires twice (auth + navigator). */
const FOREGROUND_SYNC_DEBOUNCE_MS = 60_000;
let lastForegroundSyncAt = 0;

async function maybeForegroundSync(): Promise<void> {
  const now = Date.now();
  if (now - lastForegroundSyncAt < FOREGROUND_SYNC_DEBOUNCE_MS) return;
  lastForegroundSyncAt = now;
  void flushLocationPingQueue();
  void pingCurrentPositionOnce();
  void syncOsCallLogMetadata().catch(() => undefined);
}

export function startLocationTracking(): Promise<void> {
  // Coalesce stacked calls from auth + RootNavigator + consent gate + AppState.
  // Must be a non-async function so callers share the same Promise instance.
  if (startTrackingInFlight) return startTrackingInFlight;

  startTrackingInFlight = (async () => {
    if (!(await hasAlwaysAllowLocationPermission())) return;

    await AsyncStorage.setItem(LOCATION_CONSENT_GIVEN_KEY, "true");
    await ensureAuthCacheLoaded();

    if (Date.now() - lastDeviceRegisterAtMs >= DEVICE_REGISTER_MIN_GAP_MS) {
      void registerTrackingDevice();
    }

    startHeartbeatLoop();
    await registerLocationWatchdog();

    // Keep the foreground-service task running around the clock so Android does not
    // silently drop deliveries overnight. Uploads still skip outside 09:30–20:30 IST.
    const lastAgeMs = await readLastPingAgeMs();
    const ageMs = lastAgeMs ?? Number.POSITIVE_INFINITY;
    const needsCatchUp = isLocationCollectionAllowed() && ageMs >= LOCATION_CATCHUP_AFTER_MS;

    await ensureLocationUpdatesRunning();

    void flushLocationPingQueue();
    if (needsCatchUp) {
      lastForegroundSyncAt = 0;
      await maybeForegroundSync();
    } else if (isLocationCollectionAllowed()) {
      await maybeForegroundSync();
    }
  })().finally(() => {
    startTrackingInFlight = null;
  });

  return startTrackingInFlight;
}

/** Test helper */
export function resetForegroundSyncDebounceForTests(): void {
  lastForegroundSyncAt = 0;
  lastHeartbeatAtMs = 0;
  lastDeviceRegisterAtMs = 0;
  startTrackingInFlight = null;
  watchdogRegisterInFlight = null;
}

export async function stopLocationTracking() {
  stopHeartbeatLoop();
  clearTrackingCaches();
  const isRunning = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
  if (isRunning) await Location.stopLocationUpdatesAsync(TASK_NAME);
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(WATCHDOG_TASK_NAME);
    if (registered) await BackgroundFetch.unregisterTaskAsync(WATCHDOG_TASK_NAME);
  } catch {
    // Best-effort
  }
}
