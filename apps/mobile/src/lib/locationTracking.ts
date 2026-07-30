import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { apiPost } from "./apiClient";

export const LOCATION_CONSENT_GIVEN_KEY = "location_consent_given";
/** Set after Enable or Ask Me Later — ensures OS/app prompt happens only once per install. */
export const LOCATION_CONSENT_PROMPTED_KEY = "location_consent_prompted";

const TASK_NAME = "PROPNINJA_LOCATION_TASK";
const PING_INTERVAL_MS = 2 * 60 * 1000;

export function isWorkHours(now: Date = new Date()): boolean {
  const istOffset = 5.5 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const istMinutes = (utcMinutes + istOffset) % (24 * 60);
  const istHour = Math.floor(istMinutes / 60);
  const day = new Date(now.getTime() + istOffset * 60_000).getUTCDay();
  const isWorkday = day >= 1 && day <= 6;
  return isWorkday && istHour >= 9 && istHour < 19;
}

TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  if (error) return;
  const payload = data as { locations?: Location.LocationObject[] } | undefined;
  if (!payload?.locations?.length) return;
  if (!isWorkHours()) return;

  const loc = payload.locations[0];
  if (!loc) return;

  try {
    await apiPost("/api/locations/ping", {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? null,
      capturedAt: new Date(loc.timestamp).toISOString(),
    });
  } catch {
    // Best effort — drop ping on error, do not retry
  }
});

export async function hasLocationConsentPromptBeenShown(): Promise<boolean> {
  const prompted = await AsyncStorage.getItem(LOCATION_CONSENT_PROMPTED_KEY);
  return prompted === "true";
}

export async function markLocationConsentPrompted(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(LOCATION_CONSENT_PROMPTED_KEY, "true");
  await AsyncStorage.setItem(LOCATION_CONSENT_GIVEN_KEY, enabled ? "true" : "false");
}

/** Request OS location permissions once (called only from the consent Enable action). */
export async function requestLocationPermissionsOnce(): Promise<boolean> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") return false;
  const background = await Location.requestBackgroundPermissionsAsync();
  return background.status === "granted";
}

export async function startLocationTracking() {
  const consent = await AsyncStorage.getItem(LOCATION_CONSENT_GIVEN_KEY);
  if (consent !== "true") return;

  const { status } = await Location.getBackgroundPermissionsAsync();
  if (status !== "granted") return;

  const isRunning = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
  if (isRunning) return;

  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: PING_INTERVAL_MS,
    distanceInterval: 50,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "PropNinja",
      notificationBody: "Location active during work hours",
      notificationColor: "#204060",
    },
    pausesUpdatesAutomatically: false,
  });
}

export async function stopLocationTracking() {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
  if (isRunning) await Location.stopLocationUpdatesAsync(TASK_NAME);
}
