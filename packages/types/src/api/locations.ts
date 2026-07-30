export type AgentLocationPing = {
  userId: string;
  name: string;
  email: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
};

export type LocationHistoryItem = {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
};
