import { apiPost } from "@/lib/apiClient";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "site-visit-feedback-queue";

export type QueuedVisitPayload = {
  visitId: string;
  kind: "feedback" | "checkout";
  body: Record<string, unknown>;
};

export async function enqueueVisitPayload(item: QueuedVisitPayload) {
  const raw = await AsyncStorage.getItem(KEY);
  const items = raw ? (JSON.parse(raw) as QueuedVisitPayload[]) : [];
  items.push(item);
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function flushVisitPayloadQueue() {
  const raw = await AsyncStorage.getItem(KEY);
  const items = raw ? (JSON.parse(raw) as QueuedVisitPayload[]) : [];
  if (items.length === 0) return;
  const remaining: QueuedVisitPayload[] = [];
  for (const item of items) {
    const path =
      item.kind === "feedback"
        ? `/api/site-visits/${item.visitId}/feedback`
        : `/api/site-visits/${item.visitId}/checkout`;
    try {
      await apiPost(path, item.body);
    } catch {
      remaining.push(item);
    }
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(remaining));
}
