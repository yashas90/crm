import { NativeModules, PermissionsAndroid, Platform } from "react-native";

const { CallLogModule } = NativeModules;

/** Request READ_CALL_LOG at runtime. Returns true if granted. */
export async function requestCallLogPermission(): Promise<boolean> {
  if (Platform.OS !== "android" || !CallLogModule) return false;
  const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
  if (already) return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG, {
    title: "Call log access",
    message:
      "PropNinja needs access to your call log to track talk time accurately and show managers who you called.",
    buttonPositive: "Allow",
    buttonNegative: "Not now",
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * Returns the actual talk duration (seconds) of the most recent outgoing call
 * to `phoneNumber` that started at or after `afterTimestampMs`.
 *
 * Android's CallLog.Calls.DURATION stores only talk time — ring time is NOT included.
 * Returns null if permission is denied, no matching call found, or on non-Android platforms.
 */
export async function getOutgoingCallTalkSeconds(
  phoneNumber: string,
  afterTimestampMs: number,
): Promise<number | null> {
  if (Platform.OS !== "android" || !CallLogModule) return null;
  try {
    const duration = await (CallLogModule.getLastCallDuration(
      phoneNumber,
      afterTimestampMs,
    ) as Promise<number | null>);
    if (duration == null || duration <= 0) return null;
    return duration;
  } catch {
    return null;
  }
}
