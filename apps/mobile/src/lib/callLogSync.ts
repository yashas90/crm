import { TRACKING_DEFAULTS } from "@propninja/types/tracking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";
import { apiPost } from "./apiClient";
import { hasCallLogPermission } from "./callLogNative";

const { CallLogModule } = NativeModules;

const SYNC_CURSOR_KEY = "propninja_call_log_sync_cursor_ms";
const DEVICE_ID_KEY = "propninja_tracking_device_id";

export type OsCallLogPermissionStatus = "granted" | "denied" | "UNAVAILABLE";

export type NativeCallRow = {
  callLogId: string;
  phoneNumber: string | null;
  callType: "INCOMING" | "OUTGOING" | "MISSED" | "REJECTED" | "UNKNOWN";
  callStartTimeMs: number;
  durationSeconds: number;
};

/** iOS and Expo Go builds cannot read OS call logs. */
export function getOsCallLogPermissionStatus(hasPermission: boolean): OsCallLogPermissionStatus {
  if (Platform.OS !== "android" || !CallLogModule?.getRecentCalls) {
    return "UNAVAILABLE";
  }
  return hasPermission ? "granted" : "denied";
}

async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const next = `dev_${Platform.OS}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, next);
  return next;
}

async function readCursorMs(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(SYNC_CURSOR_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function writeCursorMs(ms: number): Promise<void> {
  await AsyncStorage.setItem(SYNC_CURSOR_KEY, String(ms));
}

function retentionCutoffMs(now = Date.now()): number {
  return now - TRACKING_DEFAULTS.retentionDays * 24 * 60 * 60 * 1000;
}

async function fetchRecentNativeCalls(sinceMs: number): Promise<NativeCallRow[]> {
  if (!CallLogModule?.getRecentCalls) return [];
  try {
    const rows = (await CallLogModule.getRecentCalls(sinceMs, 500)) as NativeCallRow[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/**
 * Sync OS call-log metadata (Android only, permission required).
 * Initial sync: previous 14 days. Ongoing: only entries newer than local cursor.
 * Never records audio or conversations.
 */
export async function syncOsCallLogMetadata(): Promise<{
  status: OsCallLogPermissionStatus;
  uploaded: number;
}> {
  const permitted = await hasCallLogPermission();
  const status = getOsCallLogPermissionStatus(permitted);
  if (status !== "granted") {
    return { status, uploaded: 0 };
  }

  const cutoff = retentionCutoffMs();
  const cursor = await readCursorMs();
  const sinceMs = Math.max(cutoff, cursor ?? cutoff);
  const rows = await fetchRecentNativeCalls(sinceMs);
  if (rows.length === 0) {
    return { status, uploaded: 0 };
  }

  const deviceId = await getDeviceId();
  // Native returns newest-first; upload oldest-first for stable cursor.
  const chronological = [...rows].sort((a, b) => a.callStartTimeMs - b.callStartTimeMs);

  const items = chronological.map((row) => {
    const start = new Date(row.callStartTimeMs);
    const duration = Math.max(0, Math.floor(row.durationSeconds || 0));
    const end = duration > 0 ? new Date(row.callStartTimeMs + duration * 1000).toISOString() : null;
    return {
      eventId: `call_${deviceId}_${row.callLogId}`,
      deviceId,
      callLogId: row.callLogId,
      phoneNumber: row.phoneNumber,
      callType: row.callType || "UNKNOWN",
      callStartTime: start.toISOString(),
      callEndTime: end,
      durationSeconds: duration,
    };
  });

  // Chunk to match API max 200.
  let uploaded = 0;
  for (let i = 0; i < items.length; i += 200) {
    const chunk = items.slice(i, i + 200);
    await apiPost("/api/locations/call-logs/bulk", { items: chunk }, { skipSessionLogout: true });
    uploaded += chunk.length;
  }

  const newest = chronological[chronological.length - 1];
  if (newest) {
    await writeCursorMs(newest.callStartTimeMs);
  }

  return { status, uploaded };
}
