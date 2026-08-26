export type AgentLocationPing = {
  userId: string;
  name: string;
  email: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  capturedAt: string | null;
  lastSeenAt?: string | null;
  lastHeartbeatAt?: string | null;
  lastLocationAt?: string | null;
  batteryLevel?: number | null;
  networkStatus?: string | null;
  trackingStatus?: string;
  healthStatus?: string | null;
  /** Spec enum: active | stale | offline */
  agentStatus?: "active" | "stale" | "offline" | string | null;
  deviceStatus?: string | null;
  locationPermissionStatus?: string | null;
  callLogPermissionStatus?: string | null;
  devicePlatform?: string | null;
  appVersion?: string | null;
  minutesSinceLastPing?: number | null;
  isLastKnown?: boolean;
  isStale?: boolean;
  locationLabel?: "CURRENT_LOCATION" | "LAST_KNOWN_LOCATION";
  trackingPolicyEnabled?: boolean;
  withinHours?: boolean;
  /** Reverse-geocoded address when available (client may fill). */
  address?: string | null;
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
