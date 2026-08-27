import { getIstHourMinute } from "@propninja/types/ist";
import { isWithinTrackingHours } from "@propninja/types/tracking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as BackgroundFetch from "expo-background-fetch";
import * as Battery from "expo-battery";
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
import {
  getLastBootAtIso,
  isIgnoringBatteryOptimizations,
  requestIgnoreBatteryOptimizations,
  scheduleNativeTrackingWatchdog,
} from "./trackingNative";

export const LOCATION_CONSENT_GIVEN_KEY = "location_consent_given";
/** Bumped when required-permission gate / schedule copy changes. */
export const LOCATION_CONSENT_PROMPTED_KEY = "location_consent_prompted_v8";
const PERMISSION_DENIED_COUNT_KEY = "propninja_location_permission_denied_count";

const TASK_NAME = "PROPNINJA_LOCATION_TASK";
/** Closed-app recovery: WorkManager-style wake even when the UI process is dead. */
const WATCHDOG_TASK_NAME = "PROPNINJA_LOCATION_WATCHDOG";
/** Spec: capture GPS every 30 minutes (also used as OS timeInterval). */
export const PING_INTERVAL_MS = 30 * 60 * 1000;
/**
 * Spec Rule 2 — interval / fastestInterval = 1_800_000 ms.
 * Watchdog still wakes more often to recover OEM stalls.
 */
export const LOCATION_OS_INTERVAL_MS = 30 * 60 * 1000;
/** Spec: only ping if moved 50m OR 30 min passed. */
export const LOCATION_DISTANCE_FILTER_M = 50;
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
const MAX_QUEUED_PINGS = 500;
const PING_MAX_RETRIES = 3;
const QUEUE_FLUSH_BACKOFF_MS = [60_000, 120_000, 240_000, 480_000, 960_000, 1_800_000];

let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
let statusReevalTimer: ReturnType<typeof setInterval> | undefined;
let cachedDeviceId: string | null = null;
let cachedInstallationId: string | null = null;
let lastHeartbeatAtMs = 0;
let lastDeviceRegisterAtMs = 0;
let startTrackingInFlight: Promise<void> | null = null;
let watchdogRegisterInFlight: Promise<void> | null = null;
let flushRetryAttempt = 0;
let flushRetryTimer: ReturnType<typeof setTimeout> | undefined;
let hoursResumeTimer: ReturnType<typeof setTimeout> | undefined;

type LocationPingSource = "foreground" | "background" | "terminated";

type LocationPingBody = {
  eventId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
  deviceId: string;
  networkStatus: "online" | "offline" | "unknown";
  source: LocationPingSource;
  batteryLevel: number | null;
};

type QueuedLocationPing = LocationPingBody & {
  pingId: string;
  synced: boolean;
  queuedAt: string;
};

