import { NativeModules, PermissionsAndroid, Platform } from "react-native";

type CallLogModuleShape = {
  getLastCallDuration: (phoneNumber: string, afterTimestampMs: number) => Promise<number | null>;
};

function getCallLogModule(): CallLogModuleShape | undefined {
  return NativeModules.CallLogModule as CallLogModuleShape | undefined;
}

export async function hasCallLogPermission(): Promise<boolean> {
  // Non-Android or builds without the native module cannot use call log — do not block login.
  if (Platform.OS !== "android") return true;
  if (!getCallLogModule()) return true;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
}

type RequestOpts = {
  /** When false, negative button still denies — caller must keep blocking the app. */
  allowSkip?: boolean;
};

/** Request READ_CALL_LOG at runtime. Returns true if granted. */
export async function requestCallLogPermission(opts: RequestOpts = {}): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  if (!getCallLogModule()) return true;
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

function parseTalkSeconds(duration: number | null | undefined): number | null {
  if (duration == null) return null;
  const seconds = Math.floor(Number(duration));
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return seconds;
}

/**
 * Returns the actual talk duration (seconds) of the most recent outgoing call
 * to `phoneNumber` that started at or after `afterTimestampMs`.
 *
 * Android's CallLog.Calls.DURATION stores only talk time — ring time is NOT included.
 * Returns 0 when the matching outgoing call exists but was never answered.
 * Returns null if permission is denied, no matching call found, or on non-Android platforms.
 */
export async function getOutgoingCallTalkSeconds(
  phoneNumber: string,
  afterTimestampMs: number,
): Promise<number | null> {
  const CallLogModule = getCallLogModule();
  if (Platform.OS !== "android" || !CallLogModule) return null;
  try {
    const duration = await CallLogModule.getLastCallDuration(phoneNumber, afterTimestampMs);
    return parseTalkSeconds(duration);
  } catch {
    return null;
  }
}

/** Android often writes the CallLog row a moment after the in-call UI closes. */
export const NATIVE_TALK_RETRY_DELAYS_MS = [2000, 2500, 3000];

/**
 * Wait for the OS call-log row, retrying when it has not been flushed yet.
 * A read of 0 (not answered) is final and is not retried.
 */
export async function waitForOutgoingCallTalkSeconds(
  phoneNumber: string,
  afterTimestampMs: number,
  delaysMs: number[] = NATIVE_TALK_RETRY_DELAYS_MS,
): Promise<number | null> {
  let last: number | null = null;
  for (const delay of delaysMs) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    last = await getOutgoingCallTalkSeconds(phoneNumber, afterTimestampMs);
    if (last != null) return last;
  }
  return last;
}
