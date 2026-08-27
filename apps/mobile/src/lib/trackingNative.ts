import { NativeModules, Platform } from "react-native";

const { TrackingNativeModule } = NativeModules as {
  TrackingNativeModule?: {
    isIgnoringBatteryOptimizations: () => Promise<boolean>;
    requestIgnoreBatteryOptimizations: () => Promise<boolean>;
    getLastBootAtMs: () => Promise<number>;
    scheduleWatchdog: () => Promise<boolean>;
  };
};

/** iOS has no battery-optimization toggle — treat as satisfied. */
export async function isIgnoringBatteryOptimizations(): Promise<boolean> {
  if (Platform.OS !== "android" || !TrackingNativeModule) return true;
  try {
    return await TrackingNativeModule.isIgnoringBatteryOptimizations();
  } catch {
    return true;
  }
}

export async function requestIgnoreBatteryOptimizations(): Promise<void> {
  if (Platform.OS !== "android" || !TrackingNativeModule) return;
  try {
    await TrackingNativeModule.requestIgnoreBatteryOptimizations();
  } catch {
    // Best-effort — OEM settings screens vary.
  }
}

export async function getLastBootAtIso(): Promise<string | null> {
  if (Platform.OS !== "android" || !TrackingNativeModule) return null;
  try {
    const ms = await TrackingNativeModule.getLastBootAtMs();
    if (!ms || ms <= 0) return null;
    return new Date(ms).toISOString();
  } catch {
    return null;
  }
}

export async function scheduleNativeTrackingWatchdog(): Promise<void> {
  if (Platform.OS !== "android" || !TrackingNativeModule) return;
  try {
    await TrackingNativeModule.scheduleWatchdog();
  } catch {
    // WorkManager may be unavailable on exotic OEMs.
  }
}
