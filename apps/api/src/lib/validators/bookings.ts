import { z } from "zod";
import { paginationSchema } from "./common.js";

export const listBookingsQuerySchema = paginationSchema.extend({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  projectId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
});

export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;
