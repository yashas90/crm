import { apiFetch } from "@/lib/apiClient";
import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "propninja_pending_call_logs";

export type QueuedRequest = {
  id: string;
  method: "POST" | "PATCH";
  path: string;
  body: unknown;
  createdAt: string;
};

async function readQueue(): Promise<QueuedRequest[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as QueuedRequest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedRequest[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function getOfflineQueueLength(): Promise<number> {
  return (await readQueue()).length;
}

export async function enqueueRequest(
  request: Pick<QueuedRequest, "method" | "path" | "body">,
): Promise<void> {
  const queue = await readQueue();
  queue.push({
    ...request,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
  });
  await writeQueue(queue);
}

export async function flushOfflineQueue(): Promise<number> {
  const queue = await readQueue();
  if (queue.length === 0) return 0;

  let synced = 0;
  const remaining: QueuedRequest[] = [];

  for (let i = 0; i < queue.length; i += 1) {
    const item = queue[i];
    try {
      await apiFetch(item.path, {
        method: item.method,
        body: JSON.stringify(item.body),
        skipOfflineQueue: true,
      });
      synced += 1;
    } catch {
      remaining.push(...queue.slice(i));
      break;
    }
  }

  await writeQueue(remaining);
  return synced;
}
