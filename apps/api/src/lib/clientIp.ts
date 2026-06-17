import type { Context } from "hono";

/** Best-effort client IP from reverse-proxy headers or the socket. */
export function getClientIp(c: Context): string | null {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = c.req.header("x-real-ip")?.trim();
  if (realIp) return realIp;

  const cfIp = c.req.header("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  return null;
}