function createEventId(): string {
  return `loc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function resolvePingSource(explicit?: LocationPingSource): LocationPingSource {
  if (explicit) return explicit;
  const state = AppState.currentState;
  if (state === "active") return "foreground";
  if (state === "background") return "background";
  return "terminated";
}

async function readBatteryLevel(): Promise<number | null> {
  try {
    const level = await Battery.getBatteryLevelAsync();
    if (level == null || Number.isNaN(level) || level < 0) return null;
    return Math.round(Math.min(1, Math.max(0, level)) * 100);
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function readPingQueue(): Promise<QueuedLocationPing[]> {
  const raw = await AsyncStorage.getItem(LOCATION_PING_QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<Partial<QueuedLocationPing> & LocationPingBody>;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      ...item,
      pingId: item.pingId ?? item.eventId,
      synced: item.synced === true,
      queuedAt: item.queuedAt ?? item.capturedAt,
    }));
  } catch {
    return [];
  }
}

async function writePingQueue(queue: QueuedLocationPing[]): Promise<void> {
  const trimmed = queue.filter((item) => !item.synced).slice(-MAX_QUEUED_PINGS);
  await AsyncStorage.setItem(LOCATION_PING_QUEUE_KEY, JSON.stringify(trimmed));
}

export async function getQueuedLocationPingCount(): Promise<number> {
  return (await readPingQueue()).length;
}

async function enqueueLocationPing(body: LocationPingBody): Promise<void> {
  const queue = await readPingQueue();
  queue.push({
    ...body,
    pingId: body.eventId,
    synced: false,
    queuedAt: new Date().toISOString(),
  });
  while (queue.length > MAX_QUEUED_PINGS) {
    queue.shift();
  }
  await writePingQueue(queue);
  scheduleQueueFlushRetry();
}

function scheduleQueueFlushRetry(): void {
  if (flushRetryTimer) return;
  const delay =
    QUEUE_FLUSH_BACKOFF_MS[Math.min(flushRetryAttempt, QUEUE_FLUSH_BACKOFF_MS.length - 1)] ??
    1_800_000;
  flushRetryTimer = setTimeout(() => {
    flushRetryTimer = undefined;
    void flushLocationPingQueue();
  }, delay);
}

function clearQueueFlushRetry(): void {
  flushRetryAttempt = 0;
  if (flushRetryTimer) {
    clearTimeout(flushRetryTimer);
    flushRetryTimer = undefined;
  }
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
  let lastError: unknown;
  for (let attempt = 1; attempt <= PING_MAX_RETRIES; attempt += 1) {
    try {
      await apiPost("/api/locations/ping", body, { skipSessionLogout: true });
      await markLastPingAt(body.capturedAt);
      return;
    } catch (err) {
      lastError = err;
      if (err instanceof ApiRequestError) {
        if (err.code === "OUTSIDE_TRACKING_HOURS" || err.code === "TRACKING_DISABLED") {
          throw err;
        }
      }
      if (attempt < PING_MAX_RETRIES) {
        await sleep(1000 * attempt);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("LOCATION_PING_FAILED");
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
  if (queue.length === 0) {
    clearQueueFlushRetry();
    return 0;
  }

  const unsynced = queue.filter((item) => !item.synced);
  if (unsynced.length === 0) {
    await writePingQueue([]);
    clearQueueFlushRetry();
    return 0;
  }

  const chunkSize = 100;
  let synced = 0;
  let remaining = [...unsynced];

  try {
    const ready = await prepareAuthForBackgroundPing();
    if (!ready) throw new Error("NO_AUTH");

    for (let offset = 0; offset < unsynced.length; offset += chunkSize) {
      const chunk = unsynced.slice(offset, offset + chunkSize);
      const result = await apiPost<BulkPingResult>(
        "/api/locations/ping/bulk",
        { items: chunk },
        { skipSessionLogout: true },
      );

      if (Array.isArray(result.acceptedEventIds)) {
        const accepted = new Set(result.acceptedEventIds);
        const rejectedOutside = new Set(result.rejectedOutsideHoursEventIds ?? []);
        const rejectedDisabled = new Set(result.rejectedDisabledEventIds ?? []);
        remaining = remaining.filter(
          (item) =>
            !accepted.has(item.eventId) &&
            !rejectedOutside.has(item.eventId) &&
            !rejectedDisabled.has(item.eventId),
        );
        synced += accepted.size;
        const lastAccepted = [...chunk].reverse().find((item) => accepted.has(item.eventId));
        if (lastAccepted) await markLastPingAt(lastAccepted.capturedAt);
      } else if ((result.outsideHours ?? 0) > 0) {
        throw new Error("BULK_PARTIAL_OUTSIDE_HOURS");
      } else {
        remaining = remaining.filter((item) => !chunk.some((c) => c.eventId === item.eventId));
        synced += chunk.length;
        const last = chunk[chunk.length - 1];
        if (last) await markLastPingAt(last.capturedAt);
      }
    }

    await writePingQueue(remaining);
    if (remaining.length === 0) {
      clearQueueFlushRetry();
    } else {
      flushRetryAttempt += 1;
      scheduleQueueFlushRetry();
    }
    return synced;
  } catch {
    // Fall back to serial flush.
  }

  remaining = [];
  for (let i = 0; i < unsynced.length; i += 1) {
    const item = unsynced[i];
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
      remaining.push(...unsynced.slice(i));
      break;
    }
  }
  await writePingQueue(remaining);
  if (remaining.length === 0) {
    clearQueueFlushRetry();
  } else {
    flushRetryAttempt += 1;
    scheduleQueueFlushRetry();
  }
  return synced;
}

async function sendLocationObject(
  loc: Location.LocationObject,
  source?: LocationPingSource,
): Promise<void> {
  if (!isLocationCollectionAllowed(new Date(loc.timestamp))) return;

  const [deviceId, networkStatus, batteryLevel] = await Promise.all([
    getOrCreateDeviceId(),
    currentNetworkStatus(),
    readBatteryLevel(),
  ]);

  const body: LocationPingBody = {
    eventId: createEventId(),
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: loc.coords.accuracy ?? null,
    capturedAt: new Date(loc.timestamp).toISOString(),
    deviceId,
    networkStatus,
    source: resolvePingSource(source),
    batteryLevel,
  };

  // NEVER drop a ping because there is no internet — store locally and sync later.
  if (networkStatus === "offline") {
    await enqueueLocationPing(body);
    return;
  }

  try {
    await postLocationPing(body);
    void flushLocationPingQueue();
  } catch {
    await enqueueLocationPing(body);
  }
}

function locationUpdateOptions(): Location.LocationTaskOptions {
  return {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: LOCATION_OS_INTERVAL_MS,
    distanceInterval: LOCATION_DISTANCE_FILTER_M,
    deferredUpdatesInterval: LOCATION_OS_INTERVAL_MS,
    deferredUpdatesDistance: LOCATION_DISTANCE_FILTER_M,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "PropNinja",
      notificationBody: "PropNinja is tracking your location for attendance",
      notificationColor: "#204060",
      killServiceOnDestroy: false,
    },
    pausesUpdatesAutomatically: false,
    ...(Platform.OS === "ios"
      ? {
          // iOS relaunches the app after reboot when location Always is granted.
          // Force-stop is an OS limitation — significant-change (~500m) is the fallback.
          activityType: Location.ActivityType.OtherNavigation,
        }
      : {}),
  };
}

async function pingCurrentPositionOnce(source?: LocationPingSource): Promise<void> {
  if (!isLocationCollectionAllowed()) return;
  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    await sendLocationObject(loc, source ?? resolvePingSource());
  } catch {
    // Best-effort
  }
}

export async function sendDeviceHeartbeat(options?: { force?: boolean }): Promise<void> {
  const force = options?.force === true;
  if (!force && Date.now() - lastHeartbeatAtMs < HEARTBEAT_MIN_GAP_MS) return;

  const [deviceId, networkStatus, batteryLevel, queuedCount, lastBootAt] = await Promise.all([
    getOrCreateDeviceId(),
    currentNetworkStatus(),
    readBatteryLevel(),
    getQueuedLocationPingCount(),
    getLastBootAtIso(),
  ]);
  try {
    await apiPost(
      "/api/locations/device/heartbeat",
      {
        deviceId,
        platform: Platform.OS === "ios" ? "ios" : "android",
        appVersion: getMobileAppVersion(),
        networkStatus,
        batteryLevel,
        queuedOfflinePingCount: queuedCount,
        lastBootAt,
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
  const source: LocationPingSource =
    AppState.currentState === "active" ? "foreground" : "background";
  if (loc) {
    await sendLocationObject(loc, source);
    return;
  }
  await pingCurrentPositionOnce(source);
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
  batteryOptimizationIgnored: boolean;
  lowPowerMode: boolean;
  allGranted: boolean;
};

export async function hasAlwaysAllowLocationPermission(): Promise<boolean> {
  const [foreground, background] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);
  return foreground.status === "granted" && background.status === "granted";
}

export async function isLowPowerModeOn(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try {
    return await Battery.isLowPowerModeEnabledAsync();
  } catch {
    return false;
  }
}

export async function checkRequiredWorkPermissions(): Promise<RequiredWorkPermissions> {
  const [locationGranted, callLogGranted, batteryOptimizationIgnored, lowPowerMode] =
    await Promise.all([
      hasAlwaysAllowLocationPermission(),
      hasCallLogPermission(),
      isIgnoringBatteryOptimizations(),
      isLowPowerModeOn(),
    ]);
  return {
    locationGranted,
    callLogGranted,
    batteryOptimizationIgnored,
    lowPowerMode,
    allGranted: locationGranted && callLogGranted && batteryOptimizationIgnored,
  };
}

export async function requestLocationPermissionsOnce(): Promise<boolean> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") return false;
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== "granted") return false;
  return hasAlwaysAllowLocationPermission();
}

export async function registerTrackingDevice(options?: {
  notifyPermissionDenied?: boolean;
}): Promise<void> {
  const [deviceId, installationId, perms, networkStatus, batteryLevel, queuedCount, lastBootAt] =
    await Promise.all([
      getOrCreateDeviceId(),
      getOrCreateInstallationId(),
      checkRequiredWorkPermissions(),
      currentNetworkStatus(),
      readBatteryLevel(),
      getQueuedLocationPingCount(),
      getLastBootAtIso(),
    ]);
  const deniedCount = perms.locationGranted
    ? 0
    : Number((await AsyncStorage.getItem(PERMISSION_DENIED_COUNT_KEY)) ?? "0") || 0;
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
        batteryLevel,
        heartbeat: true,
        queuedOfflinePingCount: queuedCount,
        lastBootAt,
        permissionDeniedCount: deniedCount,
        batteryOptimizationIgnored: perms.batteryOptimizationIgnored,
        notifyPermissionDenied: options?.notifyPermissionDenied === true,
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

/** Rule 1 — client re-evaluates permission/status every 5 minutes while tracking. */
function startStatusReevalLoop() {
  if (statusReevalTimer) return;
  statusReevalTimer = setInterval(
    () => {
      void checkRequiredWorkPermissions().then((perms) => {
        if (perms.locationGranted) {
          void ensureLocationUpdatesRunning();
          void sendDeviceHeartbeat({ force: true });
        }
      });
    },
    5 * 60 * 1000,
  );
}

function stopHeartbeatLoop() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = undefined;
  }
  if (statusReevalTimer) {
    clearInterval(statusReevalTimer);
    statusReevalTimer = undefined;
  }
  if (hoursResumeTimer) {
    clearTimeout(hoursResumeTimer);
    hoursResumeTimer = undefined;
  }
}

function msUntilNextIstWallClock(hour: number, minute: number, now = new Date()): number {
  const { hour: h, minute: m } = getIstHourMinute(now);
  let deltaMin = hour * 60 + minute - (h * 60 + m);
  if (deltaMin <= 1) deltaMin += 24 * 60;
  return deltaMin * 60_000;
}

/** Keep the FGS alive overnight; at 09:30 IST force a catch-up ping without agent action. */
function startHoursResumeAlarm() {
  if (hoursResumeTimer) clearTimeout(hoursResumeTimer);
  const delay = msUntilNextIstWallClock(9, 30);
  hoursResumeTimer = setTimeout(() => {
    hoursResumeTimer = undefined;
    void pingCurrentPositionOnce("background");
    void ensureLocationUpdatesRunning();
    startHoursResumeAlarm();
  }, delay);
}

export async function requestRequiredWorkPermissions(): Promise<RequiredWorkPermissions> {
  const locationGranted = await requestLocationPermissionsOnce();
  await requestCallLogPermission({ allowSkip: false });
  if (Platform.OS === "android" && locationGranted) {
    const ignoring = await isIgnoringBatteryOptimizations();
    if (!ignoring) {
      await requestIgnoreBatteryOptimizations();
    }
  }
  const all = await checkRequiredWorkPermissions();
  await markLocationConsentPrompted(all.allGranted);
  if (!all.locationGranted) {
    await incrementPermissionDeniedCount();
  } else {
    await AsyncStorage.setItem(PERMISSION_DENIED_COUNT_KEY, "0");
  }
  if (all.locationGranted) {
    await startLocationTracking();
  }
  return all;
}

export async function incrementPermissionDeniedCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(PERMISSION_DENIED_COUNT_KEY);
  const next = (Number(raw) || 0) + 1;
  await AsyncStorage.setItem(PERMISSION_DENIED_COUNT_KEY, String(next));
  if (next >= 3) {
    void registerTrackingDevice({ notifyPermissionDenied: true });
  }
  return next;
}

export async function getPermissionDeniedCount(): Promise<number> {
  return Number((await AsyncStorage.getItem(PERMISSION_DENIED_COUNT_KEY)) ?? "0") || 0;
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
    await pingCurrentPositionOnce("terminated");
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
    startStatusReevalLoop();
    startHoursResumeAlarm();
    await registerLocationWatchdog();
    await scheduleNativeTrackingWatchdog();

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
  clearQueueFlushRetry();
  if (hoursResumeTimer) {
    clearTimeout(hoursResumeTimer);
    hoursResumeTimer = undefined;
  }
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
