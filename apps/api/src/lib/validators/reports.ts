import { z } from "zod";

const MS_PER_DAY = 86_400_000;

function defaultDateRange(dateFrom?: string, dateTo?: string) {
  const to = dateTo ? new Date(dateTo) : new Date();
  const from = dateFrom ? new Date(dateFrom) : new Date(to.getTime() - 7 * MS_PER_DAY);
  return { dateFrom: from, dateTo: to };
}

export const dashboardReportQuerySchema = z
  .object({
    date_from: z.string().datetime({ offset: true }).optional(),
    date_to: z.string().datetime({ offset: true }).optional(),
    user_id: z.string().uuid().optional(),
  })
  .transform((value) => ({
    ...defaultDateRange(value.date_from, value.date_to),
    userId: value.user_id,
  }));

export const leadsReportQuerySchema = z
  .object({
    date_from: z.string().datetime({ offset: true }).optional(),
    date_to: z.string().datetime({ offset: true }).optional(),
  })
  .transform((value) => defaultDateRange(value.date_from, value.date_to));

export const callsReportQuerySchema = z
  .object({
    date_from: z.string().datetime({ offset: true }).optional(),
    date_to: z.string().datetime({ offset: true }).optional(),
    user_id: z.string().uuid().optional(),
  })
  .transform((value) => ({
    ...defaultDateRange(value.date_from, value.date_to),
    userId: value.user_id,
  }));

export type DashboardReportQuery = z.infer<typeof dashboardReportQuerySchema>;
export type LeadsReportQuery = z.infer<typeof leadsReportQuerySchema>;
export type CallsReportQuery = z.infer<typeof callsReportQuerySchema>;
