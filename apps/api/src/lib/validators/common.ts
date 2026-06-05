import { z } from "zod";

export function commaSeparated<T extends z.ZodTypeAny>(schema: T) {
  return z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      return value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    })
    .pipe(z.array(schema).optional());
}

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

export const leadIdParamSchema = z.object({
  leadId: z.string().uuid(),
});

export const dateRangeSchema = z.object({
  dateFrom: z.string().datetime({ offset: true }),
  dateTo: z.string().datetime({ offset: true }),
  groupBy: z.enum(["day", "week", "month"]).optional(),
});

export const sortOrderSchema = z.enum(["asc", "desc"]).default("desc");
