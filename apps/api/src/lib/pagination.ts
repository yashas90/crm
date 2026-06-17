import { z } from "zod";

/** Default list page size when clients omit `pageSize` / `limit`. */
export const LIST_PAGE_SIZE_DEFAULT = 50;

/** Legacy global cap — prefer resource-specific caps below. */
export const LIST_PAGE_SIZE_MAX = 500;

export const LEADS_LIST_MAX = 200;
export const CALLS_LIST_MAX = 100;

export class QueryLimitRequiredError extends Error {
  constructor() {
    super("QUERY_LIMIT_REQUIRED");
    this.name = "QueryLimitRequiredError";
  }
}

/** Every paginated DB query must pass an explicit limit — never unbounded selects. */
export function requireQueryLimit(limit: number | undefined | null, max: number): number {
  if (limit == null || !Number.isFinite(limit) || limit <= 0) {
    throw new QueryLimitRequiredError();
  }
  return Math.min(Math.max(Math.trunc(limit), 1), max);
}

export function boundPageSize(pageSize?: number, max: number = LIST_PAGE_SIZE_MAX): number {
  return requireQueryLimit(pageSize ?? LIST_PAGE_SIZE_DEFAULT, max);
}

export function boundLeadsPageSize(pageSize?: number): number {
  return boundPageSize(pageSize, LEADS_LIST_MAX);
}

export function boundCallsPageSize(pageSize?: number): number {
  return boundPageSize(pageSize, CALLS_LIST_MAX);
}

export const listPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(LIST_PAGE_SIZE_MAX).default(LIST_PAGE_SIZE_DEFAULT),
});

export const leadsListPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(LEADS_LIST_MAX).default(LIST_PAGE_SIZE_DEFAULT),
});

export type ListPagination = z.infer<typeof listPaginationSchema>;
