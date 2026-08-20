import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Linking } from "react-native";
import { getApiBaseUrl } from "./apiBaseUrl";
import { apiPost } from "./apiClient";
import { getMobileClientHeaders } from "./appVersion";
import { ensureAuthCacheLoaded, getRefreshToken, getToken, updateTokens } from "./auth";
import { hasCallLogPermission, requestCallLogPermission } from "./callLogNative";
import { isTokenExpired } from "./jwt";

export const LOCATION_CONSENT_GIVEN_KEY = "location_consent_given";
/** Bumped when required-permission gate changes — forces re-check for all agents. */
export const LOCATION_CONSENT_PROMPTED_KEY = "location_consent_prompted_v4";

const TASK_NAME = "PROPNINJA_LOCATION_TASK";
/** Office wants a position at least every 30 minutes even when the agent is idle. */
export const PING_INTERVAL_MS = 30 * 60 * 1000;
const LOCATION_PING_QUEUE_KEY = "propninja_pending_location_pings";
const LAST_PING_AT_KEY = "propninja_last_location_ping_at";
const MAX_QUEUED_PINGS = 200;

type LocationPingBody = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
};

/**
 * Location is collected every day, all day (IST). Kept as a named helper so call sites
 * and tests stay explicit — always returns true.
 */
export function isLocationCollectionAllowed(_now: Date = new Date()): boolean {
  return true;
}

/** @deprecated Use isLocationCollectionAllowed — work-hours gate removed. */
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

/** Ensure JWT is available in background JS contexts (cache may be empty). */
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

/** Flush queued location pings (network restore / app foreground). */
export async function flushLocationPingQueue(): Promise<number> {
  const queue = await readPingQueue();
  if (queue.length === 0) return 0;

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

async function sendLocationObject(loc: Location.LocationObject): Promise<void> {
  const body: LocationPingBody = {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: loc.coords.accuracy ?? null,
    capturedAt: new Date(loc.timestamp).toISOString(),
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
  locationGranted: boolean;
  callLogGranted: boolean;
  /** True when the agent may enter the app. */
  allGranted: boolean;
};

/** Check OS permissions required before CRM work (Android: location + call log). */
export async function checkRequiredWorkPermissions(): Promise<RequiredWorkPermissions> {
  const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
  const locationGranted = bgStatus === "granted";
  const callLogGranted = await hasCallLogPermission();
  return {
    locationGranted,
    callLogGranted,
    allGranted: locationGranted && callLogGranted,
  };
}

/** Request foreground then background location. Returns true only if background is granted. */
export async function requestLocationPermissionsOnce(): Promise<boolean> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") return false;
  const background = await Location.requestBackgroundPermissionsAsync();
  return background.status === "granted";
}

/** Request location + call log. Returns current grant state after prompts. */
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
    // Android: time-based cadence. distanceInterval 0 = still send when stationary.
    timeInterval: PING_INTERVAL_MS,
    distanceInterval: 0,
    deferredUpdatesInterval: PING_INTERVAL_MS,
    deferredUpdatesDistance: 0,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "PropNinja",
      notificationBody: "Sharing location with your office every 30 minutes",
      notificationColor: "#204060",
    },
    pausesUpdatesAutomatically: false,
  };
}

/** One immediate fix so “Last seen” updates when the agent opens the app. */
async function pingCurrentPositionOnce(): Promise<void> {
  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    await sendLocationObject(loc);
  } catch {
    // Best-effort — background updates still continue.
  }
}

export async function startLocationTracking() {
  const { status } = await Location.getBackgroundPermissionsAsync();
  if (status !== "granted") return;

  await AsyncStorage.setItem(LOCATION_CONSENT_GIVEN_KEY, "true");
  await ensureAuthCacheLoaded();

  const isRunning = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
  // Always stop+restart so OEM-killed services and interval config changes take effect.
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(TASK_NAME).catch(() => undefined);
  }

  await Location.startLocationUpdatesAsync(TASK_NAME, locationUpdateOptions());

  void flushLocationPingQueue();
  void pingCurrentPositionOnce();
}

export async function stopLocationTracking() {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
  if (isRunning) await Location.stopLocationUpdatesAsync(TASK_NAME);
}
