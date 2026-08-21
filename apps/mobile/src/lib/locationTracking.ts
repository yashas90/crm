import { isWithinTrackingHours } from "@propninja/types/tracking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Linking, Platform } from "react-native";
import { getApiBaseUrl } from "./apiBaseUrl";
import { apiPost } from "./apiClient";
import { getMobileAppVersion, getMobileClientHeaders } from "./appVersion";
import { ensureAuthCacheLoaded, getRefreshToken, getToken, updateTokens } from "./auth";
import { hasCallLogPermission, requestCallLogPermission } from "./callLogNative";
import { getOsCallLogPermissionStatus, syncOsCallLogMetadata } from "./callLogSync";
import { isTokenExpired } from "./jwt";

export const LOCATION_CONSENT_GIVEN_KEY = "location_consent_given";
/** Bumped when required-permission gate / schedule copy changes. */
export const LOCATION_CONSENT_PROMPTED_KEY = "location_consent_prompted_v6";

const TASK_NAME = "PROPNINJA_LOCATION_TASK";
/** Office wants a position at least every 30 minutes during working hours. */
export const PING_INTERVAL_MS = 30 * 60 * 1000;
/** Force a catch-up GPS ping when the last successful upload is this old. */
export const LOCATION_CATCHUP_AFTER_MS = 25 * 60 * 1000;
/** Restart the native FGS task if no ping landed within interval + grace (OS often stalls). */
export const LOCATION_OVERDUE_RESTART_MS = 35 * 60 * 1000;
const LOCATION_PING_QUEUE_KEY = "propninja_pending_location_pings";
const LAST_PING_AT_KEY = "propninja_last_location_ping_at";
const DEVICE_ID_KEY = "propninja_tracking_device_id";
const MAX_QUEUED_PINGS = 200;

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
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const next = `dev_${Platform.OS}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, next);
  return next;
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

  const refreshToken = getRefreshToken();
  if (!refreshToken) return Boolean(token);

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...getMobileClientHeaders(),
      },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return false;
    const json = (await response.json()) as {
      ok: boolean;
      data?: { token: string; refreshToken: string };
    };
    if (!json.ok || !json.data?.token) return false;
    await updateTokens(json.data.token, json.data.refreshToken);
    return true;
  } catch {
    return Boolean(getToken());
  }
}

async function postLocationPing(body: LocationPingBody): Promise<void> {
  const ready = await prepareAuthForBackgroundPing();
  if (!ready && !getToken()) {
    throw new Error("NO_AUTH");
  }
  await apiPost("/api/locations/ping", body, { skipSessionLogout: true });
  await markLastPingAt(body.capturedAt);
}

/** Flush queued location pings (network restore / app foreground). Prefer bulk when possible. */
export async function flushLocationPingQueue(): Promise<number> {
  const queue = await readPingQueue();
  if (queue.length === 0) return 0;

  try {
    await prepareAuthForBackgroundPing();
    await apiPost("/api/locations/ping/bulk", { items: queue }, { skipSessionLogout: true });
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
    } catch {
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

  const body: LocationPingBody = {
    eventId: createEventId(),
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: loc.coords.accuracy ?? null,
    capturedAt: new Date(loc.timestamp).toISOString(),
    deviceId: await getOrCreateDeviceId(),
    networkStatus: await currentNetworkStatus(),
    source,
  };

  try {
    await postLocationPing(body);
    await flushLocationPingQueue();
  } catch {
    await enqueueLocationPing(body);
  }
}

TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  if (error) return;
  const payload = data as { locations?: Location.LocationObject[] } | undefined;
  if (!payload?.locations?.length) return;
  if (!isLocationCollectionAllowed()) return;

  const loc = payload.locations[0];
  if (!loc) return;
  await sendLocationObject(loc);
});

export type RequiredWorkPermissions = {
  /** True only for OS “Allow all the time” / Always. */
  locationGranted: boolean;
  callLogGranted: boolean;
  allGranted: boolean;
};

export async function hasAlwaysAllowLocationPermission(): Promise<boolean> {
  const foreground = await Location.getForegroundPermissionsAsync();
  const background = await Location.getBackgroundPermissionsAsync();
  return foreground.status === "granted" && background.status === "granted";
}

export async function checkRequiredWorkPermissions(): Promise<RequiredWorkPermissions> {
  const locationGranted = await hasAlwaysAllowLocationPermission();
  const callLogGranted = await hasCallLogPermission();
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
  const deviceId = await getOrCreateDeviceId();
  const perms = await checkRequiredWorkPermissions();
  try {
    await apiPost(
      "/api/locations/device",
      {
        deviceId,
        platform: Platform.OS === "ios" ? "ios" : "android",
        appVersion: getMobileAppVersion(),
        locationPermissionStatus: perms.locationGranted ? "granted" : "denied",
        callLogPermissionStatus: getOsCallLogPermissionStatus(perms.callLogGranted),
        trackingEnabled: perms.allGranted && isLocationCollectionAllowed(),
        networkStatus: await currentNetworkStatus(),
      },
      { skipSessionLogout: true },
    );
  } catch {
    // Best-effort heartbeat.
  }
}

export async function requestRequiredWorkPermissions(): Promise<RequiredWorkPermissions> {
  const locationGranted = await requestLocationPermissionsOnce();
  const callLogGranted = await requestCallLogPermission({ allowSkip: false });
  const allGranted = locationGranted && callLogGranted;
  await markLocationConsentPrompted(allGranted);
  if (allGranted) {
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

function locationUpdateOptions(): Location.LocationTaskOptions {
  return {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: PING_INTERVAL_MS,
    // Time-based even when stationary — distance>0 was skipping office dwells.
    distanceInterval: 0,
    // Do not ask the OS to further batch deliveries past our 30m cadence.
    deferredUpdatesInterval: 0,
    deferredUpdatesDistance: 0,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "PropNinja",
      notificationBody: "Sharing location with your office every 30 minutes (9:30 AM–8:30 PM IST)",
      notificationColor: "#204060",
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

export async function startLocationTracking() {
  if (!(await hasAlwaysAllowLocationPermission())) return;

  await AsyncStorage.setItem(LOCATION_CONSENT_GIVEN_KEY, "true");
  await ensureAuthCacheLoaded();
  void registerTrackingDevice();

  if (!isLocationCollectionAllowed()) {
    // Outside hours: stop any running updates so we do not collect overnight.
    const running = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
    if (running) await Location.stopLocationUpdatesAsync(TASK_NAME).catch(() => undefined);
    void flushLocationPingQueue();
    return;
  }

  const lastAgeMs = await readLastPingAgeMs();
  const ageMs = lastAgeMs ?? Number.POSITIVE_INFINITY;
  const overdueForRestart = ageMs >= LOCATION_OVERDUE_RESTART_MS;
  const needsCatchUp = ageMs >= LOCATION_CATCHUP_AFTER_MS;

  const isRunning = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
  // Skip stop/restart when healthy (avoids dialer-return hitch). If the last ping is overdue,
  // the OS likely stopped delivering — restart the foreground-service task.
  if (isRunning && overdueForRestart) {
    await Location.stopLocationUpdatesAsync(TASK_NAME).catch(() => undefined);
    await Location.startLocationUpdatesAsync(TASK_NAME, locationUpdateOptions());
  } else if (!isRunning) {
    await Location.startLocationUpdatesAsync(TASK_NAME, locationUpdateOptions());
  }

  if (needsCatchUp) {
    // Bypass the 60s debounce so a stale agent gets an immediate office ping.
    lastForegroundSyncAt = 0;
  }
  await maybeForegroundSync();
}

/** Test helper */
export function resetForegroundSyncDebounceForTests(): void {
  lastForegroundSyncAt = 0;
}

export async function stopLocationTracking() {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
  if (isRunning) await Location.stopLocationUpdatesAsync(TASK_NAME);
}
