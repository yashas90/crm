import Constants from "expo-constants";
import { Platform } from "react-native";

const DEV_API_PORT = process.env.EXPO_PUBLIC_API_PORT ?? "3001";

/** Must match app.config.ts and eas.json — Mumbai production API. */
export const PRODUCTION_API_URL = "https://crm-production-e81d.up.railway.app";

type ExpoExtra = {
  apiUrl?: string;
};

function configuredApiUrl(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const fromExtra = (Constants.expoConfig?.extra as ExpoExtra | undefined)?.apiUrl?.trim();
  if (fromExtra) return fromExtra.replace(/\/$/, "");

  return undefined;
}

/**
 * Dev base URL when no EXPO_PUBLIC_API_URL is set:
 * - iOS Simulator → host machine localhost
 * - Android Emulator → 10.0.2.2 (maps to host localhost)
 * - Physical device → set EXPO_PUBLIC_API_URL to http://<LAN_IP>:3001
 */
function resolveDevApiBaseUrl(): string {
  const explicit = configuredApiUrl();
  if (explicit) return explicit;

  if (Platform.OS === "android") {
    const isEmulator = Constants.isDevice === false;
    if (isEmulator) {
      return `http://10.0.2.2:${DEV_API_PORT}`;
    }
  }

  return `http://localhost:${DEV_API_PORT}`;
}

function resolveReleaseApiBaseUrl(): string {
  return configuredApiUrl() ?? PRODUCTION_API_URL;
}

/**
 * Resolved API origin for the current build.
 * - __DEV__: platform-aware localhost / emulator host, or EXPO_PUBLIC_API_URL when set
 * - Release: EXPO_PUBLIC_API_URL (or expo.extra.apiUrl from app.config at build time)
 */
export function getApiBaseUrl(): string {
  if (__DEV__) {
    return resolveDevApiBaseUrl();
  }

  return resolveReleaseApiBaseUrl();
}
