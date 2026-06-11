import { Hono } from "hono";
import { jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import { markNotificationsReadSchema } from "../lib/validators/notifications.js";
import type { AuthUser } from "../middleware/auth.js";
import { createNotificationService } from "../services/notificationService.js";

export const notificationsRoutes = new Hono();

notificationsRoutes.get("/", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const service = createNotificationService(c.get("db"));
  const [items, unreadCount] = await Promise.all([
    service.listNotifications(authUser.id, 50),
    service.countUnread(authUser.id),
  ]);

  return jsonOk(c, { items, unreadCount });
});

notificationsRoutes.post("/mark-read", validate("json", markNotificationsReadSchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const { ids } = c.req.valid("json");
  const service = createNotificationService(c.get("db"));
  const marked = await service.markAsRead(authUser.id, ids);

  return jsonOk(c, { marked });
});
