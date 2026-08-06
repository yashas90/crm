import { NativeModules, PermissionsAndroid, Platform } from "react-native";

const { CallLogModule } = NativeModules;

export async function hasCallLogPermission(): Promise<boolean> {
  // Non-Android or builds without the native module cannot use call log — do not block login.
  if (Platform.OS !== "android") return true;
  if (!CallLogModule) return true;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
}

type RequestOpts = {
  /** When false, negative button still denies — caller must keep blocking the app. */
  allowSkip?: boolean;
};

/** Request READ_CALL_LOG at runtime. Returns true if granted. */
export async function requestCallLogPermission(opts: RequestOpts = {}): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  if (!CallLogModule) return true;
  const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
  if (already) return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG, {
    title: "Phone permission required",
    message:
      "PropNinja needs call log access to record accurate call duration when you dial a lead. This is required to use the app.",
    buttonPositive: "Allow",
    buttonNegative: opts.allowSkip === false ? "Deny" : "Not now",
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
