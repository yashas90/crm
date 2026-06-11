import { z } from "zod";

export const listAuditLogsQuerySchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  userId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
