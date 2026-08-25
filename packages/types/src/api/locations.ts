export type AgentLocationPing = {
  userId: string;
  name: string;
  email: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
  batteryLevel?: number | null;
  networkStatus?: string | null;
  trackingStatus?: "active" | "inactive" | "outside_hours" | "permission_denied" | "stale";
  locationPermissionStatus?: string | null;
  callLogPermissionStatus?: string | null;
  devicePlatform?: string | null;
  appVersion?: string | null;
  minutesSinceLastPing?: number | null;
};

/** Latest registered PropNinja device heartbeat (may exist even with no GPS ping). */
export type AgentTrackingDevice = {
  userId: string;
  name: string;
  email: string;
  deviceId: string;
  platform: string;
  appVersion: string | null;
  locationPermissionStatus: string | null;
  callLogPermissionStatus: string | null;
  trackingEnabled: boolean;
  lastSeenAt: string;
  networkStatus: string | null;
  batteryLevel: number | null;
  minutesSinceDeviceSeen: number;
};

export type LocationHistoryItem = {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
  batteryLevel?: number | null;
  networkStatus?: string | null;
};
