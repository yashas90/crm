import type { PaginationMeta } from "@propninja/types";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export function jsonList<T>(c: Context, items: T[], page: number, pageSize: number, total: number) {
  return c.json({ items, page, pageSize, total });
}

export function jsonOk<T>(
  c: Context,
  data: T,
  meta?: PaginationMeta,
  status: ContentfulStatusCode = 200,
) {
  return c.json({ ok: true as const, data, ...(meta ? { meta } : {}) }, status);
}

export function jsonError(
  c: Context,
  code: string,
  message: string,
  status: ContentfulStatusCode = 400,
  details?: unknown,
) {
  return c.json({ ok: false as const, error: { code, message, details } }, status);
}
