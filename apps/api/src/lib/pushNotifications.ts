import { users } from "@propninja/db";
import { eq } from "drizzle-orm";
import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";
import type { Database } from "./db.js";
import { logger } from "./logger.js";

let expoClient: Expo | undefined;

function getExpoClient(): Expo {
  if (!expoClient) {
    expoClient = new Expo();
  }
  return expoClient;
}

export async function clearPushToken(db: Database, userId: string): Promise<void> {
  await db.update(users).set({ expoPushToken: null }).where(eq(users.id, userId));
}

export type SendPushResult =
  | { sent: true }
  | { sent: false; reason: "no_token" | "invalid_token" | "ticket_error" | "no_ticket" };

export const LEADS_PUSH_CHANNEL_ID = "alerts_swish";
export const PUSH_NOTIFICATION_SOUND = "notification_swish.mp3";

export async function sendPushNotification(
  db: Database,
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<SendPushResult> {
  const [user] = await db
    .select({ expoPushToken: users.expoPushToken })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const token = user?.expoPushToken?.trim();
  if (!token) {
    return { sent: false, reason: "no_token" };
  }

  if (!Expo.isExpoPushToken(token)) {
    logger.warn("Invalid Expo push token format", { userId });
    await clearPushToken(db, userId);
    return { sent: false, reason: "invalid_token" };
  }

  const message: ExpoPushMessage = {
    to: token,
    title,
    body,
    data: data ?? {},
    sound: PUSH_NOTIFICATION_SOUND,
    priority: "high",
    channelId: LEADS_PUSH_CHANNEL_ID,
  };

  let tickets: ExpoPushTicket[];
  try {
    tickets = await getExpoClient().sendPushNotificationsAsync([message]);
  } catch (error) {
    logger.error("Expo push send failed", {
      userId,
      message: error instanceof Error ? error.message : String(error),
    });
    return { sent: false, reason: "ticket_error" };
  }

  const ticket = tickets[0];
  if (!ticket) {
    return { sent: false, reason: "no_ticket" };
  }

  if (ticket.status === "error") {
    if (ticket.details?.error === "DeviceNotRegistered") {
      await clearPushToken(db, userId);
      logger.info("Cleared stale Expo push token", { userId });
    } else {
      logger.warn("Expo push ticket error", {
        userId,
        error: ticket.message,
        details: ticket.details,
      });
    }
    return { sent: false, reason: "ticket_error" };
  }

  return { sent: true };
}
