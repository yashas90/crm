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

export type LocationHistoryItem = {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
  batteryLevel?: number | null;
  networkStatus?: string | null;
};
