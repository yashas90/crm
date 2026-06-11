import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Production API used by EAS release builds (iOS + Android).
 * Override with EXPO_PUBLIC_API_URL in eas.json or .env for staging.
 */
export const DEFAULT_PRODUCTION_API_URL = "https://crm-production-6cfe.up.railway.app";

const DEV_API_PORT = process.env.EXPO_PUBLIC_API_PORT ?? "3001";

/**
 * Dev base URL when no EXPO_PUBLIC_API_URL is set:
 * - iOS Simulator → host machine localhost
 * - Android Emulator → 10.0.2.2 (maps to host localhost)
 * - Physical device → set EXPO_PUBLIC_API_URL to http://<LAN_IP>:3001
 */
function resolveDevApiBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  if (Platform.OS === "android") {
    const isEmulator = Constants.isDevice === false;
    if (isEmulator) {
      return `http://10.0.2.2:${DEV_API_PORT}`;
    }
  }

  // iOS Simulator and default fallback
  return `http://localhost:${DEV_API_PORT}`;
}

let releaseFallbackWarned = false;

function resolveReleaseApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (!releaseFallbackWarned) {
    releaseFallbackWarned = true;
    console.warn(
      `[PropNinja] EXPO_PUBLIC_API_URL is not set; falling back to ${DEFAULT_PRODUCTION_API_URL}. Set EXPO_PUBLIC_API_URL in eas.json (preview/production) before the next EAS build if the API domain changes.`,
    );
  }

  return DEFAULT_PRODUCTION_API_URL;
}

/**
 * Resolved API origin for the current build.
 * - __DEV__: platform-aware localhost / emulator host (see above)
 * - Release: EXPO_PUBLIC_API_URL when set, otherwise DEFAULT_PRODUCTION_API_URL
 */
export function getApiBaseUrl(): string {
  if (__DEV__) {
    return resolveDevApiBaseUrl();
  }

  return resolveReleaseApiBaseUrl();
}
