import { z } from "zod";

const MS_PER_DAY = 86_400_000;

function defaultDateRange(dateFrom?: string, dateTo?: string) {
  const to = dateTo ? new Date(dateTo) : new Date();
  const from = dateFrom ? new Date(dateFrom) : new Date(to.getTime() - 29 * MS_PER_DAY);
  return { dateFrom: from, dateTo: to };
}

export const analyticsOverviewQuerySchema = z
  .object({
    date_from: z.string().datetime({ offset: true }).optional(),
    date_to: z.string().datetime({ offset: true }).optional(),
  })
  .transform((value) => defaultDateRange(value.date_from, value.date_to));

export type AnalyticsOverviewQuery = z.infer<typeof analyticsOverviewQuerySchema>;
