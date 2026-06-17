import JailMonkey from "jail-monkey";
import { Platform } from "react-native";

export type DeviceSecurityInfo = {
  platform: string;
  isJailBroken: boolean;
  canMockLocation: boolean;
  trustFall: boolean;
  isOnExternalStorage: boolean;
};

export function isDeviceCompromised(): boolean {
  try {
    return Boolean(JailMonkey.isJailBroken?.() ?? JailMonkey.isJailBroken);
  } catch {
    return false;
  }
}

export function collectDeviceSecurityInfo(): DeviceSecurityInfo {
  const isJailBroken = Boolean(JailMonkey.isJailBroken?.() ?? JailMonkey.isJailBroken);
  const canMockLocation = Boolean(JailMonkey.canMockLocation?.() ?? JailMonkey.canMockLocation);
  const trustFall = Boolean(JailMonkey.trustFall?.() ?? JailMonkey.trustFall);
  const isOnExternalStorage = Boolean(
    JailMonkey.isOnExternalStorage?.() ?? JailMonkey.isOnExternalStorage,
  );

  return {
    platform: Platform.OS,
    isJailBroken,
    canMockLocation,
    trustFall,
    isOnExternalStorage,
  };
}
