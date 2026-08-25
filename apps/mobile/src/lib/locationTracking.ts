import { isWithinTrackingHours } from "@propninja/types/tracking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Linking, Platform } from "react-native";
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
  acceptedEventIds?: string[];
  rejectedOutsideHoursEventIds?: string[];
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
      const remaining = queue.filter(
        (item) => !accepted.has(item.eventId) && !rejectedOutside.has(item.eventId),
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
      const outsideHours = err instanceof ApiRequestError && err.code === "OUTSIDE_TRACKING_HOURS";
      if (outsideHours) {
        // Discard — do not keep forever.
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
        // Location tracking runs whenever Always location is granted — call-log is separate.
        trackingEnabled: perms.locationGranted,
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
  // Start GPS as soon as Always location is granted — do not wait on call-log.
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

  // Keep the foreground-service task running around the clock so Android does not
  // silently drop deliveries overnight. Uploads still skip outside 09:30–20:30 IST.
  const lastAgeMs = await readLastPingAgeMs();
  const ageMs = lastAgeMs ?? Number.POSITIVE_INFINITY;
  const overdueForRestart = ageMs >= LOCATION_OVERDUE_RESTART_MS;
  const needsCatchUp = isLocationCollectionAllowed() && ageMs >= LOCATION_CATCHUP_AFTER_MS;

  const isRunning = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
  if (isRunning && overdueForRestart) {
    await Location.stopLocationUpdatesAsync(TASK_NAME).catch(() => undefined);
    await Location.startLocationUpdatesAsync(TASK_NAME, locationUpdateOptions());
  } else if (!isRunning) {
    await Location.startLocationUpdatesAsync(TASK_NAME, locationUpdateOptions());
  }

  void flushLocationPingQueue();
  if (needsCatchUp) {
    lastForegroundSyncAt = 0;
    await maybeForegroundSync();
  } else if (isLocationCollectionAllowed()) {
    await maybeForegroundSync();
  }
}

/** Test helper */
export function resetForegroundSyncDebounceForTests(): void {
  lastForegroundSyncAt = 0;
}

export async function stopLocationTracking() {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
  if (isRunning) await Location.stopLocationUpdatesAsync(TASK_NAME);
}
