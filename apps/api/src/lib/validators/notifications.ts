import { z } from "zod";

export const markNotificationsReadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});
