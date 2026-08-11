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
 * True only for known emulator/simulator hosts. Sideloaded APKs on real phones
 * must never hit 10.0.2.2 / localhost (those hang until timeout).
 */
function isLocalDevHost(): boolean {
  // Expo Go / Metro session — not a standalone installable APK.
  const ownership = Constants.appOwnership;
  if (ownership === "expo") return true;

  // Prefer executionEnvironment when available (standalone | storeClient | bare).
  const execution = (Constants as { executionEnvironment?: string }).executionEnvironment;
  if (execution === "storeClient") return true;
  if (execution === "standalone" || execution === "bare") return false;

  // Fallback: real device vs emulator.
  return Constants.isDevice === false;
}

/**
 * Dev base URL when no EXPO_PUBLIC_API_URL is set:
 * - Expo Go / emulator → localhost bridge
 * - Physical sideloaded APK → production API
 */
function resolveDevApiBaseUrl(): string {
  const explicit = configuredApiUrl();
  if (explicit) return explicit;

  // Standalone / bare installs (including debug APKs shared with agents) always
  // talk to production unless EXPO_PUBLIC_API_URL was baked in at bundle time.
  if (!isLocalDevHost()) {
    return PRODUCTION_API_URL;
  }

  if (Platform.OS === "android") {
    return `http://10.0.2.2:${DEV_API_PORT}`;
  }

  return `http://localhost:${DEV_API_PORT}`;
}

function resolveReleaseApiBaseUrl(): string {
  return configuredApiUrl() ?? PRODUCTION_API_URL;
}

/**
 * Resolved API origin for the current build.
 * - Prefer EXPO_PUBLIC_API_URL / expo.extra.apiUrl when present (baked into APKs)
 * - Never use emulator localhost for sideloaded physical-device APKs
 */
export function getApiBaseUrl(): string {
  const explicit = configuredApiUrl();
  if (explicit) return explicit;

  if (__DEV__) {
    return resolveDevApiBaseUrl();
  }

  return resolveReleaseApiBaseUrl();
}
