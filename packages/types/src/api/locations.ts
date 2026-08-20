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
  deviceStatus?: string | null;
  locationPermissionStatus?: string | null;
  callLogPermissionStatus?: string | null;
  devicePlatform?: string | null;
  appVersion?: string | null;
  minutesSinceLastPing?: number | null;
  isLastKnown?: boolean;
  locationLabel?: "CURRENT_LOCATION" | "LAST_KNOWN_LOCATION";
  trackingPolicyEnabled?: boolean;
  withinHours?: boolean;
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
